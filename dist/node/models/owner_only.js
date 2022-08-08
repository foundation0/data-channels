"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const base_1 = require("./base");
const { Any } = require('./objectmodel');
const crypto_1 = require("@backbonedao/crypto");
const OwnerOnly = base_1.Object({
    owner: String,
    signature: String,
    data: Any,
}).assert((model) => {
    return crypto_1.verify(JSON.stringify(model.data), crypto_1.hex2buf(model.signature), crypto_1.hex2buf(model.owner));
}, "data doesn't match signature");
exports.default = OwnerOnly;
//# sourceMappingURL=owner_only.js.map