"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
async function Protocol(op, Core) {
    if (typeof op !== 'object' || !op?.type)
        throw new Error('UNKNOWN OP');
    switch (op.type) {
        case 'set': {
            await Core.put({ key: op.data.key, value: op.data.value });
            break;
        }
        case 'del': {
            const p = await Core.get(op.data.key, { update: false });
            if (!p)
                break;
            await Core.del(op.data.key);
            break;
        }
        default:
            throw new Error('UNKNOWN OP');
    }
}
exports.default = Protocol;
//# sourceMappingURL=protocol.js.map