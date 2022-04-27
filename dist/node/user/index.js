"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const common_1 = require("../common");
const keyvault_1 = __importDefault(require("./keyvault"));
class UserClass {
    constructor(user_config) {
        this.user_config = user_config;
        this.username = user_config.username;
        this.init = this.init.bind(this);
    }
    async init(core_config_override) {
        this.keyvault = await keyvault_1.default(this.user_config, core_config_override);
        if (this.keyvault.status !== 'active')
            throw new Error('KEYVAULT INITIALIZATION ERROR');
        this.signAction = async (params) => {
            return this.keyvault.signAction({ ...params, password: this.user_config.password });
        };
        this.getPublicKey = async (params) => {
            return this.keyvault.getPublicKey({ ...params, password: this.user_config.password });
        };
        this.getWallet = async (params) => {
            return this.keyvault.getWallet({ ...params, password: this.user_config.password });
        };
        this.addPath = this.keyvault.addPath;
        this.getPath = this.keyvault.getPath;
        this.status = this.keyvault.status;
        this.getSeed = () => this.keyvault.getSeed(this.user_config.password);
        this.getUsername = () => this.username;
        this.generateNewPath = async () => {
            return this.keyvault.generateNewPath(this.user_config.password);
        };
    }
}
async function User(user_config, core_config_override) {
    const U = new UserClass(user_config);
    await U.init(core_config_override);
    const API = common_1.registerMethods({
        source: U,
        methods: [
            'status',
            'signAction',
            'getPublicKey',
            'addPath',
            'getPath',
            'getSeed',
            'generateNewPath',
            'getUsername',
            'getWallet',
        ],
    });
    return API;
}
exports.default = User;
//# sourceMappingURL=index.js.map