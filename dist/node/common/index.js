"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.sleep = exports.registerMethods = exports.fetchPeers = exports.createCache = exports.hash = exports.getHomedir = exports.unique = exports.shuffle = exports.getRandomInt = exports.flatten = exports.JSONparse = exports.decodeCoreData = exports.encodeCoreData = exports.subscribeToEvent = exports.subscribeToChannel = exports.emit = exports.buf2hex = exports.error = exports.log = void 0;
const crypto_1 = require("crypto");
const os_1 = require("os");
const bbconfig_1 = require("../bbconfig");
const ttl_1 = __importDefault(require("ttl"));
const crypto_2 = require("./crypto");
const eventemitter2_1 = require("eventemitter2");
const platform_detect_1 = __importDefault(require("platform-detect"));
const b4a_1 = __importDefault(require("b4a"));
const msgpackr_1 = require("msgpackr");
const EE = new eventemitter2_1.EventEmitter2();
function log(message, ...data) {
    if (process.env['LOG'] || (platform_detect_1.default.browser && window?.localStorage.getItem('LOG')))
        console.log(message, ...data);
}
exports.log = log;
function error(message, ...data) {
    if (process.env['LOG'] || (platform_detect_1.default.browser && window?.localStorage.getItem('LOG')))
        console.log(`ERROR: ${message}`, ...data);
    throw new Error(message);
}
exports.error = error;
function buf2hex(buffer) {
    return b4a_1.default.toString(buffer, 'hex');
}
exports.buf2hex = buf2hex;
function emit(params) {
    if (params.verbose && !process.env.VERBOSE)
        return;
    EE.emit(params.ch, params.msg);
    if (params.event)
        EE.emit(params.event);
    if (!params?.no_log)
        log(`${params.ch} > ${params.msg}`);
}
exports.emit = emit;
function subscribeToChannel(params) {
    return EE.on(params.ch, params.cb, { objectify: true });
}
exports.subscribeToChannel = subscribeToChannel;
function subscribeToEvent(params) {
    return EE.on(params.id, params.cb, { objectify: true });
}
exports.subscribeToEvent = subscribeToEvent;
function encodeCoreData(data) {
    return msgpackr_1.pack(data);
}
exports.encodeCoreData = encodeCoreData;
function decodeCoreData(data) {
    return msgpackr_1.unpack(data);
}
exports.decodeCoreData = decodeCoreData;
function JSONparse(stringify) {
    return JSON.parse(stringify, (k, v) => {
        if (v !== null &&
            typeof v === 'object' &&
            'type' in v &&
            v.type === 'Buffer' &&
            'data' in v &&
            Array.isArray(v.data)) {
            return b4a_1.default.from(v.data);
        }
        return v;
    });
}
exports.JSONparse = JSONparse;
function flatten(arr) {
    return arr.reduce((a, b) => (Array.isArray(b) ? [...a, ...flatten(b)] : [...a, b]), []);
}
exports.flatten = flatten;
function getRandomInt(min, max) {
    min = Math.ceil(min);
    max = Math.floor(max);
    return Math.floor(Math.random() * (max - min + 1)) + min;
}
exports.getRandomInt = getRandomInt;
function shuffle(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}
exports.shuffle = shuffle;
function unique(array) {
    return Array.from(new Set(array));
}
exports.unique = unique;
function getHomedir() {
    if (bbconfig_1.user.home_dir === '~')
        return process.env.TEST ? `${os_1.homedir()}/.backbone-test` : `${os_1.homedir()}/.backbone`;
    else
        return bbconfig_1.user.home_dir;
}
exports.getHomedir = getHomedir;
function hash(params) {
    const txt = typeof params.data !== 'string' ? JSON.stringify(params.data) : params.data;
    const hash = crypto_1.createHash(params.type);
    hash.update(txt);
    return buf2hex(hash.digest());
}
exports.hash = hash;
function createCache(params) {
    return new ttl_1.default({
        ttl: (params?.ttlsec || 60) * 1000,
        capacity: params?.capacity || 100000,
    });
}
exports.createCache = createCache;
async function fetchPeers(type) {
    if (process.env.TEST)
        return [];
    return [];
}
exports.fetchPeers = fetchPeers;
function registerMethods(params) {
    const API = {};
    for (let m in params.methods) {
        API[params.methods[m]] = eval(`params.source.${params.methods[m]}`);
    }
    return API;
}
exports.registerMethods = registerMethods;
async function verifySign(payload) {
    const data = JSON.stringify(payload.meta) + JSON.stringify(payload.object);
    return await crypto_2.verifySignature({
        public_key: payload.owner,
        data,
        signature: payload.signature,
    });
}
function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
exports.sleep = sleep;
//# sourceMappingURL=index.js.map