"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const blacklisted_addresses = [];
function default_1(pub, remotePayload, addr) {
    return blacklisted_addresses.indexOf(addr) !== -1;
}
exports.default = default_1;
//# sourceMappingURL=blacklist.js.map