import { test, expect } from "@playwright/test"
import { encrypt, decrypt, securePassword, verifyPassword } from '../common/crypto'

describe('Crypto', () => {
  it('should encrypt and decrypt a data package from string, object and buffer', () => {
    let key: string = '0x6261636b626f6e653a2f2f696e646578'
    let data: string | Buffer | object
    let encrypted_data: object
    let decrypted_data: string | Buffer | object

    // object
    data = { hello: 'world', foo: Buffer.from('bar') }
    encrypted_data = encrypt({ key, data })
    expect(encrypted_data).to.have.all.keys(['cipher', 'nonce'])
    decrypted_data = decrypt({
      key, cipher: Buffer.alloc(0),
      nonce: '', ...encrypted_data
    })
    expect(decrypted_data).to.be.a('object')
    expect(decrypted_data).to.deep.equal(data)

    // buffer
    data = Buffer.from('hello')
    encrypted_data = encrypt({ key, data })
    expect(encrypted_data).to.have.all.keys(['cipher', 'nonce'])
    decrypted_data = decrypt({
      key,
      cipher: Buffer.alloc(0),
      nonce: '', ...encrypted_data,
    })
    expect(Buffer.isBuffer(decrypted_data)).to.true
    expect(decrypted_data).to.deep.equal(data)

    // object
    data = 'hello'
    encrypted_data = encrypt({ key, data })
    expect(encrypted_data).to.have.all.keys(['cipher', 'nonce'])
    decrypted_data = decrypt({
      key,
      cipher: Buffer.alloc(0),
      nonce: '', ...encrypted_data
    })
    expect(decrypted_data).to.be.a('string')
    expect(decrypted_data).to.deep.equal(data)
  })

  it('should create & verify secure hashes', () => {
    const password: string = '5up3r53cur3'
    const hash = securePassword(password)
    expect(hash).to.be.lengthOf(256)
    expect(verifyPassword({ hash, password })).to.be.true
  })
})