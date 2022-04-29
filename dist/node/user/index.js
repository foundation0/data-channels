"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const common_1 = require("../common");
const crypto_1 = require("../common/crypto");
const ethers_1 = require("ethers");
const b4a_1 = __importDefault(require("b4a"));
const crypto_2 = require("@backbonedao/crypto");
const auth_1 = __importDefault(require("../auth"));
class UserClass {
    constructor(user_config) {
        this.user_config = user_config;
        this.username = user_config.username;
        this.init = this.init.bind(this);
        this.getUserObjAddress = this.getUserObjAddress.bind(this);
        this.createUserObject = this.createUserObject.bind(this);
        this.openUserObject = this.openUserObject.bind(this);
        this.authenticate = this.authenticate.bind(this);
        this.getNetworkId = this.getNetworkId.bind(this);
        this.createNewCore = this.createNewCore.bind(this);
    }
    async init(core_config_override) {
        this.getSeed = () => this.keyvault.getSeed(this.user_config.password);
        this.getUsername = () => this.username;
        this.generateNewPath = async () => {
            return this.keyvault.generateNewPath(this.user_config.password);
        };
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
    authenticate(params) {
        this.wallet = ethers_1.ethers.utils.HDNode.fromSeed(crypto_2.createHash(params.signature));
        const netid = this.wallet.derivePath(`m/44'/60'/0'/0/0`);
        this.network_id = {
            secretKey: netid.privateKey.replace(/0x/, ''),
            publicKey: netid.publicKey.replace(/0x/, ''),
        };
    }
    getNetworkId(params) {
        if (!this.wallet)
            throw new Error('NOT AUTHENTICATED');
        return this.network_id;
    }
    createNewCore(params) {
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
            path,
            name: params.name
        };
        if (!params.core)
            return core_meta;
    }
}
async function User(user_config, core_config_override) {
    if (!user_config)
        return auth_1.default;
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
            'createNewCore'
        ],
    });
    return API;
}
exports.default = User;
//# sourceMappingURL=index.js.map