import { render, h } from 'preact'
import { Component } from 'preact/compat'
import platform from 'platform-detect'
import { ethers } from 'ethers'
import User from '../user'
import { randomStr } from '../common/crypto'
import { pack, unpack } from 'msgpackr'
import { get, set } from 'idb-keyval'
import { hex2buf, sign, buf2hex, createHash } from '@backbonedao/crypto'

async function openKeyvault(params = { address: '', encryption_key: '' }) {
  const core_cfg = {
    config: {
      ...params,
      private: false,
      storage: 'ram',
    },
    app: Backbone.Apps['keyvalue'],
  }
  const keyvault = await Backbone.Core(core_cfg)
  await keyvault.connect()
  return keyvault
}

class WebUI extends Component {
  // Sorry about this lovely piece of code. Someone with time should probably refactor this...
  /*
  wrapper
    container
      register
        username/password
      login
        username/password
          external wallet
          built-in wallet
        direct root pass
          external wallet
          built-in wallet
  */
  constructor(props) {
    super()
    console.log(props)
  }
  default_state = {
    username: '',
    password: '',
    password2: '',
    reminder: '',
    root_pass: '',
    signer_type: 'native',
    view: 'login/usernamepassword',
  }
  db = null
  componentDidMount() {
    this.setState(this.default_state)
  }

  container_style = `
    width: 400px;
    height: 200px;
    margin: 0 auto;
  `
  wrapper_style = `
    width: 100%;
    height: 100%;
    text-align: center;
  `
  link_style = `
    cursor: pointer;
    color: blue;
    display: inline-block;
    margin: 5px 10px;
  `

  onChange(name, val) {
    const s = this.state
    s[name] = val
    this.setState(s)
  }
  onChangeView(view) {
    this.setState({ view })
  }

  async userPassLoginCommon() {
    if (!this.state.username || !this.state.password) return alert('Username or password empty')
    const user_cfg = {
      username: this.state.username,
      password: this.state.password,
    }
    const user = await User(user_cfg)
    const user_obj_address = await user.getUserObjAddress({ password: this.state.password })
    // check cache
    let user_obj_packed = await get(user_obj_address)
    if (!user_obj_packed) {
      // fetch the user object from Inbox
      user_obj_packed = await fetch(`https://inbox.backbonedao.com/0x${user_obj_address}`)
    }
    if (!user_obj_packed) {
      alert(`User doesn't seem to exist, please create a new account`)
      throw new Error('UNKNOWN USER')
    }
    const user_obj = unpack(user_obj_packed)
    if (user_obj) {
      return await user.openUserObject({
        enc: user_obj.enc,
        password: user_cfg.password,
      })
    } else return false
  }
  async onUserPassLoginSubmit() {
    const root_pass = ethers.utils.hashMessage(await this.userPassLoginCommon())
    let signature = ''
    switch (this.state.signer_type) {
      case 'native':
        const hdwallet = ethers.utils.HDNode.fromSeed(hex2buf(root_pass))
        const wallet = new ethers.Wallet(hdwallet.privateKey)
        signature = await wallet.signMessage(root_pass)
        break

      case 'metamask':
        const provider = new ethers.providers.Web3Provider(window.ethereum)
        await provider.send('eth_requestAccounts', [])
        const signer = provider.getSigner()
        signature = await signer.signMessage(root_pass)
        break
      default:
        break
    }
    const keyvault_address = ethers.utils.computeAddress(createHash(createHash(signature)))
    const encryption_key = createHash(signature)
    const Keyvault = await openKeyvault({ address: keyvault_address, encryption_key })
    console.log(Keyvault)
  }

  async onUserPassCreateSubmit() {
    if (!this.state.username || !this.state.password) return alert('Username or password empty')
    if (this.state.password !== this.state.password2) return alert("Passwords don't match")
    const user_cfg = {
      username: this.state.username,
      password: this.state.password,
      reminder: this.state.reminder,
      signer_type: 'native',
    }
    const user = await User(user_cfg)
    const root_pass = randomStr(32)
    this.setState({ root_pass })
    const user_obj_address = await user.getUserObjAddress({ password: this.state.password })
    const user_obj = await user.createUserObject({ root_pass, ...user_cfg })
    await set(user_obj_address, pack(user_obj))
    this.onChangeView('login/usernamepassword')
  }

  top_menu = h('div', {}, [
    h(
      'div',
      {
        style: [this.link_style].join(),
        onClick: () => this.onChangeView('login/usernamepassword'),
      },
      'Login with username'
    ),
    h(
      'div',
      {
        style: [this.link_style].join(),
        onClick: () => this.onChangeView('login/rootpass'),
      },
      'Login with secret key'
    ),
  ])

