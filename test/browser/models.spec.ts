import { test, expect } from '@playwright/test'
import Core from '../../core'
import { CoreConfig } from '../../common/interfaces'
import Model, { OwnerOnly, AppendOnly } from '../../models'
import { sign, keyPair, buf2hex } from '@backbonedao/crypto'

const config_kv: CoreConfig = {
  address: 'test',
  encryption_key: 'test',
  private: true,
  storage: 'ram',
}

const app = {
  API: async (Core, Protocol) => {
    return {
      async get(key: string) {
        const value = await Core.get(key)
        return value || null
      },
      async set(params: { key: string; value: string }) {
        await Protocol({
          type: 'set',
          key: params.key,
          value: params.value,
        })
      },
    }
  },
  Protocol: async (op, Core, Data) => {
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
}

test('Create new model', async () => {
  const model = Model()
  const M = model({
    username: String,
    password: String,
  })
  const m = new M({ username: 'jensen', password: 'decentralizationftw' })
  expect(m instanceof M).toBeTruthy()
})

test('OwnerOnly', async () => {
  const id = keyPair()
  const data = { foo: 'bar' }
  const signature = sign(JSON.stringify(data), id.secretKey)
  const model = Model()
  const M = model({
    text1: OwnerOnly,
    text2: String,
  })
  const m: any = new M({
    text1: { owner: buf2hex(id.publicKey), signature: buf2hex(signature), data },
    text2: 'change me',
  })

  try {
    m.text1.data = 'foo'
  } catch (error) {
    expect(error.message).toBeTruthy()
  }

  const data2 = { foo: 'zzz' }
  const signature2 = buf2hex(sign(JSON.stringify(data2), id.secretKey))
  m.text1 = {
    owner: buf2hex(id.publicKey),
    signature: signature2,
    data: data2,
  }

  m.text2 = 'changed'
})

test('AppendOnly', async () => {
  const model = Model()
  const M = model({
    arr: AppendOnly([
      {
        text: String,
      },
    ]),
  })
  const m = new M({ arr: [{ text: 'foo' }] })

  // only push should work
  // @ts-ignore
  m.arr.push({ text: 'bar' })
  
  // removing an item shouldn't work
  try {
    // @ts-ignore
    m.arr = [{ text: 'foo' }]  
  } catch (error) {
    expect(error).toBeTruthy()
  }

  // replacing all items shouldn't work
  try {
    // @ts-ignore
    m.arr = [{ text: 'foo' }, { text: 'bar' }]  
  } catch (error) {
    expect(error).toBeTruthy()
  }

  // not even manually adding an item to array should works
  try {
    // @ts-ignore
    m.arr = [{ text: 'foo' }, { text: 'bar' }, { text: 'zzz' }]  
  } catch (error) {
    expect(error).toBeTruthy()
  }
})
