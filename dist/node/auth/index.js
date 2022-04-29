"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const preact_1 = require("preact");
const compat_1 = require("preact/compat");
const platform_detect_1 = __importDefault(require("platform-detect"));
const ethers_1 = require("ethers");
const user_1 = __importDefault(require("../user"));
const crypto_1 = require("../common/crypto");
const msgpackr_1 = require("msgpackr");
const idb_keyval_1 = require("idb-keyval");
const crypto_2 = require("@backbonedao/crypto");
async function openKeyvault(params = { address: '', encryption_key: '' }) {
    const core_cfg = {
        config: {
            ...params,
            private: false,
            storage: 'ram',
        },
        app: Backbone.Apps['keyvalue'],
    };
    const keyvault = await Backbone.Core(core_cfg);
    await keyvault.connect();
    return keyvault;
}
class WebUI extends compat_1.Component {
    constructor(props) {
        super();
        this.default_state = {
            username: '',
            password: '',
            password2: '',
            reminder: '',
            root_pass: '',
            signer_type: 'native',
            view: 'login/usernamepassword',
        };
        this.db = null;
        this.container_style = `
    width: 400px;
    height: 200px;
    margin: 0 auto;
  `;
        this.wrapper_style = `
    width: 100%;
    height: 100%;
    text-align: center;
  `;
        this.link_style = `
    cursor: pointer;
    color: blue;
    display: inline-block;
    margin: 5px 10px;
  `;
        this.top_menu = preact_1.h('div', {}, [
            preact_1.h('div', {
                style: [this.link_style].join(),
                onClick: () => this.onChangeView('login/usernamepassword'),
            }, 'Login with username'),
            preact_1.h('div', {
                style: [this.link_style].join(),
                onClick: () => this.onChangeView('login/rootpass'),
            }, 'Login with secret key'),
        ]);
        this.bottom_menu = preact_1.h('div', {}, [
            preact_1.h('div', {
                style: [this.link_style].join(),
                onClick: () => this.onChangeView('create/usernamepassword'),
            }, 'Create new account'),
            preact_1.h('div', {
                style: [this.link_style].join(),
                onClick: () => this.onChangeView('import/usernamepassword'),
            }, 'Sync existing account'),
        ]);
        this.views = {
            'login/usernamepassword': [
                preact_1.h('h1', null, 'Login with username'),
                this.top_menu,
                preact_1.h('input', {
                    placeholder: 'username',
                    type: 'text',
                    onChange: (e) => this.onChange('username', e.target.value),
                }),
                preact_1.h('br'),
                preact_1.h('input', {
                    placeholder: 'password',
                    type: 'password',
                    onChange: (e) => this.onChange('password', e.target.value),
                }),
                preact_1.h('br'),
                preact_1.h('button', {
                    type: 'submit',
                    onClick: (e) => this.onUserPassLoginSubmit(),
                }, 'Login'),
                preact_1.h('br'),
                this.bottom_menu,
            ],
            'login/rootpass': [
                preact_1.h('h1', null, 'Login with secret key'),
                this.top_menu,
                preact_1.h('input', {
                    placeholder: 'secret key',
                    type: 'password',
                    onChange: (e) => this.onChange('secretkey', e.target.value),
                }),
                preact_1.h('br'),
                preact_1.h('button', {
                    type: 'submit',
                    onClick: (e) => this.onRootPassLoginSubmit(),
                }, 'Login'),
                preact_1.h('br'),
                this.bottom_menu,
            ],
            'create/usernamepassword': [
                preact_1.h('h1', null, 'Create new account'),
                this.top_menu,
                preact_1.h('input', {
                    placeholder: 'username',
                    type: 'text',
                    onChange: (e) => this.onChange('username', e.target.value),
                }),
                preact_1.h('br'),
                preact_1.h('input', {
                    placeholder: 'password',
                    type: 'password',
                    onChange: (e) => this.onChange('password', e.target.value),
                }),
                preact_1.h('br'),
                preact_1.h('input', {
                    placeholder: 'confirm password',
                    type: 'password',
                    onChange: (e) => this.onChange('password2', e.target.value),
                }),
                preact_1.h('br'),
                preact_1.h('input', {
                    placeholder: 'reminder',
                    type: 'text',
                    onChange: (e) => this.onChange('reminder', e.target.value),
                }),
                preact_1.h('br'),
                preact_1.h('button', {
                    type: 'submit',
                    onClick: (e) => this.onUserPassCreateSubmit(),
                }, 'Create account'),
                preact_1.h('br'),
                this.bottom_menu,
            ],
            'import/usernamepassword': [
                preact_1.h('h1', null, 'Sync existing account'),
                this.top_menu,
                preact_1.h('input', {
                    placeholder: 'root_pass',
                    type: 'text',
                    onChange: (e) => this.onChange('root_pass', e.target.value),
                }), preact_1.h('br'),
                preact_1.h('input', {
                    placeholder: 'username',
                    type: 'text',
                    onChange: (e) => this.onChange('username', e.target.value),
                }),
                preact_1.h('br'),
                preact_1.h('input', {
                    placeholder: 'password',
                    type: 'password',
                    onChange: (e) => this.onChange('password', e.target.value),
                }),
                preact_1.h('br'),
                preact_1.h('input', {
                    placeholder: 'confirm password',
                    type: 'password',
                    onChange: (e) => this.onChange('password2', e.target.value),
                }),
                preact_1.h('br'),
                preact_1.h('input', {
                    placeholder: 'reminder',
                    type: 'text',
                    onChange: (e) => this.onChange('reminder', e.target.value),
                }),
                preact_1.h('br'),
                preact_1.h('button', {
                    type: 'submit',
                    onClick: (e) => this.onUserPassImportSubmit(),
                }, 'Sync account'),
                preact_1.h('br'),
                this.bottom_menu,
            ],
        };
        console.log(props);
    }
    componentDidMount() {
        this.setState(this.default_state);
    }
    onChange(name, val) {
        const s = this.state;
        s[name] = val;
        this.setState(s);
    }
    onChangeView(view) {
        this.setState({ view });
    }
    async userPassLoginCommon() {
        if (!this.state.username || !this.state.password)
            return alert('Username or password empty');
        const user_cfg = {
            username: this.state.username,
            password: this.state.password,
        };
        const user = await user_1.default(user_cfg);
        const user_obj_address = await user.getUserObjAddress({ password: this.state.password });
        let user_obj_packed = await idb_keyval_1.get(user_obj_address);
        if (!user_obj_packed) {
            user_obj_packed = await fetch(`https://inbox.backbonedao.com/0x${user_obj_address}`);
        }
        if (!user_obj_packed) {
            alert(`User doesn't seem to exist, please create a new account`);
            throw new Error('UNKNOWN USER');
        }
        const user_obj = msgpackr_1.unpack(user_obj_packed);
        if (user_obj) {
            return await user.openUserObject({
                enc: user_obj.enc,
                password: user_cfg.password,
            });
        }
        else
            return false;
    }
    async onUserPassLoginSubmit() {
        const root_pass = ethers_1.ethers.utils.hashMessage(await this.userPassLoginCommon());
        let signature = '';
        switch (this.state.signer_type) {
            case 'native':
                const hdwallet = ethers_1.ethers.utils.HDNode.fromSeed(crypto_2.hex2buf(root_pass));
                const wallet = new ethers_1.ethers.Wallet(hdwallet.privateKey);
                signature = await wallet.signMessage(root_pass);
                break;
            case 'metamask':
                const provider = new ethers_1.ethers.providers.Web3Provider(window.ethereum);
                await provider.send('eth_requestAccounts', []);
                const signer = provider.getSigner();
                signature = await signer.signMessage(root_pass);
                break;
            default:
                break;
        }
        const keyvault_address = ethers_1.ethers.utils.computeAddress(crypto_2.createHash(crypto_2.createHash(signature)));
        const encryption_key = crypto_2.createHash(signature);
        const Keyvault = await openKeyvault({ address: keyvault_address, encryption_key });
        console.log(Keyvault);
    }
    async onUserPassCreateSubmit() {
        if (!this.state.username || !this.state.password)
            return alert('Username or password empty');
        if (this.state.password !== this.state.password2)
            return alert("Passwords don't match");
        const user_cfg = {
            username: this.state.username,
            password: this.state.password,
            reminder: this.state.reminder,
            signer_type: 'native',
        };
        const user = await user_1.default(user_cfg);
        const root_pass = crypto_1.randomStr(32);
        this.setState({ root_pass });
        const user_obj_address = await user.getUserObjAddress({ password: this.state.password });
        const user_obj = await user.createUserObject({ root_pass, ...user_cfg });
        await idb_keyval_1.set(user_obj_address, msgpackr_1.pack(user_obj));
        this.onChangeView('login/usernamepassword');
    }
    render() {
        return preact_1.h('div', { id: 'auth', className: 'container', style: this.container_style }, preact_1.h('div', { className: 'wrapper', style: this.wrapper_style }, this.views[this.state.view]));
    }
}
function initWeb(User) {
    let dom = document.getElementById('backbone');
    if (!dom) {
        const bb_div = document.createElement('div');
        bb_div.setAttribute('id', 'backbone');
        document.body.appendChild(bb_div);
    }
    preact_1.render(preact_1.h(WebUI, { User }), document.getElementById('backbone'));
}
function initCLI() { }
exports.default = async (User) => {
    const self = this;
    if (platform_detect_1.default.browser)
        initWeb(User);
    else if (platform_detect_1.default.node)
        initCLI();
    else
        throw new Error('UNSUPPORTED PLATFORM');
    async function auth() {
        return {
            logout: async () => {
                localStorage.removeItem('backbone://auth');
                return auth;
            },
        };
    }
    return auth;
};
//# sourceMappingURL=index.js.map