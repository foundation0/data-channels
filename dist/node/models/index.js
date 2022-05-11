"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    Object.defineProperty(o, k2, { enumerable: true, get: function() { return m[k]; } });
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Operation = exports.OwnerOnly = exports.AppendOnly = exports.User = exports.Commons = void 0;
const Commons = __importStar(require("./common"));
exports.Commons = Commons;
const base_1 = __importDefault(require("./base"));
const user_1 = __importDefault(require("./user"));
exports.User = user_1.default;
const append_only_1 = __importDefault(require("./append_only"));
exports.AppendOnly = append_only_1.default;
const owner_only_1 = __importDefault(require("./owner_only"));
exports.OwnerOnly = owner_only_1.default;
const operation_1 = __importDefault(require("./operation"));
exports.Operation = operation_1.default;
function create(core) {
    return base_1.default(core || null);
}
exports.default = create;
//# sourceMappingURL=index.js.map