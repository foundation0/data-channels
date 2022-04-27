"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const common_1 = require("../common");
const crypto_1 = require("../common/crypto");
const core_1 = __importDefault(require("../core"));
const bbconfig_1 = __importDefault(require("../bbconfig"));
const apps_1 = __importDefault(require("../apps"));
class KeyVaultClass {
    constructor(params, config_override) {
        this.openKeyVault = this.openKeyVault.bind(this);
        this.signAction = this.signAction.bind(this);
        this.getPublicKey = this.getPublicKey.bind(this);
        this.init = this.init.bind(this);
        this.getSeed = this.getSeed.bind(this);
        this.addPath = this.addPath.bind(this);
        this.getPath = this.getPath.bind(this);
        this.close = this.close.bind(this);
        this.generateNewPath = this.generateNewPath.bind(this);
        this.getWallet = this.getWallet.bind(this);
        this.status = 'initializing';
        this.username = params.username;
        this.reminder = params.reminder || '';
    }
    async init(params, core_config_override) {
        const core_config = {
            address: crypto_1.sha256(this.username),
            encryption_key: bbconfig_1.default.keys.index,
            writers: [],
            indexes: [],
            private: true,
            storage_prefix: common_1.hash({ type: 'sha256', data: this.username }),
        };
        this.UserCore = await core_1.default({ config: { ...core_config, ...core_config_override }, app: apps_1.default['keyvalue'], });
        const encrypted_auth_wrapper = await this.UserCore.get('user!keyvault');
        if (!params?.new && !encrypted_auth_wrapper) {
            throw new Error('NO SUCH USER ON THIS DEVICE');
        }
        else if (params?.new && !encrypted_auth_wrapper) {
            const user = await this.createKeyVaultWrapper({
                password: params.password,
                signer_type: params.signer_type,
            });
            const encrypted_auth_wrapper = this.createAuthWrapper({
                reminder: params.reminder || '',
                user,
            });
            await this.UserCore.set({ key: 'user!keyvault', value: encrypted_auth_wrapper });
            this.status = 'active';
            const keyvault = await this.openKeyVault({ password: params.password });
            return keyvault;
        }
        else {
            const keyvault = await this.openKeyVault({ password: params.password });
            if (!keyvault)
                this.status = 'access denied';
            else
                this.status = 'active';
            return keyvault;
        }
    }
    async close() {
        return new Promise((resolve, reject) => {
            this.UserCore.close(resolve);
        });
    }
    verifyPin(user_pin) {
        const pin = user_pin;
        return (user_pin) => pin === user_pin;
    }
    createAuthWrapper(params) {
        const auth_wrapper = { reminder: params.reminder, user: params.user };
        const encrypted_auth_wrapper = crypto_1.encrypt({
            key: this.username,
            data: auth_wrapper,
        });
        return encrypted_auth_wrapper;
    }
    async createKeyVaultWrapper(params) {
        const keyvault = {
            signer_type: params.signer_type,
            seed: crypto_1.randomStr(32),
        };
        const encrypted_user_wrapper = crypto_1.encrypt({
            key: params.password,
            data: keyvault,
        });
        return encrypted_user_wrapper;
    }
    async openKeyVault(params) {
        let auth_wrapper = await this.UserCore.get('user!keyvault');
        if (!auth_wrapper)
            throw new Error('NO SUCH USER ON THIS DEVICE');
        let decrypted_auth_wrapper = crypto_1.decrypt({ key: this.username, ...auth_wrapper });
        if (decrypted_auth_wrapper?.user) {
            let decrypted_keyvault = crypto_1.decrypt({
                key: params.password,
                ...decrypted_auth_wrapper.user,
            });
            if (typeof decrypted_keyvault?.signer_type === 'string') {
                return decrypted_keyvault;
            }
            else
                throw new Error('WRONG PASSWORD');
        }
        else
            throw new Error('AUTH WRAPPER DECRYPTION ERROR');
    }
    async updateKeyVault(params) {
        const encrypted_user_wrapper = crypto_1.encrypt({
            key: params.password,
            data: params.keyvault,
        });
        const encrypted_auth_wrapper = this.createAuthWrapper({
            reminder: this.reminder,
            user: encrypted_user_wrapper,
        });
        await this.UserCore.set({ key: 'user!keyvault', value: encrypted_auth_wrapper });
    }
    async signAction(params) {
        let keyvault = await this.openKeyVault({ password: params.password });
        let action_signature = '';
        if (keyvault.signer_type === 'native') {
            if (!keyvault?.seed)
                throw new Error('NATIVE SIGNACTION NEEDS SEED');
            let id = await crypto_1.createId(keyvault.seed);
            action_signature = await crypto_1.sign({ id, data: params.action });
        }
        return action_signature;
    }
    async getPublicKey(params) {
        let keyvault = await this.openKeyVault({ password: params.password });
        if (!keyvault?.seed)
            throw new Error('NATIVE GETPUBLIC NEEDS SEED');
        let id = await crypto_1.createId(keyvault.seed);
        const public_key = id.publicKey;
        return public_key;
    }
    async getWallet(params) {
        let keyvault = await this.openKeyVault({ password: params.password });
        if (!keyvault?.seed)
            throw new Error('NATIVE GETPUBLIC NEEDS SEED');
        let id = await crypto_1.createId(keyvault.seed);
        const wallet = id.address;
        return wallet;
    }
    async getSeed(password) {
        let keyvault = await this.openKeyVault({ password });
        return keyvault.seed;
    }
    async addPath(params) {
        const path_exists = await this.UserCore.get(`path!${params.path}`);
        if (path_exists)
            throw new Error('PATH EXISTS');
        const path_data = {
            address: params.address,
            encryption_key: params.encryption_key,
        };
        await this.UserCore.set({ key: `path!${params.path}`, value: path_data });
    }
    async getPath(path) {
        return await this.UserCore.get(`path!${path}`);
    }
    async generateNewPath(password) {
        let keyvault = await this.openKeyVault({ password });
        return await crypto_1.generatePathAddress({
            signer_type: keyvault.signer_type,
            seed: keyvault.signer_type === 'native' ? keyvault.seed : '',
        });
    }
}
exports.default = async (params, config_override) => {
    const KeyVault = new KeyVaultClass(params);
    await KeyVault.init(params, config_override);
    const API = common_1.registerMethods({
        source: KeyVault,
        methods: ['status', 'signAction', 'getPublicKey', 'addPath', 'getPath', 'getSeed', 'close', 'generateNewPath', 'getWallet'],
    });
    return API;
};
//# sourceMappingURL=keyvault.js.map