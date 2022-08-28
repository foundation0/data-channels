"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
function getRandomInt(min, max) {
    min = Math.ceil(min);
    max = Math.floor(max);
    return Math.floor(Math.random() * (max - min + 1)) + min;
}
exports.default = {
    user: {
        home_dir: '~',
        id_url: typeof window !== 'undefined'
            ? window.localStorage.getItem('bb.id_url') || 'https://id.backbonedao.com'
            : 'https://id.backbonedao.com',
    },
    addresses: {},
    keys: {
        test: '6261636b626f6e653a2f2f696e646578',
    },
    network: {
        bootstrap_servers: process.env.BOOTSTRAP
            ? ['127.0.0.1:60000', '127.0.0.1:60001', '127.0.0.1:60002']
            : ['wss://node1.network.backbonedao.com:1337'],
        stunturn_servers: function () {
            const stuns = [
                'stun:node1.network.backbonedao.com:19302',
                'stun:openrelay.metered.ca:80',
                'stun:global.stun.twilio.com:3478',
            ];
            const turns = [
                {
                    urls: [
                        'turn:openrelay.metered.ca:443?transport=tcp',
                    ],
                    username: 'openrelayproject',
                    credential: 'openrelayproject',
                },
            ];
            return [
                {
                    urls: [stuns[getRandomInt(0, stuns.length - 1)]],
                },
                turns[getRandomInt(0, turns.length - 1)]
            ];
        },
    },
};
//# sourceMappingURL=bbconfig.js.map