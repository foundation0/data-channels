import { expect } from 'chai'
import Core from '../core'
import { CoreConfig } from '../common/interfaces'
import { cleanup } from './helper'
import { step } from 'mocha-steps'
import { sleep } from '../common'
import default_config from '../bbconfig'
import Apps from '../apps'

const network = ['0.0.0.0:50000', '0.0.0.0:50001', '0.0.0.0:50002'] // ['0.0.0.0:3480', '0.0.0.0:5228', '0.0.0.0:16400']

const cores = {}

describe('Core', () => {
  beforeEach(cleanup)
  afterEach(cleanup)
  after(async () => {
    for (const core in cores) {
      if (cores[core]) await cores[core].disconnect()
    }
  })

  step('should initialize core', async () => {
    const core = await Core({
      config: {
        address: 'init-test',
        encryption_key: default_config.keys.index,
        writers: [],
        indexes: [],
        private: false,
        storage_prefix: 'test',
        storage: 'ram',
      },
      app: Apps['keyvalue'],
    })
    const keys = await core.getKeys()
    expect(keys).to.include.all.keys(['writers', 'indexes'])
    expect(keys.writers[0]).to.be.lengthOf(64)
    expect(keys.indexes[0]).to.be.lengthOf(64)

    await core.set({ key: 'foo', value: 'bar'})
    const foo = await core.get('foo')
    expect(foo).to.eq('bar')
  }).timeout(10000)

  step('should create and replicate two cores', async () => {
    // create first core
    cores['core1'] = await Core({
      config: {
        address: 'replica-test',
        encryption_key: default_config.keys.index,
        private: false,
        storage_prefix: 'test',
        storage: 'ram',
      },
      app: Apps['chat'],
    })

    await cores['core1'].connect(true)
    await cores['core1'].post({ text: 'hello', user: 'foobar' })
    await sleep(100)
    // create second core
    let config2: CoreConfig = {
      address: 'replica-test',
      storage_prefix: '2',
      encryption_key: default_config.keys.index,
      private: false,
      storage: 'ram',
    }
    const keys1 = await cores['core1'].getKeys()
    //config2.writers = keys1.writers
    //config2.indexes = keys1.indexes
    cores['core2'] = await Core({ config: config2, app: Apps['chat'] })

    // connect and verify replication
    await cores['core2'].connect(true)
    await sleep(500)
    let posts = await cores['core2'].all()

    expect(posts).to.be.lengthOf(1)
    expect(posts[0].data).to.eql('hello')

    // make a post on second one and verify
    await cores['core2'].post({ text: 'world', user: 'foobar' })
    await sleep(100)
    const posts2 = await cores['core2'].all()
    expect(posts2).to.be.lengthOf(2)
    expect(posts2[0].data).to.eql('world')

    const posts3 = await cores['core1'].all()
    expect(posts3).to.be.lengthOf(2)
    expect(posts3[0].data).to.eql('world')

    // remove second core as a writer, make a post on second
    const core2_writer_key = await cores['core2'].getWriterKey()
    await cores['core1'].removeWriter({ key: core2_writer_key })
    await cores['core2'].post({ text: '!!', user: 'foobar' })
    await sleep(100)
    const posts4 = await cores['core2'].all()
    expect(posts4).to.be.lengthOf(3)
    expect(posts4[0].data).to.eql('!!')

    // verify it doesn't replicate
    const posts5 = await cores['core1'].all()
    expect(posts5).to.be.lengthOf(1)
  }).timeout(30000)

  step('should create an encrypted core', async () => {
    cores['core_encrypted'] = await Core({
      config: {
        address: 'enc-test',
        encryption_key: default_config.keys.index,
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
      writers: [],
      indexes: [],
      private: false,
      storage_prefix: 'test',
    }
    config_wrong_pass.writers = keys1.writers
    config_wrong_pass.indexes = keys1.indexes

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
    expect(posts).to.be.lengthOf(0)
    // expect(posts[0].data).to.not.eql('hello')
  }).timeout(30000)

  step('should not allow private core to be connected', async () => {
    cores['core_private'] = await Core({
      config: {
        address: 'private-test',
        encryption_key: default_config.keys.index,
        private: true,
        storage_prefix: 'test',
      },
      app: Apps['chat'],
    })
    try {
      await cores['core_private'].connect(true)
    } catch (e) {
      expect(e.message).to.eq('ACCESS DENIED - PRIVATE CORE')
    }
  })
})
