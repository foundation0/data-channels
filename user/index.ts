import { registerMethods } from '../common'
import { UserConfig } from '../common/interfaces'
import KeyVault from './keyvault'

class UserClass {
  private keyvault
  private user_config
  username: string
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
  }
  async init(this: UserClass, core_config_override?) {
    // if type is native, create signer based on keyvault
    // if type is ledger, try to connect to ledger
    this.keyvault = await KeyVault(this.user_config, core_config_override)
    if (this.keyvault.status !== 'active') throw new Error('KEYVAULT INITIALIZATION ERROR')

    // inject KeyVault methods to class
    this.signAction = async (params: { action: string; path?: string; pin?: string }) => {
      // here would be a great place to implement a timelock for password usage
      return this.keyvault.signAction({ ...params, password: this.user_config.password })
    }
    this.getPublicKey = async (params: { path?: string; pin?: string }) => {
      // here would be a great place to implement a timelock for password usage
      return this.keyvault.getPublicKey({ ...params, password: this.user_config.password })
    }

    this.getWallet = async (params: { path?: string; pin?: string }) => {
      // here would be a great place to implement a timelock for password usage
      return this.keyvault.getWallet({ ...params, password: this.user_config.password })
    }

    this.addPath = this.keyvault.addPath
    this.getPath = this.keyvault.getPath
    this.status = this.keyvault.status
    this.getSeed = () => this.keyvault.getSeed(this.user_config.password)
    this.getUsername = () => this.username

    this.generateNewPath = async () => {
      // here would be a great place to implement a timelock for password usage
      return this.keyvault.generateNewPath(this.user_config.password)
    }
  }
}

async function User(user_config: UserConfig, core_config_override?) {
  const U = new UserClass(user_config)
  await U.init(core_config_override)
  const API = registerMethods({
    source: U,
    methods: [
      'status',
      'signAction',
      'getPublicKey',
      'addPath',
      'getPath',
      'getSeed',
      'generateNewPath',
      'getUsername',
      'getWallet',
    ],
  })
  return API
}

export default User
