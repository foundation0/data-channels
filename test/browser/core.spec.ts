import { test, expect } from "@playwright/test"
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
    await core.set({ key: 'foo', value: 'bar'})
    const foo = await core.get('foo')
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
        key: createHash(buf2hex(keypair.secretKey))
      },
      app: Apps['keyvalue'],
    })
    const keys = await core.getKeys()
    expect(Object.keys(keys)).toEqual(['writers', 'indexes'])
    expect(keys.writers[0]).toHaveLength(66)
    expect(keys.indexes[0]).toHaveLength(66)
    await core.set({ key: 'foo', value: 'bar'})
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
        storage: 'rai',
      },
      app: Apps['keyvalue'],
    })

    await cores['core1'].connect(true)
    await cores['core1'].set({ key: 'hello', value: 'foobar' })
    await sleep(5000)
    // create second core
    let config2: CoreConfig = {
      address: 'replica-test2',
      storage_prefix: '2',
      encryption_key: 'foobar',
      private: false,
      storage: 'ram',
    }
    // const keys1 = await cores['core1'].getKeys()
    //config2.writers = keys1.writers
    //config2.indexes = keys1.indexes
    cores['core2'] = await Core({ config: config2, app: Apps['chat'] })

    // connect and verify replication
    await cores['core2'].connect(true)
    await sleep(5000)
    let posts = await cores['core2'].all()

    expect(posts).toHaveLength(1)
    expect(posts[0].data).toEqual('hello')

    // make a post on second one and verify
    await cores['core2'].post({ text: 'world', user: 'foobar' })
    await sleep(100)
    const posts2 = await cores['core2'].all()
    expect(posts2).toHaveLength(2)
    expect(posts2[0].data).toEqual('world')

    const posts3 = await cores['core1'].all()
    expect(posts3).toHaveLength(2)
    expect(posts3[0].data).toEqual('world')

    // remove second core as a writer, make a post on second
    const core2_writer_key = await cores['core2'].getWriterKey()
    await cores['core1'].removeWriter({ key: core2_writer_key })
    await cores['core2'].post({ text: '!!', user: 'foobar' })
    await sleep(100)
    const posts4 = await cores['core2'].all()
    expect(posts4).toHaveLength(3)
    expect(posts4[0].data).toEqual('!!')

    // verify it doesn't replicate
    const posts5 = await cores['core1'].all()
    expect(posts5).toHaveLength(1)
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
    await cores['core_encrypted'].connect(true)
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

    await cores['core_wrong_pass'].connect(true)
    let posts = await cores['core_wrong_pass'].all()
    expect(posts.length).toEqual(0)
    // expect(posts[0].data).to.not.eql('hello')
  })

  test('should not allow private core to be connected', async () => {
    cores['core_private'] = await Core({
      config: {
        address: 'private-test',
        encryption_key: 'foobar',
        private: true,
        storage_prefix: 'test',
      },
      app: Apps['chat'],
    })
    try {
      await cores['core_private'].connect(true)
    } catch (e) {
      expect(e.message).toEqual('ACCESS DENIED - PRIVATE CORE')
    }
  })
})
