import { error } from '../common'
import _ from 'lodash'
import om from 'objectmodel'
const { Model, ObjectModel, ArrayModel, MapModel, SetModel } = om
const semverSort = require('semver/functions/sort')
const semverGtr = require('semver/ranges/gtr')
import { ethers } from 'ethers'
// import Binary from './binary'
import {
  buf2hex,
  hex2buf,
  verify,
  createHash,
  getPublicKeyFromSig,
  getIdFromPublicKey,
} from '@backbonedao/crypto'
import b4a from 'b4a'
import { pack } from 'msgpackr'

// Model for meta data
const Meta = Model({
  version: String,
  hash: [String],
  signature: [String],
  id: [String],
  unsigned: [Boolean],
})
  .assert((data) => {
    // Make sure signature is the right length
    if (data?.signature) return data.signature.length === 130
    else return true
  }, 'signature should have lenght of 130')
  .assert((data) => {
    // Make sure id is valid 0x address
    if (data?.id) return ethers.utils.isAddress(data.id)
    else return true
  }, 'Id should be valid 0x address')

export default async function (
  data: Object | String,
  opts?: {
    disable_owneronly?: boolean
    _debug?: { app_version: string; meta?: { signature: string; id: string } }
  },
  migrations?
) {
  // if we are running tests, disable owneronly
  if (process.env['TEST'] && opts?.disable_owneronly !== false)
    opts = { ...opts, disable_owneronly: true }

  let ready = false
  let current_id = ''

  // gather meta data about the app that's using the datamodel
  const app_meta = {
    version: opts?._debug?.app_version || '0',
    backbone: () => 
      // @ts-ignore
      (typeof window === 'object' && window.backbone) ||
      (typeof global === 'object' && global.backbone),
  }

  // if _getMeta is a function, get manifest and fill in the version
  if (typeof app_meta.backbone()?.app?.meta?._getMeta === 'function') {
    const manifest = await app_meta.backbone().app.meta?._getMeta('manifest')
    if (!manifest) return error('no manifest found')
    app_meta.version = manifest.version
  }

  // a helper method to fill out data object's meta data
  function getMetaDetails(meta) {
    const public_key = getPublicKeyFromSig({
      message: hex2buf(meta.hash),
      signature: hex2buf(meta.signature),
    })
    return { ...meta, public_key }
  }

  class datamodel extends Model(data).assert((data) => {
    // continue only after everything is ready
    if (!ready) return true
    if (opts?.disable_owneronly) return true

    // if there's no _meta, this check makes no sense
    if (!data?._meta) return true

    // if this is unsigned data, we need to sign it first for this check to make sense
    if (data?._meta?.unsigned) return true

    // if user hasn't authenticated, mark unsigned to force signing
    if (!current_id) {
      data['_meta']['unsigned'] = true
      return true
    }

    // verify signature to see if data has been changed
    const { signature, public_key } = getMetaDetails(data._meta)
    const { _meta, ...signable_data } = data
    const hash = createHash(pack(signable_data))

    // how do I signal if this is the creation point and we should sign it instead of waiting for manual?
    if(data._initial) {
      return true
    } else if (!verify(hash, signature, public_key)) {
      // if it's the same author, mark this unsigned
      const og_id = getIdFromPublicKey(hex2buf(public_key))
      if(b4a.equals(og_id, current_id)) {
        data['_meta']['unsigned'] = true
        return true
      } 
      else return false
    } else {
      return true
    }
  }, 'signature must verify against data') {
    _meta
    _initial

    constructor(data) {
      // if data is a string, it's probably stringified JSON
      try {
        if (typeof data === 'string') data = JSON.parse(data)
      } catch (error) {
        // it wasn't...
        error('input data must be an object or stringified JSON')
      }

      // Check if data needs migrating
      if (Object.keys(migrations || {}).length > 0 && data?._meta?.version && data?._meta?.version !== app_meta.version) {
        // are we going up or down?
        const direction = semverGtr(data._meta.version, app_meta.version) ? 'down' : 'up'

        // compute a list of migrations to go through
        const m_vers = semverSort(Object.keys(migrations))
        let migs = []
        if (direction === 'up') migs = m_vers.slice(0, m_vers.indexOf(app_meta.version) + 1)
        else migs = m_vers.slice(m_vers.indexOf(app_meta.version) + 1).reverse()

        // apply each migration
        for (let i = 0; i < migs.length; i++) {
          const ver = migs[i]
          const migration = migrations[ver]
          data = migration[direction](data)
          data._meta.version =
            direction === 'up'
              ? ver
              : m_vers.indexOf(ver) > 0
              ? m_vers[m_vers.indexOf(ver) - 1]
              : app_meta.version
          if (
            direction === 'up' &&
            (!semverGtr(app_meta.version, ver) || migs.indexOf(ver) === migs.length - 1)
          )
            break
          if (
            direction === 'down' &&
            (semverGtr(app_meta.version, ver) || migs.indexOf(ver) === migs.length - 1)
          )
            break
        }
      }

      let tmp_meta
      // if _meta is included, it's an existing object
      if (data?._meta) {
        // check _meta complies with the spec
        tmp_meta = new Meta(data._meta)

        // remove _meta until we have created a model
        delete data._meta
      } else {
        // no _meta means the wrapper didn't do its job
        error('_meta missing')
      }
      // if data is unsigned, we can't use it for object
      if (!opts?.disable_owneronly && data._meta?.unsigned === true)
        error("can't create object with unsigned data")

      // create model from data
      super(data)

      // add _meta back in
      this._meta = tmp_meta

      // remove _initial
      delete this._initial

      ready = true
    }
    flatten() {
      // this could be better...
      const data = {}
      Object.keys(this).forEach((k) => (data[k] = this[k]))
      data['_meta'] = {}
      Object.keys(this._meta).forEach((k) => (data['_meta'][k] = this['_meta'][k]))
      return data
    }
    toJSON() {
      const data = this.flatten()
      return JSON.stringify(data)
    }
    async sign() {
      if (typeof this['_meta']?.unsigned === undefined) return error('data is already signed')

      await checkUser()
      if (!current_id) return error('tried to sign without being authenticated')
      
      // check signer matches the author
      let { public_key } = getMetaDetails(this['_meta'])
      let pid = getIdFromPublicKey(hex2buf(public_key))
      if (!b4a.isBuffer(public_key)) public_key = hex2buf(public_key)
      if (!b4a.isBuffer(current_id))
        current_id = hex2buf(current_id.match(/^0x/) ? current_id : '0x' + current_id)
      if (!b4a.equals(current_id, pid)) return error("current id doesn't match the author")

      // sign the update
      const signature = await signObject(this)
      const { unsigned, ...meta } = this._meta
      const m = new Meta({ ...meta, ...signature })
      this._meta = m

      return true
    }
  }

  async function signObject(data) {
    if(!current_id) {
      return checkUser()
    }
    let signable_data
    if (data?._meta) {
      let { _meta, ..._signable_data } = data
      signable_data = _signable_data
      if (_meta?.signature && _meta?.hash && !_meta?.unsigned) return _meta
    } else {
      signable_data = data
    }
    let hash = createHash(pack(signable_data))
    let signature = await app_meta.backbone().id.signObject({ hash })
    if (b4a.isBuffer(hash)) hash = buf2hex(hash)
    if (b4a.isBuffer(signature)) signature = buf2hex(signature)

    if (!signature) {
      return error(`signing object failed`)
    } else {
      return { signature, hash }
    }
  }

  async function checkUser() {
    // check if id is present
    if (!app_meta.backbone()?.id) {
      // id is not present, so let's see if we can trigger authentication
      if (typeof app_meta.backbone()?.user === 'function') {
        await app_meta.backbone().user()
        await checkUser()
      } else {
        return error('authentication required but no authentication method found')
      }
    } else {
      const is_authenticated = await app_meta.backbone().id.isAuthenticated()
      if(is_authenticated) {
        current_id = await app_meta.backbone().id.getId()
        if(!current_id) return error('error in getting user id')
      } else {
        await app_meta.backbone().user()
        await checkUser()
      }
    }
  }

  return async (input) => {
    if (typeof input === 'string') {
      try {
        input = JSON.parse(input)
      } catch (error) {
        return error('DataModel accepts only objects or stringified objects')
      }
    }
    const data = _.cloneDeep(input)
    // if _meta is included, it's already established object
    if (data?._meta) {
      // unless owner_only is disabled, fail if no sig is present
      if (!opts?.disable_owneronly && !data._meta.signature) {
        return error('signature and id required')
      }
      // await checkUser(data)
    }
    // no _meta means it's a new object
    else {
      // unless owner_only is disabled, we'll try to sign the data
      if (!opts?.disable_owneronly) {
        await checkUser()
        const signature = await signObject(data)
        data['_meta'] = new Meta({ ...signature, version: app_meta.version })
        data['_initial'] = true
        // return data
      } else {
        data._meta = new Meta({ version: app_meta.version })
      }
    }
    return new datamodel(data)
  }
}
export { Model, ObjectModel as Object, ArrayModel as Array, MapModel as Map, SetModel as Set }
