"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.verifyAuthor = exports.UUID = void 0;
const crypto_1 = require("@backbonedao/crypto");
const common_1 = require("./common");
async function UUID(len) {
    return crypto_1.buf2hex(crypto_1.randomBytes(len || 32));
}
exports.UUID = UUID;
async function verifyAuthor(params) {
    if (!params?.model?._meta?.signature || !params?.model?._meta?.hash)
        return common_1.error('model has invalid _meta');
    if (!params?.model2?._meta?.signature || !params?.model2?._meta?.hash)
        return common_1.error('model2 has invalid _meta');
    const meta = params.model._meta;
    const sig1 = crypto_1.getPublicKeyFromSig({
        message: crypto_1.hex2buf(meta.hash),
        signature: crypto_1.hex2buf(meta.signature),
    });
    const meta2 = params.model2._meta;
    const sig2 = crypto_1.getPublicKeyFromSig({
        message: crypto_1.hex2buf(meta2.hash),
        signature: crypto_1.hex2buf(meta2.signature),
    });
    return sig1 === sig2;
}
exports.verifyAuthor = verifyAuthor;
//# sourceMappingURL=utils.js.map