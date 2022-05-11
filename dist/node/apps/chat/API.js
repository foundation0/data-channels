"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const crypto_1 = require("../../common/crypto");
async function API(Core, Protocol) {
    return {
        async all(stream) {
            const posts = await Core.query({ gte: 'posts!', lte: 'posts!~', stream });
            return posts;
        },
        async post(data) {
            const hash = crypto_1.sha256(data.user + data.text);
            await Protocol({
                type: 'post',
                data: {
                    hash,
                    data: data.text,
                    user: data.user,
                }
            });
        }
    };
}
exports.default = API;
//# sourceMappingURL=API.js.map