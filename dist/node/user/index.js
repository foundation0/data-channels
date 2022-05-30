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
class UserManagerClass {
    constructor() {
        this.AuthApp = null;
    }
    async init() {
        const self = this;
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
            await new Promise((resolve) => (ifr.onload = resolve));
            self.AuthApp = Comlink.wrap(Comlink.windowEndpoint(ifr.contentWindow));
            const pong = await self.AuthApp.ping();
            if (!pong)
                throw new Error(`communication with auth app failed`);
        }
        else
            throw new Error(`couldn't initialize auth app`);
    }
    async authenticate() {
        const popup = window.open(bbconfig_1.default.user.auth_app_url, 'auth-app', 'width=500,height=300');
        if (popup) {
            return new Promise((resolve, reject) => {
                function authenticated(is_authenticated) {
                    if (is_authenticated) {
                        console.log('authenticated');
                        resolve(true);
                    }
                    else
                        reject(`couldn't authenticate`);
                }
                Comlink.expose(authenticated, Comlink.windowEndpoint(popup));
            });
        }
        else
            throw new Error(`couldn't open auth app`);
    }
    async isAuthenticated() {
        const self = this;
        if (!self.AuthApp)
            await self.init();
        if (self.AuthApp)
            return self.AuthApp.isAuthenticated();
        else
            throw new Error(`no auth app available`);
    }
}
async function UserManager() {
    const AM = new UserManagerClass();
    await AM.init();
    return AM;
}
exports.default = UserManager;
//# sourceMappingURL=index.js.map