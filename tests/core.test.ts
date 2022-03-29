import { expect } from 'chai'
import Core from '../core'
import { CoreConfig } from '../common/interfaces'
import { cleanup } from './helper'
import { step } from 'mocha-steps';
import { sleep } from '../common';
import default_config from '../bbconfig'

const network = ['0.0.0.0:50000', '0.0.0.0:50001', '0.0.0.0:50002'] // ['0.0.0.0:3480', '0.0.0.0:5228', '0.0.0.0:16400']

const cores = {}

describe('Core', () => {
  beforeEach(cleanup)
  afterEach(cleanup)
  after(async () => {
    for(const core in cores){
      if(cores[core]) await cores[core].disconnect()
    }
  })

  step('should initialize core', async () => {
    const core = await Core({
      address: 'init-test',
      encryption_key: default_config.keys.index,
      writers: [],
      indexes: [],
      private: false,
      protocol: 'chat',
      storage_prefix: 'test',
      storage: 'ram'
    })
    const keys = await core.getKeys()
    expect(keys).to.include.all.keys(['writers', 'indexes'])
    expect(keys.writers[0]).to.be.lengthOf(64)
    expect(keys.indexes[0]).to.be.lengthOf(64)
  }).timeout(10000)

  step('should create and replicate two cores', async () => {
    // create first core
    cores['core1'] = await Core({
      address: 'replica-test',
      encryption_key: default_config.keys.index,
      writers: [],
      indexes: [],
      private: false,
      protocol: 'chat',
      storage_prefix: 'test',
      storage: 'ram'
    })
    const keys1 = await cores['core1'].getKeys()
    await cores['core1'].connect(true)
    await cores['core1'].post({ text: 'hello', user: 'foobar' })
    await sleep(100)
    // create second core
    let config2: CoreConfig = {
      address: 'replica-test',
      storage_prefix: '2',
      encryption_key: default_config.keys.index,
      writers: [],
      indexes: [],
      private: false,
      protocol: 'chat',
    }
    config2.writers = keys1.writers
    config2.indexes = keys1.indexes
    cores['core2'] = await Core(config2)
    
    // connect and verify replication
    await cores['core2'].connect()  
    await sleep(500)
    let posts = await cores['core2'].all()

    expect(posts).to.be.lengthOf(1)
    expect(posts[0].data).to.eql('hello')

    // add second core as a writer to first one
    const core2_writer_key = await cores['core2'].getWriterKey()
    await cores['core1'].addWriter({ key: core2_writer_key })

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
      address: 'enc-test',
      encryption_key: default_config.keys.index,
      writers: [],
      indexes: [],
      private: false,
      protocol: 'chat',
      storage_prefix: 'test',
    })
    const keys1 = await cores['core_encrypted'].getKeys()
    await cores['core_encrypted'].connect(true)
    await cores['core_encrypted'].post('hello')

    // create second core
    let config_wrong_pass: CoreConfig = {
      address: 'test',
      encryption_key: 'd34db34t',
      writers: [],
      indexes: [],
      private: false,
      protocol: 'chat',
      storage_prefix: 'test',
    }
    config_wrong_pass.writers = keys1.writers
    config_wrong_pass.indexes = keys1.indexes

    cores['core_wrong_pass'] = await Core({
      address: 'enc-test',
      storage_prefix: '2',
      encryption_key: 'd34db34t',
      writers: [],
      indexes: [],
      private: false,
      protocol: 'chat',
    })

    await cores['core_wrong_pass'].connect(true)  
    let posts = await cores['core_wrong_pass'].all()
    expect(posts).to.be.lengthOf(0)
    // expect(posts[0].data).to.not.eql('hello')
  }).timeout(30000)

  step('should not allow private core to be connected', async () => {
    cores['core_private'] = await Core({
      address: 'private-test',
      encryption_key: default_config.keys.index,
      writers: [],
      indexes: [],
      private: true,
      protocol: 'chat',
      storage_prefix: 'test',
    })
    try {
      await cores['core_private'].connect(true)
    } catch(e) {
      expect(e.message).to.eq('ACCESS DENIED - PRIVATE CORE')
    }
  })
})