  bottom_menu = h('div', {}, [
    h(
      'div',
      {
        style: [this.link_style].join(),
        onClick: () => this.onChangeView('create/usernamepassword'),
      },
      'Create new account'
    ),
    h(
      'div',
      {
        style: [this.link_style].join(),
        onClick: () => this.onChangeView('import/usernamepassword'),
      },
      'Sync existing account'
    ),
  ])

  views = {
    'login/usernamepassword': [
      h('h1', null, 'Login with username'),
      this.top_menu,
      h('input', {
        placeholder: 'username',
        type: 'text',
        onChange: (e) => this.onChange('username', e.target.value),
      }),
      h('br'),
      h('input', {
        placeholder: 'password',
        type: 'password',
        onChange: (e) => this.onChange('password', e.target.value),
      }),
      h('br'),
      h(
        'button',
        {
          type: 'submit',
          onClick: (e) => this.onUserPassLoginSubmit(),
        },
        'Login'
      ),
      h('br'),
      this.bottom_menu,
    ],
    'login/rootpass': [
      h('h1', null, 'Login with secret key'),
      this.top_menu,
      h('input', {
        placeholder: 'secret key',
        type: 'password',
        onChange: (e) => this.onChange('secretkey', e.target.value),
      }),
      h('br'),
      h(
        'button',
        {
          type: 'submit',
          onClick: (e) => this.onRootPassLoginSubmit(),
        },
        'Login'
      ),
      h('br'),
      this.bottom_menu,
    ],
    'create/usernamepassword': [
      h('h1', null, 'Create new account'),
      this.top_menu,
      h('input', {
        placeholder: 'username',
        type: 'text',
        onChange: (e) => this.onChange('username', e.target.value),
      }),
      h('br'),
      h('input', {
        placeholder: 'password',
        type: 'password',
        onChange: (e) => this.onChange('password', e.target.value),
      }),
      h('br'),
      h('input', {
        placeholder: 'confirm password',
        type: 'password',
        onChange: (e) => this.onChange('password2', e.target.value),
      }),
      h('br'),
      h('input', {
        placeholder: 'reminder',
        type: 'text',
        onChange: (e) => this.onChange('reminder', e.target.value),
      }),
      h('br'),
      h(
        'button',
        {
          type: 'submit',
          onClick: (e) => this.onUserPassCreateSubmit(),
        },
        'Create account'
      ),
      h('br'),
      this.bottom_menu,
    ],
    'import/usernamepassword': [
      h('h1', null, 'Sync existing account'),
      this.top_menu,
      h('input', {
        placeholder: 'root_pass',
        type: 'text',
        onChange: (e) => this.onChange('root_pass', e.target.value),
      }),h('br'),
      h('input', {
        placeholder: 'username',
        type: 'text',
        onChange: (e) => this.onChange('username', e.target.value),
      }),
      h('br'),
      h('input', {
        placeholder: 'password',
        type: 'password',
        onChange: (e) => this.onChange('password', e.target.value),
      }),
      h('br'),
      h('input', {
        placeholder: 'confirm password',
        type: 'password',
        onChange: (e) => this.onChange('password2', e.target.value),
      }),
      h('br'),
      h('input', {
        placeholder: 'reminder',
        type: 'text',
        onChange: (e) => this.onChange('reminder', e.target.value),
      }),
      h('br'),
      h(
        'button',
        {
          type: 'submit',
          onClick: (e) => this.onUserPassImportSubmit(),
        },
        'Sync account'
      ),
      h('br'),
      this.bottom_menu,
    ],
  }

  render() {
    return h(
      'div',
      { id: 'auth', className: 'container', style: this.container_style },
      // @ts-ignore
      h('div', { className: 'wrapper', style: this.wrapper_style }, this.views[this.state.view])
    )
  }
}

function initWeb(User) {
  let dom = document.getElementById('backbone')
  if (!dom) {
    const bb_div = document.createElement('div')
    bb_div.setAttribute('id', 'backbone')
    document.body.appendChild(bb_div)
  }

  // @ts-ignore
  render(h(WebUI, { User }), document.getElementById('backbone'))
}

function initCLI() {}

export default async (User) => {
  const self = this
  if (platform.browser) initWeb(User)
  else if (platform.node) initCLI()
  else throw new Error('UNSUPPORTED PLATFORM')

  // return function that starts auth flow
  async function auth() {
    // if auth successful, return relevant functions
    return {
      logout: async () => {
        localStorage.removeItem('backbone://auth')
        return auth
      },
    }
  }
  return auth
}
