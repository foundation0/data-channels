"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
async function API(Core, Protocol) {
    return {
        async get(key) {
            return await Core.get(key);
        },
        async del(key) {
            await Protocol({
                type: 'del',
                key,
            });
        },
        async set(params) {
            await Protocol({
                type: 'set',
                ...params,
            });
        },
    };
}
exports.default = API;
//# sourceMappingURL=API.js.map