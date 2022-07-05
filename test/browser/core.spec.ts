import { test, expect } from '@playwright/test'
import Core from '../../core'
import { CoreConfig } from '../../common/interfaces'
import { cleanup } from '../helper'
import { sleep } from '../../common'
import Apps from '../../apps'
import { keyPair, buf2hex, createHash } from '@backbonedao/crypto'

const cores = {}

test.describe('Core', () => {
  test.beforeEach(cleanup)
  test.afterEach(cleanup)
  test.afterAll(async () => {
    for (const core in cores) {
      if (cores[core]) await cores[core].disconnect()
    }
  })

  test('should initialize core', async () => {
    const core = await Core({
      config: {
        address: 'init-test',
        encryption_key: 'foobar',
        private: false,
        storage_prefix: 'test',
        storage: 'ram',
      },
      app: Apps['keyvalue'],
    })
    const keys = await core.getKeys()
    expect(Object.keys(keys)).toEqual(['writers', 'indexes'])
    expect(keys.writers[0]).toHaveLength(66)
    expect(keys.indexes[0]).toHaveLength(66)

    // test bootloader apis while at it...
    await core._setMeta({ key: 'foo', value: 'bar' })
    const foo = await core._getMeta('foo')
    expect(foo).toEqual('bar')
  })

  test('should initialize core with keys', async () => {
    const keypair = keyPair()
    const core = await Core({
      config: {
        address: 'init-test',
        encryption_key: 'foobar',
        private: false,
        storage_prefix: 'test',
        storage: 'ram',
        key: createHash(buf2hex(keypair.secretKey)),
      },
      app: Apps['keyvalue'],
    })
    const keys = await core.getKeys()
    expect(Object.keys(keys)).toEqual(['writers', 'indexes'])
    expect(keys.writers[0]).toHaveLength(66)
    expect(keys.indexes[0]).toHaveLength(66)
    await core.set({ key: 'foo', value: 'bar' })
    const foo = await core.get('foo')
    expect(foo).toEqual('bar')
  })

  test('should create and replicate two cores', async () => {
    // create first core
    cores['core1'] = await Core({
      config: {
        address: 'replica-test2',
        encryption_key: 'foobar',
        private: false,
        storage_prefix: 'test',
        storage: 'ram',
      },
      app: Apps['keyvalue'],
    })

    await cores['core1'].set({ key: 'hello', value: 'first' })

    // create second core
    let config2: CoreConfig = {
      address: 'replica-test2',
      storage_prefix: '2',
      encryption_key: 'foobar',
      private: false,
      storage: 'ram',
    }
    const keys1 = await cores['core1'].getKeys()
    cores['core2'] = await Core({ config: config2, app: Apps['keyvalue'] })
    await cores['core2'].addPeer({ key: keys1.writers[0], partition: 'data' })
    const keys2 = await cores['core2'].getKeys()
    await cores['core1'].addPeer({ key: keys2.writers[0], partition: 'data' })

    // connect and verify replication
    const n1 = await cores['core1'].connect({ local_only: { initiator: true } })
    const n2 = await cores['core2'].connect({ local_only: { initiator: false } })
    const s = n1.pipe(n2).pipe(n1)

    // this needs to be here or otherwise replication doesn't work properly
    // let posts1 = await cores['core1'].all()

    let posts = await cores['core2'].all()

    expect(posts).toHaveLength(1)
    expect(posts[0]).toEqual('first')

    // make a post on second one and verify
    await cores['core2'].set({ key: 'world', value: 'second' })
    // await cores['core1'].all()
    const posts2 = await cores['core2'].all()
    expect(posts2).toHaveLength(2)
    expect(posts2[1]).toEqual('second')

    const posts3 = await cores['core1'].all()
    expect(posts3).toHaveLength(2)
    expect(posts3[1]).toEqual('second')

    // freeze second core, make a post on second
    await cores['core1'].removePeer({ key: keys2.writers[0], partition: 'data' })
    await cores['core2'].set({ key: '!!', value: 'third' })

    const posts4 = await cores['core2'].all()
    expect(posts4).toHaveLength(3)
    expect(posts4[0]).toEqual('third')

    // verify it doesn't replicate but still has history
    const posts5 = await cores['core1'].all()
    expect(posts5).toHaveLength(2)
    expect(posts5[1]).toEqual('second')

    // remove second core and destroy everything
    await cores['core1'].removePeer({ key: keys2.writers[0], destroy: true, partition: 'data' })
    const posts6 = await cores['core1'].all()
    expect(posts6).toHaveLength(1)
  })

  test('should create an encrypted core', async () => {
    cores['core_encrypted'] = await Core({
      config: {
        address: 'enc-test',
        encryption_key: 'foobar',
        private: false,
        storage_prefix: 'test',
      },
      app: Apps['chat'],
    })
    const keys1 = await cores['core_encrypted'].getKeys()
    await cores['core_encrypted'].connect({ local_only: { initiator: true } })
    await cores['core_encrypted'].post({ text: 'world', user: 'foobar' })

    // create second core
    let config_wrong_pass: CoreConfig = {
      address: 'test',
      encryption_key: 'd34db34t',
      private: false,
      storage_prefix: 'test',
    }
    config_wrong_pass.writers = keys1.writers
    config_wrong_pass.trusted_peers = keys1.indexes

    cores['core_wrong_pass'] = await Core({
      config: {
        address: 'enc-test',
        storage_prefix: '2',
        encryption_key: 'd34db34t',
        private: false,
      },
      app: Apps['chat'],
    })

    await cores['core_wrong_pass'].connect({ local_only: { initiator: false } })
    let posts = await cores['core_wrong_pass'].all()
    expect(posts.length).toEqual(0)
    // expect(posts[0].data).to.not.eql('hello')
  })

  test('should not allow private core to be connected', async () => {
    try {
      cores['core_private'] = await Core({
        config: {
          address: 'private-test',
          encryption_key: 'foobar',
          private: true,
          storage_prefix: 'test',
        },
        app: Apps['chat'],
      })
      // await cores['core_private'].connect({ local_only: { initiator: true } })
    } catch (e) {
      expect(e.message).toEqual('ACCESS DENIED - PRIVATE CORE')
    }
  })
})

