"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const base_1 = require("./base");
const objectmodel_1 = __importDefault(require("objectmodel"));
const { Any } = objectmodel_1.default;
const crypto_1 = require("@backbonedao/crypto");
const b4a_1 = __importDefault(require("b4a"));
const AppendOnly = function (model) {
    let size = 0;
    let hash;
    return base_1.Array(model)
        .assert((data) => {
        if (!data)
            return true;
        const new_size = data.length;
        if (new_size >= size) {
            size = new_size;
            return true;
        }
        else
            return false;
    }, 'array smaller than previously')
        .assert((data) => {
        if (!data)
            return true;
        if (!hash) {
            hash = crypto_1.createHash(data);
            return true;
        }
        const d = [...data.values()];
        const s = d.slice(0, size - 1);
        const history_hash = crypto_1.createHash(s);
        if (s.length === 0 || b4a_1.default.equals(hash, history_hash)) {
            hash = crypto_1.createHash(data);
            return true;
        }
        else
            return false;
    });
};
exports.default = AppendOnly;
//# sourceMappingURL=append_only.js.map