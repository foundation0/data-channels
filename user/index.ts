import * as Comlink from 'comlink'
import Config from '../bbconfig'
import { error, emit } from '../common'
import { buf2hex } from '@foundation0/crypto'

class IdManagerClass {
  IdApp: any

  constructor() {}

  async init(this: IdManagerClass) {
    const self = this
    let auth_app_e = document.getElementById('dc-auth-app')

    // if Id hasn't been initialized, init it
    if (!auth_app_e) {
      auth_app_e = document.createElement('iframe')
      auth_app_e.style.display = 'none'
      auth_app_e.setAttribute('id', 'dc-auth-app')
      auth_app_e.setAttribute('src', Config.user.id_url)
      // auth_app_e.setAttribute('sandbox', 'allow-popups allow-scripts')
      document.body.appendChild(auth_app_e)

      const auth_app_overlay = document.createElement('div')
      auth_app_overlay.style.display = 'none'
      auth_app_overlay.setAttribute('id', 'dc-auth-overlay')
      auth_app_overlay.setAttribute(
        'style',
        `
        background: #00000080;
        position: absolute;
        top: 0;
        bottom: 0;
        left: 0;
        right: 0;
        z-index: 100;
        backdrop-filter: blur(2px);
        display: none;
        opacity: 0%;
        align-items: center;
        justify-content: center;
        `
      )
      auth_app_overlay.innerHTML = `<div style=''>
        <div id="dc-auth-overlay-default-msg">Application requires you to authenticate.<br>Stand by, opening DataChannels Id...</div>
        <div id="dc-auth-overlay-msg"></div>
        <div id="dc-auth-overlay-notice"><br><br>
          Your browser may block the popup. In that case, you'll need to manually allow it.
        </div>
        <div id="dc-auth-overlay-close" style="display: none">Close</div> 
      </div>`
      document.body.appendChild(auth_app_overlay)
      openAuthOverlay()
    }

    // establish connection to Id
    const ifr = document.getElementById('dc-auth-app')
    if (ifr) {
      await new Promise((resolve) => (ifr.onload = resolve))
      // @ts-ignore - ts doesn't recognize ifr is iframe
      self.IdApp = Comlink.wrap(Comlink.windowEndpoint(ifr.contentWindow))
      // @ts-ignore - ts doesn't work well with Comlink
      const pong = await self.IdApp.ping()
      if (!pong) return error(`communication with Id failed`)
    } else return error(`couldn't initialize Id`)
  }

  async authenticate(
    this: IdManagerClass,
    params: {
      permissions: string[]
      name: string
      address: string
    }
  ) {
    const self = this

    openAuthOverlay()
    const popup = window.open(Config.user.id_url, 'auth-app', 'width=500,height=500')

    let is_authenticated = false
    const is_authenticated_check = setInterval(function() {
      // if popup is closed and we didn't get authenticated function, something went wrong
      if (!popup || popup.closed || typeof popup.closed == 'undefined' && !is_authenticated) {
        msgAuthOverlay({
          msg: 'Authentication failed :(',
          next: () => {
            setTimeout(() => {
              closeAuthOverlay()
            }, 2000)
          },
        })
        clearInterval(is_authenticated_check)
      }
    }, 100)

    if (!popup || popup.closed || typeof popup.closed == 'undefined') {
      msgAuthOverlay({
        msg: 'Your browser has blocked the popup. Please allow popups for this page and try again.',
        show_close: true,
      })
    } else if (popup) {
      return new Promise(async (resolve, reject) => {
        function authenticated(is_authenticated) {
          
          clearInterval(is_authenticated_check)

          if (is_authenticated) {
            emit({ ch: 'id', msg: 'authentication successful', event: 'id:authenticated'} )
            msgAuthOverlay({
              msg: 'Authentication successful!',
              next: () => {
                setTimeout(() => {
                  closeAuthOverlay()
                }, 2000)
              },
            })
            is_authenticated = true
            resolve(true)
          } else {
            msgAuthOverlay({
              msg: 'Authentication failed :(',
              next: () => {
                setTimeout(() => {
                  closeAuthOverlay()
                }, 2000)
              },
            })
            reject(`couldn't authenticate`)
          }
        }
        Comlink.expose(authenticated, Comlink.windowEndpoint(popup))
        // @ts-ignore
        await self.IdApp.registerApp(params)
      })
    } else {
      msgAuthOverlay({
        msg: 'Unknown error in opening DataChannels Id :/',
        next: () => {
          setTimeout(() => {
            closeAuthOverlay()
          }, 2000)
        },
      })
      clearInterval(is_authenticated_check)
      return error(`couldn't open Id`)
    }
  }

