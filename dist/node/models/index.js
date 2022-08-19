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
exports.DataModel = exports.Binary = exports.Operation = exports.OwnerOnly = exports.AppendOnly = exports.Commons = void 0;
const Commons = __importStar(require("./common"));
exports.Commons = Commons;
const base_1 = __importDefault(require("./base"));
const append_only_1 = __importDefault(require("./append_only"));
exports.AppendOnly = append_only_1.default;
const owner_only_1 = __importDefault(require("./owner_only"));
exports.OwnerOnly = owner_only_1.default;
const operation_1 = __importDefault(require("./operation"));
exports.Operation = operation_1.default;
const binary_1 = __importDefault(require("./binary"));
exports.Binary = binary_1.default;
const common_1 = require("../common");
function create(model, opts, migrations) {
    return async (data) => {
        const m = await base_1.default(model, opts, migrations);
        if (typeof m === 'function')
            return m(data);
        else
            return common_1.error('error in creating data model');
    };
}
exports.DataModel = create;
exports.default = create;
//# sourceMappingURL=index.js.map