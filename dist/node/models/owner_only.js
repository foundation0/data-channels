"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const base_1 = require("./base");
const objectmodel_1 = __importDefault(require("objectmodel"));
const { Any } = objectmodel_1.default;
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