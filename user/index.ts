import * as Comlink from 'comlink'
import Config from '../bbconfig'
import { registerMethods } from '../common'

class IdManagerClass {
  IdApp: { isAuthenticated: Function, registerApp: Function } | null = null

  constructor() {}

  async init(this: IdManagerClass) {
    const self = this
    let auth_app_e = document.getElementById('bb-auth-app')

    // if Id hasn't been initialized, init it
    if (!auth_app_e) {
      auth_app_e = document.createElement('iframe')
      auth_app_e.style.display = 'none'
      auth_app_e.setAttribute('id', 'bb-auth-app')
      auth_app_e.setAttribute('src', Config.user.id_url)
      document.body.appendChild(auth_app_e)
    }

    // establish connection to Id
    const ifr = document.getElementById('bb-auth-app')
    if (ifr) {
      await new Promise((resolve) => (ifr.onload = resolve))
      // @ts-ignore - ts doesn't recognize ifr is iframe
      self.IdApp = Comlink.wrap(Comlink.windowEndpoint(ifr.contentWindow))
      // @ts-ignore - ts doesn't work well with Comlink
      const pong = await self.IdApp.ping()
      if (!pong) throw new Error(`communication with Id failed`)
    } else throw new Error(`couldn't initialize Id`)
  }

  async authenticate(this: IdManagerClass, params: {
    permissions: string[],
    name: string
  }) {
    const self = this
    const popup = window.open(
      Config.user.id_url,
      'auth-app',
      'width=500,height=500'
    )
    if (popup) {
      return new Promise(async (resolve, reject) => {
        function authenticated(is_authenticated) {
          if (is_authenticated) {
            console.log('authenticated')
            resolve(true)
          } else reject(`couldn't authenticate`)
        }
        Comlink.expose(authenticated, Comlink.windowEndpoint(popup))
        // @ts-ignore
        await self.IdApp.registerApp(params)
      })
    } else throw new Error(`couldn't open Id`)
  }

  async isAuthenticated(this: IdManagerClass) {
    if (!this.IdApp) await this.init()
    if (this.IdApp) return this.IdApp.isAuthenticated()
    else throw new Error(`no Id available`)
  }

  async registerApp(this: IdManagerClass, manifest) {
    await this.isAuthenticated()
    if(this.IdApp) return this.IdApp.registerApp(manifest)
    else throw new Error(`no Id available`)
  }
}

async function IdManager() {
  const AM = new IdManagerClass()
  await AM.init()
  // const API = registerMethods({
  //   source: AM,
  //   methods: ['authenticate', 'isAuthenticated', 'init'],
  // })
  return AM
}

export default IdManager
