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
    await core.set({ key: 'foo', value: 'bar' })
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
    await cores['core2'].addPeer({ key: keys1.writers[0] })
    const keys2 = await cores['core2'].getKeys()
    await cores['core1'].addPeer({ key: keys2.writers[0] })

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
    await cores['core1'].removePeer({ key: keys2.writers[0] })
    await cores['core2'].set({ key: '!!', value: 'third' })
    
    const posts4 = await cores['core2'].all()
    expect(posts4).toHaveLength(3)
    expect(posts4[0]).toEqual('third')

    // verify it doesn't replicate but still has history
    const posts5 = await cores['core1'].all()
    expect(posts5).toHaveLength(2)
    expect(posts5[1]).toEqual('second')
    
    // remove second core and destroy everything
    await cores['core1'].removePeer({ key: keys2.writers[0], destroy: true })
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
    await cores['core_encrypted'].connect({ local_only: true })
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

    await cores['core_wrong_pass'].connect({ local_only: true })
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
      await cores['core_private'].connect({ local_only: true })
    } catch (e) {
      expect(e.message).toEqual('ACCESS DENIED - PRIVATE CORE')
    }
  })
})
