import bbconfig from '../bbconfig'
import { registerMethods, hash } from '../common'
import {
  createId,
  decrypt,
  encrypt,
  generatePathAddress,
  randomStr,
  sha256,
  sign,
  signLedger,
} from '../common/crypto'
import {
  BackboneConfig,
  EncryptedObject,
  Id,
  UserConfig,
  AuthWrapper,
  KeyVault,
  CoreConfig,
  Path,
} from '../common/interfaces'
import Core from '../core'
import default_config from '../bbconfig'
import Apps from '../apps'

class KeyVaultClass {
  status: 'active' | 'access denied' | 'initializing'
  homedir: string
  path: string
  username: string
  reminder: string
  UserCore

  constructor(params: UserConfig, config_override?: BackboneConfig) {
    this.openKeyVault = this.openKeyVault.bind(this)
    this.signAction = this.signAction.bind(this)
    this.getPublicKey = this.getPublicKey.bind(this)
    this.init = this.init.bind(this)
    this.getSeed = this.getSeed.bind(this)
    this.addPath = this.addPath.bind(this)
    this.getPath = this.getPath.bind(this)
    this.close = this.close.bind(this)
    this.generateNewPath = this.generateNewPath.bind(this)
    this.getWallet = this.getWallet.bind(this)

    this.status = 'initializing'
    // const config: BackboneConfig = { ...bbconfig, ...config_override }
    this.username = params.username
    this.reminder = params.reminder || ''
  }

  async init(params: UserConfig, core_config_override?) {
    const core_config: CoreConfig = {
      address: sha256(this.username),
      encryption_key: default_config.keys.index,
      writers: [],
      indexes: [],
      private: true,
      storage_prefix: hash({ type: 'sha256', data: this.username }),
    }
    this.UserCore = await Core({ config: {...core_config, ...core_config_override }, app: Apps['keyvalue'], })
    const encrypted_auth_wrapper: EncryptedObject = await this.UserCore.get('user!keyvault')

    if (!params?.new && !encrypted_auth_wrapper) {
      // user trying to login but core is empty = non-existing username
      throw new Error('NO SUCH USER ON THIS DEVICE')
    } else if (params?.new && !encrypted_auth_wrapper) {
      // user trying to create new account but core is empty >> create new account
      const user: EncryptedObject = await this.createKeyVaultWrapper({
        password: params.password,
        signer_type: params.signer_type,
      })
      const encrypted_auth_wrapper = this.createAuthWrapper({
        reminder: params.reminder || '',
        user,
      })
      await this.UserCore.set({ key: 'user!keyvault', data: encrypted_auth_wrapper })
      this.status = 'active'
      const keyvault = await this.openKeyVault({ password: params.password })
      return keyvault
    } else {
      // user is trying to login to existing core >> verify password
      const keyvault = await this.openKeyVault({ password: params.password })
      if (!keyvault) this.status = 'access denied'
      else this.status = 'active'
      return keyvault
    }
  }

  async close() {
    return new Promise((resolve, reject) => {
      this.UserCore.close(resolve)
    })
  }

  verifyPin(user_pin: string) {
    const pin = user_pin
    return (user_pin) => pin === user_pin
  }

  createAuthWrapper(params: { reminder: string; user: EncryptedObject }) {
    const auth_wrapper: AuthWrapper = { reminder: params.reminder, user: params.user }

    // encrypt auth wrapper with username
    const encrypted_auth_wrapper: EncryptedObject = encrypt({
      key: this.username,
      data: auth_wrapper,
    })
    return encrypted_auth_wrapper
  }

  async createKeyVaultWrapper(params: { password: string; signer_type: 'native' | 'ledger' }) {
    const keyvault: KeyVault = {
      signer_type: params.signer_type,
      seed: randomStr(32),
    }
    if (params.signer_type === 'ledger') {
      keyvault.verify_nonce = randomStr(32)
      keyvault.verify_signature = await signLedger({ data: keyvault.verify_nonce })
    }
    const encrypted_user_wrapper: EncryptedObject = encrypt({
      key: params.password,
      data: keyvault,
    })

    return encrypted_user_wrapper
  }

