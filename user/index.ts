import * as Comlink from 'comlink'
import Config from '../bbconfig'
import { registerMethods } from '../common'

class UserManagerClass {
  AuthApp: { isAuthenticated: Function } | null = null

  constructor() {}

  async init(this: UserManagerClass) {
    const self = this
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
      await new Promise((resolve) => (ifr.onload = resolve))
      // @ts-ignore - ts doesn't recognize ifr is iframe
      self.AuthApp = Comlink.wrap(Comlink.windowEndpoint(ifr.contentWindow))
      // @ts-ignore - ts doesn't work well with Comlink
      const pong = await self.AuthApp.ping()
      if (!pong) throw new Error(`communication with auth app failed`)
    } else throw new Error(`couldn't initialize auth app`)
  }

  async authenticate(this: UserManagerClass) {
    const popup = window.open(
      Config.user.auth_app_url,
      'auth-app',
      'width=500,height=300'
    )
    if (popup) {
      return new Promise((resolve, reject) => {
        function authenticated(is_authenticated) {
          if (is_authenticated) {
            console.log('authenticated')
            resolve(true)
          } else reject(`couldn't authenticate`)
        }
        Comlink.expose(authenticated, Comlink.windowEndpoint(popup))
      })
    } else throw new Error(`couldn't open auth app`)
  }

  async isAuthenticated(this: UserManagerClass) {
    const self = this
    if (!self.AuthApp) await self.init()
    if (self.AuthApp) return self.AuthApp.isAuthenticated()
    else throw new Error(`no auth app available`)
  }
}

async function UserManager() {
  const AM = new UserManagerClass()
  await AM.init()
  // const API = registerMethods({
  //   source: AM,
  //   methods: ['authenticate', 'isAuthenticated', 'init'],
  // })
  return AM
}

export default UserManager
