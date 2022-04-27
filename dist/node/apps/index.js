"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const chat_1 = __importDefault(require("./chat"));
const keyvalue_1 = __importDefault(require("./keyvalue"));
const tweeterdemo_1 = __importDefault(require("./tweeterdemo"));
exports.default = {
    chat: chat_1.default,
    keyvalue: keyvalue_1.default,
    tweeterdemo: tweeterdemo_1.default
};
//# sourceMappingURL=index.js.map