  async openKeyVault(params: { password: string }) {
    // if existing, verify password
    let auth_wrapper: EncryptedObject = await this.UserCore.get('user!keyvault')
    if (!auth_wrapper) throw new Error('NO SUCH USER ON THIS DEVICE')

    // console.log(this.username, auth_wrapper)
    let decrypted_auth_wrapper: AuthWrapper = decrypt({ key: this.username, ...auth_wrapper })
    if (decrypted_auth_wrapper?.user) {
      let decrypted_keyvault: KeyVault = decrypt({
        key: params.password,
        ...decrypted_auth_wrapper.user,
      })
      if (typeof decrypted_keyvault?.signer_type === 'string') {
        // save some memory
        return decrypted_keyvault
      } else throw new Error('WRONG PASSWORD')
    } else throw new Error('AUTH WRAPPER DECRYPTION ERROR')
  }

  async updateKeyVault(params: { password: string; keyvault: KeyVault }) {
    const encrypted_user_wrapper: EncryptedObject = encrypt({
      key: params.password,
      data: params.keyvault,
    })
    const encrypted_auth_wrapper = this.createAuthWrapper({
      reminder: this.reminder,
      user: encrypted_user_wrapper,
    })
    await this.UserCore.set( { key: 'user!keyvault', data: encrypted_auth_wrapper })
  }

  async signAction(params: { password: string; action: string; path?: string; pin?: string }) {
    let keyvault = await this.openKeyVault({ password: params.password })
    let action_signature: string = ''
    if (keyvault.signer_type === 'native') {
      // use private key
      if (!keyvault?.seed) throw new Error('NATIVE SIGNACTION NEEDS SEED')
      let id: Id = await createId(keyvault.seed)
      action_signature = await sign({ id, data: params.action })
    }
    if (keyvault.signer_type === 'ledger') {
      // use ledger to sign
      action_signature = await signLedger({ data: params.action, path: params?.path || '' })
    }
    return action_signature
  }

  async getPublicKey(params: { password: string; path?: string; pin?: string }) {
    let keyvault = await this.openKeyVault({ password: params.password })
    if (!keyvault?.seed) throw new Error('NATIVE GETPUBLIC NEEDS SEED')
    let id: Id = await createId(keyvault.seed)
    const public_key = id.publicKey
    return public_key
  }

  async getWallet(params: { password: string; path?: string; pin?: string }) {
    let keyvault = await this.openKeyVault({ password: params.password })
    if (!keyvault?.seed) throw new Error('NATIVE GETPUBLIC NEEDS SEED')
    let id: Id = await createId(keyvault.seed)
    const wallet = id.address
    return wallet
  }

  async getSeed(password: string) {
    let keyvault = await this.openKeyVault({ password })
    return keyvault.seed
  }

  async addPath(params: { path: string; address: string; encryption_key: string }) {
    const path_exists = await this.UserCore.get(`path!${params.path}`)
    if (path_exists) throw new Error('PATH EXISTS')
    const path_data: Path = {
      address: params.address,
      encryption_key: params.encryption_key,
    }
    await this.UserCore.set({ key: `path!${params.path}`, data: path_data })
  }

  async getPath(path: string) {
    return await this.UserCore.get(`path!${path}`)
  }

  async generateNewPath(password: string) {
    let keyvault = await this.openKeyVault({ password })
    return await generatePathAddress({
      signer_type: keyvault.signer_type,
      seed: keyvault.signer_type === 'native' ? keyvault.seed : '',
    })
  }
}

export default async (params: UserConfig, config_override?: BackboneConfig) => {
  const KeyVault = new KeyVaultClass(params)
  await KeyVault.init(params, config_override)
  const API = registerMethods({
    source: KeyVault,
    methods: ['status', 'signAction', 'getPublicKey', 'addPath', 'getPath', 'getSeed', 'close', 'generateNewPath', 'getWallet'],
  })
  return API
}
