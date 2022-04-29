"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateAddress = exports.generateNoiseKeypair = exports.generatePathAddress = exports.verifySignature = exports.sign = exports.createId = exports.verifyPassword = exports.securePassword = exports.decrypt = exports.encrypt = exports.randomStr = exports.sha256 = exports.numericHash = exports.randomBytes = void 0;
const ethers_1 = require("ethers");
const sodium_javascript_1 = __importDefault(require("sodium-javascript"));
const _1 = require(".");
const b4a_1 = __importDefault(require("b4a"));
const Buffer = b4a_1.default;
const crypto_1 = __importDefault(require("@backbonedao/crypto"));
exports.randomBytes = crypto_1.default.randomBytes;
function numericHash(seed) {
    let s = seed ? crypto_1.default.buf2hex(seed) : exports.sha256(crypto_1.default.buf2hex(exports.randomBytes(32)));
    return (BigInt('0x' + s) % (10n ** BigInt(10))).toString();
}
exports.numericHash = numericHash;
exports.sha256 = crypto_1.default.createHash;
function randomStr(len = 32) {
    return crypto_1.default.buf2hex(exports.randomBytes(32)).slice(0, 32);
}
exports.randomStr = randomStr;
function encrypt(params) {
    let d = _1.encodeCoreData(params.data);
    const secret = Buffer.from(exports.sha256(params.key), 'hex').slice(0, 32);
    const nonce = Buffer.alloc(sodium_javascript_1.default.crypto_secretbox_NONCEBYTES);
    sodium_javascript_1.default.randombytes_buf(nonce);
    const cipher = Buffer.alloc(d.length + sodium_javascript_1.default.crypto_secretbox_MACBYTES);
    sodium_javascript_1.default.crypto_secretbox_easy(cipher, d, nonce, secret);
    return { cipher, nonce: crypto_1.default.buf2hex(nonce) };
}
exports.encrypt = encrypt;
function decrypt(params) {
    const decrypted_data = Buffer.alloc(params.cipher.length - sodium_javascript_1.default.crypto_secretbox_MACBYTES);
    const secret = Buffer.from(exports.sha256(params.key), 'hex').slice(0, 32);
    sodium_javascript_1.default.crypto_secretbox_open_easy(decrypted_data, params.cipher, Buffer.from(params.nonce, 'hex'), secret);
    return _1.decodeCoreData(decrypted_data);
}
exports.decrypt = decrypt;
exports.securePassword = crypto_1.default.securePassword;
exports.verifyPassword = crypto_1.default.verifyPassword;
async function createId(seed) {
    return crypto_1.default.keyPair(seed);
}
exports.createId = createId;
async function sign(params) {
    return crypto_1.default.sign(params.data, params.id.secretKey);
}
exports.sign = sign;
function verifySignature(params) {
    return crypto_1.default.verify(params.data, params.signature, params.public_key);
}
exports.verifySignature = verifySignature;
async function generatePathAddress(params) {
    const max_path = 2140000000;
    const level1 = params?.level1 || _1.getRandomInt(0, max_path);
    const level2 = params?.level2 || _1.getRandomInt(0, max_path);
    const path = `m/44'/60'/0'/${level1}/${level2}`;
    let address;
    if (params?.signer_type === 'native') {
        if (!params?.seed)
            throw new Error('NATIVE SIGNER NEEDS SEED');
        const master = ethers_1.ethers.utils.HDNode.fromSeed(Buffer.from(params.seed));
        const derived_wallet = master.derivePath(path);
        address = derived_wallet.address;
    }
    else if (params?.signer_type === 'ledger') {
        throw new Error('NOT_AVAILABLE');
    }
    else
        throw new Error('UNKNOWN SIGNER TYPE');
    return { address, level1, level2, path };
}
exports.generatePathAddress = generatePathAddress;
function generateNoiseKeypair(seed) {
    return crypto_1.default.keyPair(seed);
}
exports.generateNoiseKeypair = generateNoiseKeypair;
function generateAddress(seed) {
    const keyPair = crypto_1.default.keyPair(seed);
    return keyPair.publicKey;
}
exports.generateAddress = generateAddress;
//# sourceMappingURL=crypto.js.map