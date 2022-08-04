import { error } from '../common'

const {
  Model,
  BasicModel,
  ObjectModel,
  ArrayModel,
  FunctionModel,
  MapModel,
  SetModel,
  Any,
} = require('./objectmodel')
const semverSort = require('semver/functions/sort')
const semverGtr = require('semver/ranges/gtr')
const { ethers } = require('ethers')
import Binary from './binary'
import {
  buf2hex,
  hex2buf,
  verify,
  createHash,
  getPublicKeyFromSig,
  getIdFromPublicKey,
} from '../../crypto' // '@backbonedao/crypto'
import b4a from 'b4a'
import { pack, unpack } from 'msgpackr'

const Meta = Model({
  version: String,
  hash: [Binary],
  signature: [Binary],
  id: [Binary],
  unsigned: [Boolean],
})
  .assert((data) => {
    if (data?.signature) return data.signature.byteLength === 65
    else return true
  }, 'signature should have lenght of 65')
  .assert((data) => {
    if (data?.id) return ethers.utils.isAddress(buf2hex(data.id))
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
  if (process.env['TEST'] && opts?.disable_owneronly !== false)
    opts = { ...opts, disable_owneronly: true }

  let ready = false
  let current_id = null
  const app_meta = {
    version: opts?._debug?.app_version || '0',
    backbone:
      // @ts-ignore
      (typeof window === 'object' && window.backbone) ||
      (typeof global === 'object' && global.backbone),
  }

  if (app_meta.backbone?.app?.version) app_meta.version = app_meta.backbone.app.version

  function getMetaDetails(meta) {
    const public_key = getPublicKeyFromSig({ message: meta.hash, signature: meta.signature })
    return { ...meta, public_key }
  }
  class datamodel extends Model(data).assert((data) => {
    // Check that signature matches the data
    // continue only after everything is ready
    if (!ready) return true
    if (opts?.disable_owneronly) return true

    if(data['_meta']['unsigned']) return true

    // verify signature to see if data has been changed
    const { signature, public_key } = getMetaDetails(data._meta)
    const { _meta, ...signable_data } = data
    const hash = createHash(pack(signable_data))
    if (!verify(hash, signature, public_key)) {
      data['_meta']['unsigned'] = true
    }
    return true
  }, 'signature must verify against data') {
    _meta

    constructor(data) {
      if (typeof data === 'string') data = JSON.parse(data)

      // Check if data needs migrating
      if (data?._meta?.version && data?._meta?.version !== app_meta.version) {
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
      // if _meta is included, it's serialized
      if (data?._meta) {
        tmp_meta = new Meta(data._meta)
        delete data._meta
      }
      // no _meta means the wrapper didn't do its job
      else {
        error('_meta missing')
      }
      if (data._meta?.unsigned === true) error("can't create object with unsigned data")
      super(data)
      this._meta = tmp_meta
      ready = true
    }
    toJSON() {
      const data = {}
      const keys = Object.keys(this)
      keys.forEach((k) => (data[k] = this[k]))
      data['_meta'] = this._meta
      return JSON.stringify(data)
    }
    async sign() {
      if (typeof this['_meta']?.unsigned === undefined) return error('data is already signed')
      await checkUser(data)
      // check signer matches the author
      const { public_key } = getMetaDetails(this['_meta'])
      const pid = getIdFromPublicKey(hex2buf(public_key))
      if (!b4a.equals(current_id, pid)) return error("current id doesn't match the author")

      // sign the update
      const signature = await signObject(this)
      const { unsigned, ...meta} = this._meta
      this._meta = new Meta({ ...meta, ...signature })
    }
  }

  async function signObject(data) {
    const { _meta, ...signable_data } = data
    const hash = createHash(pack(signable_data))
    const signature = await app_meta.backbone.id.signObject({ hash })

    if (!signature) {
      return error(`signing object failed`)
    } else {
      return { signature, hash }
    }
  }

  async function checkUser(data) {
    // check if id is present
    if (!app_meta.backbone?.id) {
      // id is not present, so let's see if we can trigger authentication
      if (typeof app_meta.backbone?.user?.authenticate === 'function') {
        await app_meta.backbone.user.authenticate()
      } else {
        return error('authentication required but no authentication method found')
      }
    }
    current_id = await app_meta.backbone.id.getId()
  }

  return async (data) => {
    if (typeof data === 'string') {
      try {
        data = JSON.parse(data)
      } catch (error) {
        return error('DataModel accepts only objects or stringified objects')
      }
    }
    // if _meta is included, it's already established object
    if (data?._meta) {
      // unless owner_only is disabled, fail if no sig is present
      if (!opts?.disable_owneronly && !data._meta.signature) {
        return error('signature and id required')
      }
      await checkUser(data)
    }
    // no _meta means it's a new object
    else {
      // unless owner_only is disabled, we'll try to sign the data
      if (!opts?.disable_owneronly) {
        await checkUser(data)
        const signature = await signObject(data)
        data['_meta'] = new Meta({ ...signature, version: app_meta.version })
        // return data
      } else {
        data._meta = new Meta({ version: app_meta.version })
      }
    }
    return new datamodel(data)
  }
}
export { Model, ObjectModel as Object, ArrayModel as Array, MapModel as Map, SetModel as Set }
