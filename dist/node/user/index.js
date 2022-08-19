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
const Comlink = __importStar(require("comlink"));
const bbconfig_1 = __importDefault(require("../bbconfig"));
const common_1 = require("../common");
class IdManagerClass {
    constructor() { }
    async init() {
        const self = this;
        let auth_app_e = document.getElementById('bb-auth-app');
        if (!auth_app_e) {
            auth_app_e = document.createElement('iframe');
            auth_app_e.style.display = 'none';
            auth_app_e.setAttribute('id', 'bb-auth-app');
            auth_app_e.setAttribute('src', bbconfig_1.default.user.id_url);
            document.body.appendChild(auth_app_e);
            const auth_app_overlay = document.createElement('div');
            auth_app_overlay.style.display = 'none';
            auth_app_overlay.setAttribute('id', 'bb-auth-overlay');
            auth_app_overlay.setAttribute('style', `
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
        `);
            auth_app_overlay.innerHTML = `<div style=''>
        <div id="bb-auth-overlay-default-msg">Application requires you to authenticate.<br>Stand by, opening Backbone Id...</div>
        <div id="bb-auth-overlay-msg"></div>
        <div id="bb-auth-overlay-notice"><br><br>
          Your browser may block the popup. In that case, you'll need to manually allow it.
        </div>
        <div id="bb-auth-overlay-close" style="display: none">Close</div> 
      </div>`;
            document.body.appendChild(auth_app_overlay);
            openAuthOverlay();
        }
        const ifr = document.getElementById('bb-auth-app');
        if (ifr) {
            await new Promise((resolve) => (ifr.onload = resolve));
            self.IdApp = Comlink.wrap(Comlink.windowEndpoint(ifr.contentWindow));
            const pong = await self.IdApp.ping();
            if (!pong)
                return common_1.error(`communication with Id failed`);
        }
        else
            return common_1.error(`couldn't initialize Id`);
    }
    async authenticate(params) {
        const self = this;
        openAuthOverlay();
        const popup = window.open(bbconfig_1.default.user.id_url, 'auth-app', 'width=500,height=500');
        let is_authenticated = false;
        const is_authenticated_check = setInterval(function () {
            if (!popup || popup.closed || typeof popup.closed == 'undefined' && !is_authenticated) {
                msgAuthOverlay({
                    msg: 'Authentication failed :(',
                    next: () => {
                        setTimeout(() => {
                            closeAuthOverlay();
                        }, 2000);
                    },
                });
                clearInterval(is_authenticated_check);
            }
        }, 100);
        if (!popup || popup.closed || typeof popup.closed == 'undefined') {
            msgAuthOverlay({
                msg: 'Your browser has blocked the popup. Please allow popups for this page and try again.',
                show_close: true,
            });
        }
        else if (popup) {
            return new Promise(async (resolve, reject) => {
                function authenticated(is_authenticated) {
                    clearInterval(is_authenticated_check);
                    if (is_authenticated) {
                        console.log('authenticated');
                        msgAuthOverlay({
                            msg: 'Authentication successful!',
                            next: () => {
                                setTimeout(() => {
                                    closeAuthOverlay();
                                }, 2000);
                            },
                        });
                        is_authenticated = true;
                        resolve(true);
                    }
                    else {
                        msgAuthOverlay({
                            msg: 'Authentication failed :(',
                            next: () => {
                                setTimeout(() => {
                                    closeAuthOverlay();
                                }, 2000);
                            },
                        });
                        reject(`couldn't authenticate`);
                    }
                }
                Comlink.expose(authenticated, Comlink.windowEndpoint(popup));
                await self.IdApp.registerApp(params);
            });
        }
        else {
            msgAuthOverlay({
                msg: 'Unknown error in opening Backbone Id :/',
                next: () => {
                    setTimeout(() => {
                        closeAuthOverlay();
                    }, 2000);
                },
            });
            clearInterval(is_authenticated_check);
            return common_1.error(`couldn't open Id`);
        }
    }
    async isAuthenticated(params) {
        if (!this.IdApp)
            await this.init();
        const opts = { address: window['backbone'].app_profile?.address, ...params };
        if (this.IdApp)
            return this.IdApp.isAuthenticated(opts);
        else
            return common_1.error(`no Id available`);
    }
    async registerApp(manifest) {
        await this.isAuthenticated({ address: manifest.address });
        if (this.IdApp)
            return this.IdApp.registerApp(manifest);
        else
            return common_1.error(`no Id available`);
    }
    async signObject(params) {
        if (this.IdApp)
            return this.IdApp.signObject({
                hash: params.hash,
                address: window['backbone'].app_profile?.address,
            });
        else
            return common_1.error(`no Id available`);
    }
    async getId() {
        if (await this.isAuthenticated({ address: window['backbone'].app_profile?.address })) {
            if (this.IdApp)
                return this.IdApp.getId();
        }
        else
            return common_1.error(`no Id available`);
    }
}
async function IdManager() {
    const AM = new IdManagerClass();
    await AM.init();
    return AM;
}
exports.default = IdManager;
function openAuthOverlay() {
    const notice = document.getElementById('bb-auth-overlay-notice');
    if (notice)
        notice.style.display = 'block';
    const defaultmsg = document.getElementById('bb-auth-overlay-default-msg');
    if (defaultmsg)
        defaultmsg.style.display = 'block';
    const msg = document.getElementById('bb-auth-overlay-msg');
    if (msg) {
        msg.style.display = 'none';
        msg.innerHTML = '';
    }
    const close = document.getElementById('bb-auth-overlay-close');
    if (close) {
        close.onclick = closeAuthOverlay;
        close.style.display = 'none';
    }
    const auth_app_overlay = document.getElementById('bb-auth-overlay');
    if (auth_app_overlay?.style.display === 'none') {
        auth_app_overlay.style.display = 'flex';
        auth_app_overlay.style.opacity = '100%';
    }
}
function closeAuthOverlay() {
    const auth_app_overlay = document.getElementById('bb-auth-overlay');
    if (auth_app_overlay?.style) {
        auth_app_overlay.style.display = 'none';
        auth_app_overlay.style.opacity = '0%';
    }
}
function msgAuthOverlay(params) {
    const notice = document.getElementById('bb-auth-overlay-notice');
    if (notice)
        notice.style.display = 'none';
    const defaultmsg = document.getElementById('bb-auth-overlay-default-msg');
    if (defaultmsg)
        defaultmsg.style.display = 'none';
    const msg = document.getElementById('bb-auth-overlay-msg');
    if (msg) {
        msg.style.display = 'block';
        msg.innerHTML = params?.msg;
    }
    if (params?.show_close) {
        const close = document.getElementById('bb-auth-overlay-close');
        if (close)
            close.style.display = 'block';
    }
    if (typeof params?.next === 'function')
        params.next();
}
//# sourceMappingURL=index.js.map