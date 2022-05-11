"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
async function API(Core, Protocol) {
    return {
        async all(stream) {
            const items = await Core.query({ lt: '~' }, stream);
            return items;
        },
        async get(key) {
            const value = await Core.get(key);
            return value || null;
        },
        async del(key) {
            await Protocol({
                type: 'del',
                data: { key },
            });
        },
        async set(params) {
            await Protocol({
                type: 'set',
                data: {
                    key: params.key,
                    value: params.value,
                },
            });
        },
    };
}
exports.default = API;
//# sourceMappingURL=API.js.map