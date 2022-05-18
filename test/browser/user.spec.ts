import { createHash, hex2buf, sign, buf2hex, keyPair } from '@backbonedao/crypto'
import { test, expect } from '@playwright/test'
import { ethers } from 'ethers'
import { randomStr } from '../../common/crypto'
import { UserConfig } from '../../common/interfaces'
import User from '../../user'

test('username/password', async () => {
  // create user
  const user_cfg: UserConfig = {
    username: 'jensen',
    password: 'f34r157h3M1ndK1ll3R',
    reminder: 'the leading cause of walking dead',
    signer_type: 'native',
  }
  const user = await User(user_cfg)

  // test address generation
  const obj_addr = await user.getUserObjAddress(user_cfg)
  expect(obj_addr).toHaveLength(40)
  expect(obj_addr).toEqual('c932a74993fd81d1fcbf65bf5d84e9320509d0b6')

  // create user object
  const root_pass = randomStr(32)
  const user_obj = await user.createUserObject({ root_pass, ...user_cfg })

  // test opening user object
  const opened_root_pass = await user.openUserObject({
    enc: user_obj.enc,
    password: user_cfg.password,
  })
  expect(opened_root_pass).toEqual(root_pass)
})

test('session', async () => {
  // create wallet from seed
  const wallet = ethers.utils.HDNode.fromSeed(createHash('d34db33f'))

  // create test root pass
  const root_pass = 'b4cKb0n3'

  // sign the root pass
  const signature = sign(root_pass, wallet.privateKey)

  // signature should equal to ref signature
  expect(buf2hex(signature)).toEqual(
    '1cd413ba812b961fac899cfbd0a47bc4d121aedb9ea0d32c4d619db48929566f473095801bbfdf7fc3827b3c53bb5468c5ec39ea476472238573d1a8369c4f3b1c'
  )
})

test('key/path derivation', async () => {
  // create user
  const user_cfg: UserConfig = {
    username: 'jensen',
    password: 'f34r157h3M1ndK1ll3R',
    reminder: 'the leading cause of walking dead',
    signer_type: 'native',
  }
  const user = await User(user_cfg)
  const signature =
    '1cd413ba812b961fac899cfbd0a47bc4d121aedb9ea0d32c4d619db48929566f473095801bbfdf7fc3827b3c53bb5468c5ec39ea476472238573d1a8369c4f3b1c'

  await user.authenticate({
    signature,
  })

  // generate noise keypair
  const nid = await user.getNetworkId()
  expect(nid.secretKey).toEqual('fc1bc9f5d892529ee83086a135c3b8befc1eaa27bd3a87df48aeadbb4fc1f2e0')
  expect(nid.publicKey).toEqual(
    '022cf09da5fdbe0351ac468e6f04078dc91251434dace0c484672d0d876bf0f768'
  )

  // generate path keys
  const [ core_meta ] = await user.createCore({ path: '1/1', name: 'test' })
  expect(core_meta).toEqual({
    secretKey: '79d7c874521c8b25445a4fe3b13ec841cb0337aa1f947f497c9ee195d91e9891',
    publicKey: '03e2f6a20551edc86ab2b2780fec48a4a4f6f7a32b7914dfeb65b5e23d8eceb917',
    path: `m/44'/60'/0'/1/1`,
    name: 'test',
    address: hex2buf('2066d2db2f15ea68f82f902473cff1f2448b2759')
  })
})
