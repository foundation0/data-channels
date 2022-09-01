"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const base_1 = require("./base");
const objectmodel_1 = __importDefault(require("objectmodel"));
const { Any } = objectmodel_1.default;
exports.default = base_1.Object({
    type: String,
    data: Any,
});
//# sourceMappingURL=operation.js.map