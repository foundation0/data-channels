"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getSwarm = void 0;
const network_node_1 = __importDefault(require("@backbonedao/network-node"));
let network;
async function getSwarm(network_config) {
    if (!network)
        network = network_node_1.default(network_config);
    return network;
}
exports.getSwarm = getSwarm;
//# sourceMappingURL=index.js.map