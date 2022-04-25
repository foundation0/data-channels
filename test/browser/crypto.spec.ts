import { test, expect } from "@playwright/test"
import { encrypt, decrypt, securePassword, verifyPassword } from '../../common/crypto'


  test('should encrypt and decrypt a data package from string, object and buffer', () => {
    let key: string = '0x6261636b626f6e653a2f2f696e646578'
    let data: string | Buffer | object
    let encrypted_data: object
    let decrypted_data: string | Buffer | object

    // object
    data = { hello: 'world', foo: Buffer.from('bar') }
    encrypted_data = encrypt({ key, data })
    expect(encrypted_data).toHaveProperty('cipher')
    expect(encrypted_data).toHaveProperty('nonce')
    decrypted_data = decrypt({
      key, cipher: Buffer.alloc(0),
      nonce: '', ...encrypted_data
    })
    expect(typeof decrypted_data).toEqual('object')
    expect(decrypted_data).toEqual(data)

    // buffer
    data = Buffer.from('hello')
    encrypted_data = encrypt({ key, data })
    expect(encrypted_data).toHaveProperty('cipher')
    expect(encrypted_data).toHaveProperty('nonce')
    decrypted_data = decrypt({
      key,
      cipher: Buffer.alloc(0),
      nonce: '', ...encrypted_data,
    })
    expect(Buffer.isBuffer(decrypted_data)).toBeTruthy()
    expect(decrypted_data).toEqual(data)

    // object
    data = 'hello'
    encrypted_data = encrypt({ key, data })
    expect(encrypted_data).toHaveProperty('cipher')
    expect(encrypted_data).toHaveProperty('nonce')
    decrypted_data = decrypt({
      key,
      cipher: Buffer.alloc(0),
      nonce: '', ...encrypted_data
    })
    expect(typeof decrypted_data).toEqual('string')
    expect(decrypted_data).toEqual(data)
  })

  test('should create & verify secure hashes', () => {
    const password: string = '5up3r53cur3'
    const hash = securePassword(password)
    expect(hash).toHaveLength(256)
    expect(verifyPassword({ hash, password })).toBeTruthy()
  })