test('deploy app to core and get other cores to run it', async () => {
  const core1 = await Core({
    config: {
      address: '0x594a0EbDe3d9E52752040a676c978e076dA32F3D',
      encryption_key: 'foobar',
      storage: 'ram'
    },
    app: {
      API: async function (Data, Protocol) {
        return {
          async get(key) {
            const value = await Data.get(key)
            return value || null
          },
          async set(params = { key: '', value: '' }) {
            await Protocol({
              type: 'set',
              key: params.key,
              value: params.value,
            })
          },
        }
      },

      Protocol: async function (op, Core, Id) {
        if (typeof op !== 'object' || !op?.type) throw new Error('UNKNOWN OP')
        switch (op.type) {
          case 'set': {
            await Core.put({ key: op.key, value: op.value })
            break
          }
          default:
            throw new Error('UNKNOWN OP')
        }
      },
    },
  })
  const code = `!function(f){"object"==typeof exports&&"undefined"!=typeof module?module.exports=f():"function"==typeof define&&define.amd?define([],f):("undefined"!=typeof window?window:"undefined"!=typeof global?global:"undefined"!=typeof self?self:this).app=f()}(function(){return function r(e,n,t){function o(i,f){if(!n[i]){if(!e[i]){var c="function"==typeof require&&require;if(!f&&c)return c(i,!0);if(u)return u(i,!0);throw(f=new Error("Cannot find module '"+i+"'")).code="MODULE_NOT_FOUND",f}c=n[i]={exports:{}},e[i][0].call(c.exports,function(r){return o(e[i][1][r]||r)},c,c.exports,r,e,n,t)}return n[i].exports}for(var u="function"==typeof require&&require,i=0;i<t.length;i++)o(t[i]);return o}({1:[function(require,module,exports){module.exports=async function(Core,Protocol){return{async all(stream){return await Core.query({lt:"~"},stream)},async get(key){return await Core.get(key)||null},async del(key){await Protocol({type:"del",key:key})},async set(params={key:"",value:""}){await Protocol({type:"set",key:params.key,value:params.value})}}}},{}],2:[function(require,module,exports){var Protocol=require("./protocol"),require=require("./api");module.exports={Protocol:Protocol,API:require}},{"./api":1,"./protocol":3}],3:[function(require,module,exports){module.exports=async function(op,Core,Id){if("object"!=typeof op||!op?.type)throw new Error("UNKNOWN OP");switch(op.type){case"set":await Core.put({key:op.key,value:op.value});break;case"del":if(!await Core.get(op.key,{update:!1}))break;await Core.del(op.key);break;default:throw new Error("UNKNOWN OP")}}},{}]},{},[2])(2)});`
  await core1._setMeta({
    key: '_/code',
    value: {
      code,
      signature:
        '835fe61c320a7e92797b4ddc90d7e92139b5546885a79c5d5262f9ffe5b9eb5d65c998552708fb3e01efc9d943dc9ed815dd2b5ddba67dc264dad8662eec0e641c',
    },
  })
  const ccode = await core1._getMeta('_/code')
  expect(ccode).toBeTruthy()
  expect(buf2hex(createHash(ccode.code))).toEqual(buf2hex(createHash(code)))

  const storage_prefix = Math.round(Math.random()*100000).toString()
  const core2 = await Core({
    config: {
      address: '0x594a0EbDe3d9E52752040a676c978e076dA32F3D',
      encryption_key: 'foobar',
      storage_prefix,
      storage: 'raf'
    },
  })

  const core1_keys = await core1.getKeys()
  await core2.addPeer({ key: core1_keys.data.writers[0], partition: 'data' })
  await core2.addPeer({ key: core1_keys.meta.writers[0], partition: 'meta' })
  const core2_keys = await core2.getKeys()
  await core1.addPeer({ key: core2_keys.data.writers[0], partition: 'data' })
  await core1.addPeer({ key: core2_keys.meta.writers[0], partition: 'meta' })

  // connect and verify replication
  const n1 = await core1.connect({ local_only: { initiator: true } })
  const n2 = await core2.connect({ local_only: { initiator: false } })
  const s = n1.pipe(n2).pipe(n1)

  const code2 = await core2._getMeta('_/code')
  expect(buf2hex(createHash(code2.code))).toEqual(buf2hex(createHash(code)))

  const storage_prefix2 = Math.round(Math.random()*100000).toString()
  const core3 = await Core({
    config: {
      address: '0x594a0EbDe3d9E52752040a676c978e076dA32F3D',
      encryption_key: 'foobar',
      storage_prefix: storage_prefix2,
      storage: 'raf'
    },
  })
  const core3_keys = await core3.getKeys()
  await core3.addPeer({ key: core2_keys.data.writers[0], partition: 'data' })
  await core3.addPeer({ key: core2_keys.meta.writers[0], partition: 'meta' })
  await core3.addPeer({ key: core1_keys.data.writers[0], partition: 'data' })
  await core3.addPeer({ key: core1_keys.meta.writers[0], partition: 'meta' })

  // connect and verify replication
  const n3 = await core3.connect({ local_only: { initiator: false } })
  const s3 = n2.pipe(n3).pipe(n2)

  const code3 = await core3._getMeta('_/code')
  expect(buf2hex(createHash(code3.code))).toEqual(buf2hex(createHash(code)))
})
