import { getRandomInt, registerMethods } from '../common'
import { securePassword } from '../common/crypto'
import { CoreConfig, UserConfig } from '../common/interfaces'
import { ethers } from 'ethers'
import KeyVault from './keyvault'
import Buffer from 'b4a'
import { createHash, discoveryKey, buf2hex, encrypt, decrypt, hex2buf } from '@backbonedao/crypto'
import { HDNode } from 'ethers/lib/utils'

class UserClass {
  private keyvault
  private user_config
  username: string
  wallet: HDNode
  network_id: { secretKey: string; publicKey: string }
  status: string
  signAction: Function
  getPublicKey: Function
  addPath: Function
  getPath: Function
  getSeed: Function
  generateNewPath: Function
  getUsername: Function
  getWallet: Function

  constructor(user_config: UserConfig) {
    this.user_config = user_config
    this.username = user_config.username

    this.init = this.init.bind(this)
    this.getUserObjAddress = this.getUserObjAddress.bind(this)
    this.createUserObject = this.createUserObject.bind(this)
    this.openUserObject = this.openUserObject.bind(this)
    this.authenticate = this.authenticate.bind(this)
    this.getNetworkId = this.getNetworkId.bind(this)
    this.createNewCore = this.createNewCore.bind(this)
  }
  async init(this: UserClass, core_config_override?) {
    // if type is native, create signer based on keyvault
    // if type is ledger, try to connect to ledger

    // this.keyvault = await KeyVault(this.user_config, core_config_override)
    // if (this.keyvault.status !== 'active') throw new Error('KEYVAULT INITIALIZATION ERROR')

    // this.addPath = this.keyvault.addPath
    // this.getPath = this.keyvault.getPath
    // this.status = this.keyvault.status
    this.getSeed = () => this.keyvault.getSeed(this.user_config.password)
    this.getUsername = () => this.username
    this.generateNewPath = async () => {
      // here would be a great place to implement a timelock for password usage
      return this.keyvault.generateNewPath(this.user_config.password)
    }
  }

  getUserObjAddress(this: UserClass, params: { password: string }) {
    return buf2hex(
      discoveryKey(
        createHash(
          securePassword({
            password: Buffer.from(params.password),
            salt: Buffer.from(this.username),
          })
        )
      )
    )
  }

  createUserObject(
    this: UserClass,
    params: { root_pass: string; password: string; reminder: string }
  ) {
    const user_obj = {
      reminder: params.reminder,
      enc: encrypt({ key: params.password, data: params.root_pass }),
    }
    return user_obj
  }

  openUserObject(this: UserClass, params: { enc: object; password: string }) {
    return decrypt({ key: params.password, ...params.enc })
  }

  authenticate(this: UserClass, params: { signature: string }) {
    this.wallet = ethers.utils.HDNode.fromSeed(createHash(params.signature))
    const netid = this.wallet.derivePath(`m/44'/60'/0'/0/0`)
    this.network_id = {
      secretKey: netid.privateKey.replace(/0x/, ''),
      publicKey: netid.publicKey.replace(/0x/, ''),
    }
    // todo: open keyvault
  }

  getNetworkId(this: UserClass, params: { seed: string }) {
    if (!this.wallet) throw new Error('NOT AUTHENTICATED')
    return this.network_id
  }

  createNewCore(this: UserClass, params: { path?: string; name: string; core?: CoreConfig }) {
    if (!params.name) throw new Error('CORE NEEDS NAME')
    const max_path = 2140000000
    const level1 = params?.path?.split('/')[0] || getRandomInt(0, max_path)
    const level2 = params?.path?.split('/')[1] || getRandomInt(0, max_path)
    const path = `m/44'/60'/0'/${level1}/${level2}`
    const dpath = this.wallet.derivePath(path)
    const core_meta = {
      secretKey: dpath.privateKey.replace(/0x/, ''),
      publicKey: dpath.publicKey.replace(/0x/, ''),
      path,
      name: params.name
    }
    if(!params.core) return core_meta

    // create core

    // save path to keyvault
  }
}

async function User(user_config: UserConfig, core_config_override?) {
  const U = new UserClass(user_config)
  await U.init(core_config_override)
  const API = registerMethods({
    source: U,
    methods: [
      'status',
      'getUsername',
      'getWallet',
      'getUserObjAddress',
      'createUserObject',
      'openUserObject',
      'authenticate',
      'getNetworkId',
      'createNewCore'
    ],
  })
  return API
}

export default User
