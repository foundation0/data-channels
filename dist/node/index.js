"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const user_1 = __importDefault(require("./user"));
const core_1 = __importDefault(require("./core"));
const platform_detect_1 = __importDefault(require("platform-detect"));
const Backbone = {
    User: user_1.default,
    Core: core_1.default,
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
exports.default = Backbone;
module.exports = Backbone;
//# sourceMappingURL=index.js.map