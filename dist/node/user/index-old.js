"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    Object.defineProperty(o, k2, { enumerable: true, get: function() { return m[k]; } });
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const common_1 = require("../common");
const crypto_1 = require("../common/crypto");
const ethers_1 = require("ethers");
const b4a_1 = __importDefault(require("b4a"));
const crypto_2 = require("@backbonedao/crypto");
const core_1 = __importDefault(require("../core"));
const apps_1 = __importDefault(require("../apps"));
const platform_detect_1 = __importDefault(require("platform-detect"));
const bbconfig_1 = __importDefault(require("../bbconfig"));
const Comlink = __importStar(require("comlink"));
class UserClass {
    constructor(user_config) {
        this.user_config = user_config;
        this.username = user_config.username;
        this.status = 'initializing';
        this._CORES = [];
        this.keyvault = null;
        this.init = this.init.bind(this);
        this.getUserObjAddress = this.getUserObjAddress.bind(this);
        this.createUserObject = this.createUserObject.bind(this);
        this.openUserObject = this.openUserObject.bind(this);
        this.authenticate = this.authenticate.bind(this);
        this.getNetworkId = this.getNetworkId.bind(this);
        this.createCore = this.createCore.bind(this);
        this.openCore = this.openCore.bind(this);
    }
    async init(core_config_override) {
        this.getUsername = () => this.username;
        this.status = 'unauthenticated';
    }
    getUserObjAddress(params) {
        return crypto_2.buf2hex(crypto_2.discoveryKey(crypto_2.createHash(crypto_1.securePassword({
            password: b4a_1.default.from(params.password),
            salt: b4a_1.default.from(this.username),
        }))));
    }
    createUserObject(params) {
        const user_obj = {
            reminder: params.reminder,
            enc: crypto_2.encrypt({ key: params.password, data: params.root_pass }),
        };
        return user_obj;
    }
    openUserObject(params) {
        return crypto_2.decrypt({ key: params.password, ...params.enc });
    }
    async authenticate(params) {
        const seed = crypto_2.createHash(params.signature);
        this.wallet = ethers_1.ethers.utils.HDNode.fromSeed(seed);
        const netid = this.wallet.derivePath(`m/44'/60'/0'/0/0`);
        this.network_id = {
            secretKey: netid.privateKey.replace(/0x/, ''),
            publicKey: netid.publicKey.replace(/0x/, ''),
        };
        this.status = 'authenticated';
        const [meta, core] = await this.createCore({ path: '0/1', name: 'keyvault' });
        this.keyvault = core;
    }
    getNetworkId(params) {
        if (!this.wallet)
            throw new Error('NOT AUTHENTICATED');
        return this.network_id;
    }
    async createCore(params) {
        if (!params.name)
            throw new Error('CORE NEEDS NAME');
        const max_path = 2140000000;
        const level1 = params?.path?.split('/')[0] || common_1.getRandomInt(0, max_path);
        const level2 = params?.path?.split('/')[1] || common_1.getRandomInt(0, max_path);
        const path = `m/44'/60'/0'/${level1}/${level2}`;
        const dpath = this.wallet.derivePath(path);
        const core_meta = {
            secretKey: dpath.privateKey.replace(/0x/, ''),
            publicKey: dpath.publicKey.replace(/0x/, ''),
            address: crypto_2.discoveryKey(crypto_2.hex2buf(dpath.publicKey.replace(/0x/, ''))),
            path,
            name: params.name,
        };
        let config = params.core_config || {
            address: crypto_2.buf2hex(core_meta.address),
            private: false,
        };
        this._CORES[config.address] = await this.openCore({ config, app: apps_1.default.keyvalue });
        if (params.path !== '0/0' && params.path !== '0/1') {
            await this.keyvault.set({
                key: `p!${params.path}`,
                value: { a: core_meta.address, n: core_meta.name },
            });
        }
        return [core_meta, this._CORES[config.address]];
    }
    async openCore(params) {
        if (this._CORES[params.config.address])
            return this._CORES[params.config.address];
        const core = await core_1.default(params);
        this._CORES[params.config.address] = core;
        return core;
    }
}
async function initAuthApp() {
    let auth_app_e = document.getElementById('bb-auth-app');
    if (!auth_app_e) {
        auth_app_e = document.createElement('iframe');
        auth_app_e.style.display = 'none';
        auth_app_e.setAttribute('id', 'bb-auth-app');
        auth_app_e.setAttribute('src', bbconfig_1.default.user.auth_app_url);
        document.body.appendChild(auth_app_e);
    }
    const ifr = document.getElementById('bb-auth-app');
    if (ifr) {
        return Comlink.wrap(Comlink.windowEndpoint(ifr.contentWindow));
    }
    else
        throw new Error(`couldn't initialize auth app`);
}
async function openAuthApp() { }
async function onAuthenticated() { }
async function User(user_config, core_config_override) {
    let AUTH_APP = null;
    if (!user_config) {
        if (platform_detect_1.default.browser && typeof window === 'object') {
            const AuthApp = await initAuthApp();
            if (!(await AuthApp.isAuthenticated())) {
                const popup = window.open('http://127.0.0.1:9999/iframe.html', 'auth-app', 'width=500,height=300');
                if (popup) {
                    const auth_promise = new Promise((resolve, reject) => {
                        Comlink.expose((is_authenticated) => {
                            if (is_authenticated)
                                resolve(true);
                            else
                                reject(`couldn't authenticate`);
                        }, Comlink.windowEndpoint(popup));
                    });
                    await auth_promise;
                }
                else
                    throw new Error(`couldn't open auth app`);
            }
            else {
            }
        }
        else {
            throw new Error(`NodeJS authenticated hasn't been implemented yet`);
        }
        return;
    }
    const U = new UserClass(user_config);
    await U.init(core_config_override);
    const API = common_1.registerMethods({
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
    });
    return API;
}
exports.default = User;
//# sourceMappingURL=index-old.js.map