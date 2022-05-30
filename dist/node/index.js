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
const index_old_1 = __importDefault(require("./user/index-old"));
const core_1 = __importDefault(require("./core"));
const platform_detect_1 = __importDefault(require("platform-detect"));
const Crypto = __importStar(require("@backbonedao/crypto"));
const Backbone = {
    User: index_old_1.default,
    Core: core_1.default,
    Crypto
};
if (platform_detect_1.default.browser) {
    window['bb'] = Backbone;
    window.onerror = function (errMsg, url, line, column, error) {
        var result = !column ? '' : '\ncolumn: ' + column;
        result += !error;
        document.write('Error= ' + errMsg + '\nurl= ' + url + '\nline= ' + line + result);
        var suppressErrorAlert = true;
        return suppressErrorAlert;
    };
}
module.exports = { User: index_old_1.default, Core: core_1.default, Crypto };
exports.default = Backbone;
//# sourceMappingURL=index.js.map