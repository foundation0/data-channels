import { test, expect } from '@playwright/test'
import Core from '../../core'
import { CoreConfig } from '../../common/interfaces'
import { cleanup } from '../helper'
import { error, sleep } from '../../common'
import KeyValue from './keyvalue'
import Chat from './chat'
import { keyPair, buf2hex, createHash } from '@backbonedao/crypto'

const cores = {}

test.describe('Core', () => {
  test.beforeEach(cleanup)
  test.afterEach(cleanup)
  test.afterAll(async () => {
    for (const core in cores) {
      if (cores[core]) await cores[core].network.disconnect()
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
      app: KeyValue,
    })
    const keys = await core.meta.getKeys()
    expect(Object.keys(keys.data)).toEqual(['writers', 'indexes'])
    expect(keys.data.writers[0]).toHaveLength(66)
    expect(keys.data.indexes[0]).toHaveLength(66)

    // test bootloader apis while at it...
    await core.meta._setMeta({ key: 'foo', value: 'bar' })
    const foo = await core.meta._getMeta('foo')
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
      app: KeyValue,
    })
    const keys = await core.meta.getKeys()
    expect(Object.keys(keys.data)).toEqual(['writers', 'indexes'])
    expect(keys.data.writers[0]).toHaveLength(66)
    expect(keys.data.indexes[0]).toHaveLength(66)
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
      app: KeyValue,
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
    cores['core2'] = await Core({ config: config2, app: KeyValue })
    const keys2 = await cores['core2'].meta.getKeys()

    // wait for network to catch up
    await sleep(5000)

    let posts = await cores['core2'].all()

    expect(posts).toHaveLength(1)
    expect(posts[0]).toEqual('first')

    // make a post on second one and verify
    await cores['core2'].set({ key: 'world', value: 'second' })
    // await cores['core1'].all()
    const posts2 = await cores['core2'].all()
    expect(posts2).toHaveLength(2)
    expect(posts2[1]).toEqual('second')
    await sleep(1000)
    const posts3 = await cores['core1'].all()
    expect(posts3).toHaveLength(2)
    expect(posts3[1]).toEqual('second')

    // freeze second core, make a post on second
    await cores['core1'].users.removeUser({ key: keys2.data.writers[0], partition: 'data' })
    await cores['core2'].set({ key: '!!', value: 'third' })

    const posts4 = await cores['core2'].all()
    expect(posts4).toHaveLength(3)
    expect(posts4[0]).toEqual('third')

    // verify it doesn't replicate but still has history
    const posts5 = await cores['core1'].all()
    expect(posts5).toHaveLength(2)
    expect(posts5[1]).toEqual('second')

    // remove second core and destroy everything
    await cores['core1'].users.removeUser({
      key: keys2.data.writers[0],
      destroy: true,
      partition: 'data',
    })
    const posts6 = await cores['core1'].all()
    expect(posts6).toHaveLength(1)
  })

  // this is skipped until somebody patches up codecs library with proper error handling
  test.skip('should create an encrypted core', async () => {
    try {
      cores['core_encrypted'] = await Core({
        config: {
          address: 'enc-test',
          encryption_key: 'foobar',
          private: false,
          storage_prefix: 'test',
        },
        app: Chat,
      })
      const keys1 = await cores['core_encrypted'].meta.getKeys()
      await cores['core_encrypted'].post({ text: 'world', user: 'foobar' })

      // test that encryption works

      // create second core
      let config_wrong_pass: CoreConfig = {
        address: 'enc-test',
        encryption_key: 'd34db34t',
        private: false,
        storage_prefix: 'test',
      }
      config_wrong_pass.writers = keys1.writers
      config_wrong_pass.trusted_users = keys1.indexes

      cores['core_wrong_pass'] = await Core({
        config: config_wrong_pass,
        app: Chat,
      })

      // waiting for the network to catch up
      await sleep(5000)

      let posts = await cores['core_wrong_pass'].all()
      expect(posts.length).toEqual(100) // we should never get here
    } catch (error) {
      expect(error).toBeTruthy()
    }
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
        app: Chat,
      })
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
      storage: 'ram',
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
        if (typeof op !== 'object' || !op?.type) return error('UNKNOWN OP')
        switch (op.type) {
          case 'set': {
            await Core.put({ key: op.key, value: op.value })
            break
          }
          default:
            console.log('UNKNOWN OP')
            return error('UNKNOWN OP')
        }
      },
    },
  })
  const app = `!function(f){"object"==typeof exports&&"undefined"!=typeof module?module.exports=f():"function"==typeof define&&define.amd?define([],f):("undefined"!=typeof window?window:"undefined"!=typeof global?global:"undefined"!=typeof self?self:this).app=f()}(function(){return function r(e,n,t){function o(i,f){if(!n[i]){if(!e[i]){var c="function"==typeof require&&require;if(!f&&c)return c(i,!0);if(u)return u(i,!0);throw(f=new Error("Cannot find module '"+i+"'")).code="MODULE_NOT_FOUND",f}c=n[i]={exports:{}},e[i][0].call(c.exports,function(r){return o(e[i][1][r]||r)},c,c.exports,r,e,n,t)}return n[i].exports}for(var u="function"==typeof require&&require,i=0;i<t.length;i++)o(t[i]);return o}({1:[function(require,module,exports){module.exports=async function(Core,Protocol){return{async all(stream){return await Core.query({lt:"~"},stream)},async get(key){return await Core.get(key)||null},async del(key){await Protocol({type:"del",key:key})},async set(params={key:"",value:""}){await Protocol({type:"set",key:params.key,value:params.value})}}}},{}],2:[function(require,module,exports){var Protocol=require("./protocol"),require=require("./api");module.exports={Protocol:Protocol,API:require}},{"./api":1,"./protocol":3}],3:[function(require,module,exports){module.exports=async function(op,Core,Id){if("object"!=typeof op||!op?.type)return error("UNKNOWN OP");switch(op.type){case"set":await Core.put({key:op.key,value:op.value});break;case"del":if(!await Core.get(op.key,{update:!1}))break;await Core.del(op.key);break;default:return error("UNKNOWN OP")}}},{}]},{},[2])(2)});`
  const ui = `!function(e){"object"==typeof exports&&"undefined"!=typeof module?module.exports=e():"function"==typeof define&&define.amd?define([],e):("undefined"!=typeof window?window:"undefined"!=typeof global?global:"undefined"!=typeof self?self:this).app=e()}(function(){return function t(r,f,i){function u(n,e){if(!f[n]){if(!r[n]){var o="function"==typeof require&&require;if(!e&&o)return o(n,!0);if(d)return d(n,!0);throw(e=new Error("Cannot find module '"+n+"'")).code="MODULE_NOT_FOUND",e}o=f[n]={exports:{}},r[n][0].call(o.exports,function(e){return u(r[n][1][e]||e)},o,o.exports,t,r,f,i)}return f[n].exports}for(var d="function"==typeof require&&require,e=0;e<i.length;e++)u(i[e]);return u}({1:[function(e,n,o){n.exports=async()=>{}},{}]},{},[1])(1)});`
  await core1.meta._setMeta({
    key: 'code',
    value: {
      app,
      ui,
      signature:
        '835fe61c320a7e92797b4ddc90d7e92139b5546885a79c5d5262f9ffe5b9eb5d65c998552708fb3e01efc9d943dc9ed815dd2b5ddba67dc264dad8662eec0e641c',
    },
  })
  await core1.meta._setMeta({
    key: 'manifest',
    value: {
      address: '0x...'
    },
  })
  const ccode = await core1.meta._getMeta('code')
  expect(ccode).toBeTruthy()
  expect(buf2hex(createHash(ccode.app))).toEqual(buf2hex(createHash(app)))
  expect(buf2hex(createHash(ccode.ui))).toEqual(buf2hex(createHash(ui)))

  const storage_prefix = Math.round(Math.random() * 100000).toString()
  const core2 = await Core({
    config: {
      address: '0x594a0EbDe3d9E52752040a676c978e076dA32F3D',
      encryption_key: 'foobar',
      storage_prefix,
      storage: 'raf',
    },
  })

  const code2 = await core2.meta._getMeta('code')
  expect(buf2hex(createHash(code2.app))).toEqual(buf2hex(createHash(app)))
  expect(buf2hex(createHash(code2.ui))).toEqual(buf2hex(createHash(ui)))

  const storage_prefix2 = Math.round(Math.random() * 100000).toString()
  const core3 = await Core({
    config: {
      address: '0x594a0EbDe3d9E52752040a676c978e076dA32F3D',
      encryption_key: 'foobar',
      storage_prefix: storage_prefix2,
      storage: 'raf',
    },
  })

  const code3 = await core3.meta._getMeta('code')
  expect(buf2hex(createHash(code3.app))).toEqual(buf2hex(createHash(app)))
  expect(buf2hex(createHash(code3.ui))).toEqual(buf2hex(createHash(ui)))
})
