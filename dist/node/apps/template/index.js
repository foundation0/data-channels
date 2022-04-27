"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const protocol_1 = __importDefault(require("./protocol"));
const API_1 = __importDefault(require("./API"));
if (require.main === module) {
    const Core = require('../../core').default;
    (async () => {
        const core = await Core({
            address: 'f00',
            writers: [],
            indexes: [],
            private: false,
            protocol: { API: API_1.default, Protocol: protocol_1.default },
            encryption_key: 'f00',
        });
        console.log(core);
    })();
}
exports.default = { Protocol: protocol_1.default, API: API_1.default };
//# sourceMappingURL=index.js.map