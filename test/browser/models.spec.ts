import { test, expect } from '@playwright/test'
import DataModel, { OwnerOnly, AppendOnly } from '../../models'
import { sign, keyPair, buf2hex, getIdFromPublicKey, createHash } from '@backbonedao/crypto'
import { pack } from 'msgpackr'
// user.authenticate is available and adds id with mockup bridge methods

function createGlobalUser() {
  const id = keyPair()
  global.backbone = {
    user: async () => {
      global.backbone.id = {
        signObject: async ({ hash }) => {
          const signature = sign(hash, id.secretKey)
          return signature
        },
        getId: async () => {
          return getIdFromPublicKey(id.publicKey)
        },
        isAuthenticated: async () => {
          return true
        },
      }
    },
  }
  return id
}

test.describe('Models', async () => {
  test('Create new model from new and serialized data', async () => {
    const M = DataModel(
      {
        username: String,
        password: String,
      },
      { disable_owneronly: true, _debug: { app_version: '0.1.0' } },
      {}
    )
    const m = await M({ username: 'jensen', password: 'decentralizationftw' })
    const d = m.toJSON()
    const m2 = await M(d)
    expect(m2.toJSON()).toEqual(m.toJSON())
  })

  test('OwnerOnly', async () => {
    const id = keyPair()
    const data = { foo: 'bar' }
    const signature = sign(JSON.stringify(data), id.secretKey)
    const M = DataModel(
      {
        text1: OwnerOnly,
        text2: String,
      },
      { disable_owneronly: true },
      {}
    )
    const m: any = await M({
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
    const M = DataModel(
      {
        arr: AppendOnly([
          {
            text: String,
          },
        ]),
      },
      { disable_owneronly: true },
      {}
    )
    const m = await M({ arr: [{ text: 'foo' }] })

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

  test('Migrations', async () => {
    const migrations = {
      '0.1.1': {
        up: (data) => {
          data['user-name'] = data.username
          delete data.username
          return data
        },
        down: (data) => {
          data['username'] = data['user-name']
          delete data['user-name']
          return data
        },
      },
      '0.1.2': {
        up: (data) => {
          data['user_name'] = data['user-name']
          delete data['user-name']
          return data
        },
        down: (data) => {
          data['user-name'] = data['user_name']
          delete data['user_name']
          return data
        },
      },
    }

    const Mv010 = DataModel(
      {
        username: String,
        password: String,
      },
      { disable_owneronly: true, _debug: { app_version: '0.1.0' } },
      migrations
    )
    const dat = { username: 'jensen', password: 'decentralizationftw' }
    const m010 = await Mv010(dat)
    expect(m010.username).toEqual(dat.username)
    expect(m010.password).toEqual(dat.password)
    expect(m010._meta.version).toEqual('0.1.0')

    const Mv012 = DataModel(
      {
        user_name: String,
        password: String,
      },
      { disable_owneronly: true, _debug: { app_version: '0.1.2' } },
      migrations
    )
    const m012 = await Mv012(m010.toJSON())
    expect(m012.user_name).toEqual(dat.username)
    expect(m012.username).toBeFalsy()
    expect(m012._meta.version).toEqual('0.1.2')

    const Mv011 = DataModel(
      {
        'user-name': String,
        password: String,
      },
      { disable_owneronly: true, _debug: { app_version: '0.1.1' } },
      migrations
    )
    const m011 = await Mv011(m012.toJSON())
    expect(m011['user-name']).toEqual(dat.username)
    expect(m011.user_name).toBeFalsy()
    expect(m011._meta.version).toEqual('0.1.1')

    const m010_2 = await Mv010(m012.toJSON())
    expect(m010_2['username']).toEqual(dat.username)
    expect(m010_2['user-name']).toBeFalsy()
    expect(m010_2._meta.version).toEqual('0.1.0')
  })

  test('Object signing and verification', async () => {
    createGlobalUser()
    const dat = { username: 'jensen', password: 'decentralizationftw' }

    // user.authenticate is not available
    const M1 = DataModel(
      {
        username: String,
        password: String,
      },
      { _debug: { app_version: '0.1.0' } },
      {}
    )

    try {
      const m1 = await M1(dat)
      expect(m1).toBeFalsy()
    } catch (e) {
      expect(e).toBeTruthy()
    }

    const M2 = DataModel(
      {
        username: String,
        password: String,
      },
      { _debug: { app_version: '0.1.0' } },
      {}
    )
    const m2 = await M2(dat)
    expect(m2._meta.unsigned).toBeUndefined()
    m2.username = 'foo'
    expect(m2._meta.unsigned).toBeTruthy()
    await m2.sign()
    expect(m2._meta.unsigned).toBeUndefined()
  })
})

test(`Can't modify somebody else's object`, async () => {
  const Test = DataModel(
    {
      username: String,
      password: String,
    },
    { _debug: { app_version: '0.1.0' } },
    {}
  )
  const id1 = createGlobalUser()
  const dat = { username: 'jensen', password: 'decentralizationftw' }
  const d1 = await Test(dat)

  // let d1 = await M1(dat)
  expect(d1).toBeTruthy()
  expect(d1._meta.unsigned).toBeUndefined()

  const id2 = createGlobalUser()

  let d2 = await Test(d1)

  // expect(d2._meta.unsigned).toBeTruthy()
  try {
    d2.username = 'foo'
    expect(d2.username).toEqual('decentralized') // we should never reach this
  } catch (error) {
    expect(error).toBeTruthy()
  }
})
