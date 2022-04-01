import { expect } from 'chai'
import Core from '../core'
import { CoreConfig } from '../common/interfaces'
import { cleanup } from './helper'
import default_config from '../bbconfig'
import Apps from '../apps'

const config_kv: CoreConfig = {
  address: 'protocol-kv',
  encryption_key: default_config.keys.index,
  writers: [],
  indexes: [],
  private: true,
  storage: 'ram',
  storage_prefix: 'test',
}

describe('Protocols', () => {
  beforeEach(cleanup)
  afterEach(cleanup)

  it('should have working key/value protocol', async () => {
    const core = await Core({ config: config_kv, app: Apps['keyvalue'] })

    await core.set({ key: 'key', data: 'value' })
    expect(await core.get('key')).to.eq('value')

    await core.set({ key: 'key2', data: 'value2' })
    expect(await core.get('key')).to.eq('value')
    expect(await core.get('key2')).to.eq('value2')

    await core.del('key')
    expect(await core.get('key')).to.be.null
    expect(await core.get('key2')).to.eq('value2')
  })
})
