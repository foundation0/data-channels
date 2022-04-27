"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const lodash_1 = __importDefault(require("lodash"));
const crypto_1 = require("../../common/crypto");
async function Protocol(op, Core, Data) {
    if (!op?.type)
        throw new Error('UNKNOWN OP');
    switch (op.type) {
        case 'post': {
            const data = op.data.data;
            const meta = op.data.meta;
            const is_valid = await crypto_1.verifySignature({
                public_key: meta.pubkey,
                signature: meta.signature,
                data: op.data.packet,
            });
            if (!is_valid) {
                console.log(is_valid);
                console.log('SIGNATURE ERROR');
                break;
            }
            const exists = await Core.get(`posts!${data.tweet_id}`);
            if (exists)
                break;
            await Core.put({
                key: 'posts!' + data.tweet_id,
                value: {
                    ...data,
                    username: data.username,
                    tweet: data.tweet,
                    likes: [],
                    retweets: [],
                    replies: [],
                    ...meta
                },
            });
            const p = await Core.get(`posts!${data.tweet_id}`);
            if (!p)
                throw new Error('SAVE ERROR');
            break;
        }
        case 'like': {
            const data = op.data.data;
            const meta = op.data.meta;
            const is_valid = await crypto_1.verifySignature({
                public_key: meta.pubkey,
                signature: meta.signature,
                data: op.data.packet,
            });
            if (!is_valid) {
                console.log(is_valid);
                console.log('SIGNATURE ERROR');
                break;
            }
            const orig_tweet = await Core.get('posts!' + data.tweet_id, { update: false });
            if (!orig_tweet)
                break;
            if (lodash_1.default.find(orig_tweet.likes, (r) => {
                if (r[0] === data.username)
                    return true;
            }))
                break;
            orig_tweet.likes.push([data.username, meta.pubkey, meta.signature]);
            await Core.del('posts!' + data.tweet_id);
            await Core.put({ key: 'posts!' + data.tweet_id, value: orig_tweet });
            const p2 = await Core.get('posts!' + data.tweet_id, { update: false });
            if (!p2)
                throw new Error('SAVE ERROR');
            break;
        }
        case 'retweet': {
            const data = op.data.data;
            const meta = op.data.meta;
            const is_valid = await crypto_1.verifySignature({
                public_key: meta.pubkey,
                signature: meta.signature,
                data: op.data.packet,
            });
            if (!is_valid) {
                console.log(is_valid);
                console.log('SIGNATURE ERROR');
                break;
            }
            const orig_tweet = await Core.get('posts!' + data.retweet_id, { update: false });
            if (!orig_tweet)
                break;
            if (lodash_1.default.find(orig_tweet.retweets, (r) => {
                if (r[0] === data.username)
                    return true;
            }))
                break;
            orig_tweet.retweets.push([data.username, meta.pubkey, meta.signature, data.tweet_id]);
            await Core.del('posts!' + orig_tweet.tweet_id);
            await Core.put({ key: 'posts!' + orig_tweet.tweet_id, value: orig_tweet });
            const orig_tweet_exists = await Core.get('posts!' + orig_tweet.tweet_id, { update: false });
            if (!orig_tweet_exists)
                throw new Error('ORIGINAL SAVE ERROR');
            await Core.put({
                key: 'posts!' + data.tweet_id,
                value: {
                    ...data,
                    tweet: '',
                    likes: [],
                    retweets: [],
                    replies: [],
                },
            });
            const retweet_exists = await Core.get(`posts!${data.tweet_id}`, { update: false });
            if (!retweet_exists)
                throw new Error('RETWEET SAVE ERROR');
            break;
        }
        case 'reply': {
            const data = op.data.data;
            const meta = op.data.meta;
            const is_valid = await crypto_1.verifySignature({
                public_key: meta.pubkey,
                signature: meta.signature,
                data: op.data.packet,
            });
            if (!is_valid) {
                console.log(is_valid);
                console.log('SIGNATURE ERROR');
                break;
            }
            const orig_tweet = await Core.get('posts!' + data.reply_to, { update: false });
            if (!orig_tweet)
                break;
            orig_tweet.replies.push([data.username, meta.pubkey, meta.signature, data.tweet_id]);
            await Core.del('posts!' + orig_tweet.tweet_id);
            await Core.put({ key: 'posts!' + orig_tweet.tweet_id, value: orig_tweet });
            const orig_tweet_exists = await Core.get('posts!' + orig_tweet.tweet_id, { update: false });
            if (!orig_tweet_exists)
                throw new Error('ORIGINAL SAVE ERROR');
            await Core.put({
                key: 'posts!' + data.tweet_id,
                value: {
                    ...data,
                    likes: [],
                    retweets: [],
                    replies: [],
                },
            });
            const reply_exists = await Core.get(`posts!${data.tweet_id}`, { update: false });
            if (!reply_exists)
                throw new Error('REPLY SAVE ERROR');
            break;
        }
        default:
            throw new Error('UNKNOWN OP');
    }
}
exports.default = Protocol;
//# sourceMappingURL=protocol.js.map