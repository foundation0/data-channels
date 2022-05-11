"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
async function Protocol(op, Core) {
    if (!op?.type)
        throw new Error('UNKNOWN OP');
    switch (op.type) {
        case 'post': {
            const { hash, data, user } = op.data;
            await Core.put({ key: 'posts!' + hash, value: { hash, votes: 0, data, user } });
            const p = await Core.get(`posts!${hash}`);
            break;
        }
        case 'vote': {
            const { up, hash } = op.data;
            const inc = up ? 1 : -1;
            const p = await Core.get('posts!' + hash, { update: false });
            if (!p)
                break;
            p.value.votes += inc;
            await Core.del('posts!' + hash);
            await Core.put('posts!' + hash, p.value);
            break;
        }
        default:
            throw new Error('UNKNOWN OP');
    }
}
exports.default = Protocol;
//# sourceMappingURL=protocol.js.map