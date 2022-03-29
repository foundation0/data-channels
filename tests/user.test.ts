import { expect } from 'chai'
import { UserConfig } from '../common/interfaces'
import KeyVault from '../user/keyvault'
import User from '../user'
import fs from 'fs'
import { homedir } from 'os'
import { generatePathAddress, randomStr, verifySignature } from '../common/crypto'
import { getHomedir } from '../common'
import { cleanup } from './helper'
import { step } from 'mocha-steps';
import { v4 } from 'uuid'

describe('User', () => {
  beforeEach(cleanup)
  afterEach(cleanup)

  step('should create and verify keyvault', async () => {
    const username = v4()
    // create new user
    const params: UserConfig = {
      username,
      password: 'f34r157h3m1ndk1ll3r',
      signer_type: 'native',
      new: true,
      reminder: 'fr33d0m',
      pin: "1337"
    }
  
    let user = await User(params)
    expect(user).to.be.a('object')
    //await keyvault.close()
    // login
    const params2: UserConfig = {
      username,
      password: 'f34r157h3m1ndk1ll3r',
      signer_type: 'native',
      pin: "1337"
    }

    const user2 = await User(params2)
    expect(user2).to.be.a('object')
    expect(user2.status).to.equal('active')

    // sign something
    const signature = await user2.signAction({
      password: params2.password,
      action: 'TEST',
      path: ''
    })
    expect(signature).to.be.a('string')

    // get public key
    const public_key = await user2.getPublicKey({
      password: params2.password,
      path: ''
    })

    const is_verified = verifySignature({ public_key, data: 'TEST', signature })
    expect(is_verified).to.be.true

    // add path
    const path_address = await generatePathAddress({ signer_type: 'native', seed: await user2.getSeed(params2.password) })
    const path_data = { path: path_address.path, address: path_address.address, encryption_key: randomStr(32) }
    await user2.addPath(path_data)
    const path_data2 = await user2.getPath(path_data.path)
    expect(path_data.address).to.eql(path_data2.address)
    expect(path_data.encryption_key).to.eql(path_data2.encryption_key)
  })
})