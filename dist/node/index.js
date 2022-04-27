"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const core_1 = __importDefault(require("./core"));
const platform_detect_1 = __importDefault(require("platform-detect"));
if (platform_detect_1.default.browser)
    window['Core'] = core_1.default;
exports.default = core_1.default;
module.exports = core_1.default;
//# sourceMappingURL=index.js.map