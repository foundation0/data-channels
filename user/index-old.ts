import { getRandomInt, registerMethods } from '../common'
import { securePassword } from '../common/crypto'
import { CoreConfig, UserConfig } from '../common/interfaces'
import { ethers } from 'ethers'
import Buffer from 'b4a'
import { createHash, discoveryKey, buf2hex, encrypt, decrypt, hex2buf } from '@backbonedao/crypto'
import { HDNode } from 'ethers/lib/utils'
import Core from '../core'
import Apps from '../apps'
import platform from 'platform-detect'
import Config from '../bbconfig'
import * as Comlink from 'comlink'

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
  _CORES: any[]

  constructor(user_config: UserConfig) {
    this.user_config = user_config
    this.username = user_config.username
    this.status = 'initializing'
    this._CORES = []
    this.keyvault = null
    this.init = this.init.bind(this)
    this.getUserObjAddress = this.getUserObjAddress.bind(this)
    this.createUserObject = this.createUserObject.bind(this)
    this.openUserObject = this.openUserObject.bind(this)
    this.authenticate = this.authenticate.bind(this)
    this.getNetworkId = this.getNetworkId.bind(this)
    this.createCore = this.createCore.bind(this)
    this.openCore = this.openCore.bind(this)
  }
  async init(this: UserClass, core_config_override?) {
    this.getUsername = () => this.username
    this.status = 'unauthenticated'
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

  async authenticate(this: UserClass, params: { signature: string }) {
    const seed = createHash(params.signature)
    this.wallet = ethers.utils.HDNode.fromSeed(seed)
    const netid = this.wallet.derivePath(`m/44'/60'/0'/0/0`)
    this.network_id = {
      secretKey: netid.privateKey.replace(/0x/, ''),
      publicKey: netid.publicKey.replace(/0x/, ''),
    }
    this.status = 'authenticated'
    // todo: open keyvault

    const [meta, core] = await this.createCore({ path: '0/1', name: 'keyvault' })
    this.keyvault = core
  }

  getNetworkId(this: UserClass, params: { seed: string }) {
    if (!this.wallet) throw new Error('NOT AUTHENTICATED')
    return this.network_id
  }

  async createCore(
    this: UserClass,
    params: { path?: string; name: string; core_config?: CoreConfig }
  ) {
    if (!params.name) throw new Error('CORE NEEDS NAME')
    const max_path = 2140000000
    const level1 = params?.path?.split('/')[0] || getRandomInt(0, max_path)
    const level2 = params?.path?.split('/')[1] || getRandomInt(0, max_path)
    const path = `m/44'/60'/0'/${level1}/${level2}`
    const dpath = this.wallet.derivePath(path)
    const core_meta = {
      secretKey: dpath.privateKey.replace(/0x/, ''),
      publicKey: dpath.publicKey.replace(/0x/, ''),
      address: discoveryKey(hex2buf(dpath.publicKey.replace(/0x/, ''))),
      path,
      name: params.name,
    }
    // if (!params.core_config) return core_meta

    // create core
    let config = params.core_config || {
      address: buf2hex(core_meta.address),
      private: false,
    }
    this._CORES[config.address] = await this.openCore({ config, app: Apps.keyvalue })

    if (params.path !== '0/0' && params.path !== '0/1') {
      // make sure keyvault is open

      // store path to keyvault
      await this.keyvault.set({
        key: `p!${params.path}`,
        value: { a: core_meta.address, n: core_meta.name },
      })
    }
    return [core_meta, this._CORES[config.address]]
  }

  async openCore(
    this: UserClass,
    params: { config: CoreConfig; app: { API: Function; Protocol: Function } }
  ) {
    // see if Core is already open
    if (this._CORES[params.config.address]) return this._CORES[params.config.address]
    // open Core
    const core = await Core(params)
    this._CORES[params.config.address] = core
    return core
  }
}

async function initAuthApp() {
  let auth_app_e = document.getElementById('bb-auth-app')

  // if auth app hasn't been initialized, init it
  if (!auth_app_e) {
    auth_app_e = document.createElement('iframe')
    auth_app_e.style.display = 'none'
    auth_app_e.setAttribute('id', 'bb-auth-app')
    auth_app_e.setAttribute('src', Config.user.auth_app_url)
    document.body.appendChild(auth_app_e)
  }

  // establish connection to auth app
  const ifr = document.getElementById('bb-auth-app')
  if (ifr) {
    // @ts-ignore - ts doesn't recognize ifr is iframe
    return Comlink.wrap(Comlink.windowEndpoint(ifr.contentWindow))
  } else throw new Error(`couldn't initialize auth app`)
}

async function openAuthApp() {}

async function onAuthenticated() {}

async function User(user_config?: UserConfig, core_config_override?) {
  let AUTH_APP = null

  // if user_config doesn't exist, open auth app
  if (!user_config) {
    if (platform.browser && typeof window === 'object') {
      const AuthApp = await initAuthApp()

      // @ts-ignore - ts doesn't work well with comlink
      if (!(await AuthApp.isAuthenticated())) {
        const popup = window.open(
          'http://127.0.0.1:9999/iframe.html',
          'auth-app',
          'width=500,height=300'
        )
        if (popup) {
          const auth_promise = new Promise((resolve, reject) => {
            Comlink.expose((is_authenticated) => {
              if (is_authenticated) resolve(true)
              else reject(`couldn't authenticate`)
            }, Comlink.windowEndpoint(popup))
          })
          await auth_promise
        } else throw new Error(`couldn't open auth app`)
      } else {
        
      }
    } else {
      // TODO: NodeJS auth here
      throw new Error(`NodeJS authenticated hasn't been implemented yet`)
    }
    return
  }
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
      'createCore',
      'openCore',
    ],
  })
  return API
}

export default User
