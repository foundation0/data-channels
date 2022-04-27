"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const crypto_1 = require("../../common/crypto");
async function API(Core, Protocol) {
    return {
        async all(stream) {
            const posts = await Core.query({ gte: 'posts!', lte: 'posts!~', stream });
            return posts;
        },
        async post(opts) {
            const timestamp = new Date().getTime();
            const data = {
                timestamp,
                tweet_id: crypto_1.sha256(timestamp + opts.data.username + opts.data.tweet),
                ...opts.data
            };
            await Protocol({
                type: 'post',
                data: { data, meta: opts.meta, packet: opts.data },
            });
        },
        async like(opts) {
            const data = opts.data;
            await Protocol({
                type: 'like',
                data: { data, meta: opts.meta, packet: opts.data },
            });
        },
        async retweet(opts) {
            const timestamp = new Date().getTime();
            const data = {
                timestamp,
                tweet_id: crypto_1.sha256(timestamp + opts.data.username + opts.data.retweet_id),
                tweet: '',
                ...opts.data
            };
            await Protocol({
                type: 'retweet',
                data: { data, meta: opts.meta, packet: opts.data },
            });
        },
        async reply(opts) {
            const timestamp = new Date().getTime();
            const data = {
                timestamp,
                tweet_id: crypto_1.sha256(timestamp + opts.data.username + opts.data.reply_to),
                ...opts.data
            };
            await Protocol({
                type: 'reply',
                data: { data, meta: opts.meta, packet: opts.data }
            });
        },
    };
}
exports.default = API;
//# sourceMappingURL=API.js.map