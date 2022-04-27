"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
async function Protocol(op, Core, Data) {
    if (!op?.type)
        throw new Error('UNKNOWN OP');
    switch (op.type) {
        case 'set': {
            await Core.put(op.key, op.data);
            break;
        }
        case 'del': {
            const p = await Core.get(op.key, { update: false });
            if (!p)
                break;
            await Core.del(op.key);
            break;
        }
        default:
            throw new Error('UNKNOWN OP');
    }
}
exports.default = Protocol;
//# sourceMappingURL=protocol.js.map