  async isAuthenticated(this: IdManagerClass, params?: { address: string }) {
    if (!this.IdApp) await this.init()
    const opts = { address: window['dc'].app_profile?.address, ...params }
    if (this.IdApp) return this.IdApp.isAuthenticated(opts)
    else return error(`no Id available`)
  }

  async registerApp(this: IdManagerClass, manifest) {
    await this.isAuthenticated({ address: manifest.address })
    if (this.IdApp) return this.IdApp.registerApp(manifest)
    else return error(`no Id available`)
  }

  async signObject(this: IdManagerClass, params: { hash: string }) {
    if (this.IdApp)
      return this.IdApp.signObject({
          hash: params.hash,
        address: window['dc'].app_profile?.address,
      })
    else return error(`no Id available`)
  }

  async getId(this: IdManagerClass) {
    if(await this.isAuthenticated({ address: window['dc'].app_profile?.address })) {
      if (this.IdApp) {
        let id = await this.IdApp.getId()
        if(typeof id !== 'string') id = buf2hex(id, true)
        return id
      }
    } else return error(`no Id available`)
  }
}

async function IdManager() {
  const AM = new IdManagerClass()
  await AM.init()
  return AM
}

export default IdManager

// Helper methods for browser's overlay when DataChannels Id is being open

function openAuthOverlay() {
  const notice = document.getElementById('dc-auth-overlay-notice')
  if (notice) notice.style.display = 'block'
  
  const defaultmsg = document.getElementById('dc-auth-overlay-default-msg')
  if (defaultmsg) defaultmsg.style.display = 'block'
  
  const msg = document.getElementById('dc-auth-overlay-msg')
  if (msg) {
    msg.style.display = 'none'
    msg.innerHTML = ''
  }

  const close = document.getElementById('dc-auth-overlay-close')
  if (close) {
    close.onclick = closeAuthOverlay
    close.style.display = 'none'
  }

  const auth_app_overlay = document.getElementById('dc-auth-overlay')
  if (auth_app_overlay?.style.display === 'none') {
    auth_app_overlay.style.display = 'flex'
    auth_app_overlay.style.opacity = '100%'
  }
}

function closeAuthOverlay() {
  const auth_app_overlay = document.getElementById('dc-auth-overlay')
  if (auth_app_overlay?.style) {
    auth_app_overlay.style.display = 'none'
    auth_app_overlay.style.opacity = '0%'
  }
}

function msgAuthOverlay(params: { msg: string; next?: Function; show_close?: boolean }) {
  const notice = document.getElementById('dc-auth-overlay-notice')
  if (notice) notice.style.display = 'none'
  
  const defaultmsg = document.getElementById('dc-auth-overlay-default-msg')
  if (defaultmsg) defaultmsg.style.display = 'none'

  const msg = document.getElementById('dc-auth-overlay-msg')
  if (msg) {
    msg.style.display = 'block'
    msg.innerHTML = params?.msg
  }

  if (params?.show_close) {
    const close = document.getElementById('dc-auth-overlay-close')
    if (close) close.style.display = 'block'
  }

  if(typeof params?.next === 'function') params.next()
}