import { test, expect } from '@playwright/test'
import Core from '../../core'
import { CoreConfig } from '../../common/interfaces'
import { cleanup } from '../helper'
import default_config from '../../bbconfig'
import Apps from '../../apps'
// import { createStore } from 'idb-keyval'

const config_kv: CoreConfig = {
  address: 'protocol-kv',
  encryption_key: default_config.keys.index,
  writers: [],
  trusted_peers: [],
  private: true,
  storage: 'ram',
  storage_prefix: 'test',
}

test.beforeEach(cleanup)
test.afterEach(cleanup)

test('Apps', async () => {
  // const idsStore = createStore("ids", "backbone")
  expect(window).toBeTruthy()
  const core = await Core({ config: config_kv, app: Apps['keyvalue'] })

  await core.set({ key: 'key', value: 'value' })
  expect(await core.get('key')).toEqual('value')

  await core.set({ key: 'key2', value: 'value2' })
  expect(await core.get('key')).toEqual('value')
  expect(await core.get('key2')).toEqual('value2')

  await core.del('key')
  expect(await core.get('key')).toBeFalsy()
  expect(await core.get('key2')).toEqual('value2')
})
