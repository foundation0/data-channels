"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const objectmodel_1 = __importDefault(require("objectmodel"));
const { BasicModel, Any } = objectmodel_1.default;
const b4a = require('b4a');
exports.default = BasicModel(Any).assert(data => b4a.isBuffer(data));
//# sourceMappingURL=binary.js.map