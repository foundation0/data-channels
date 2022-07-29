module.exports = {
    user: {
        home_dir: '~',
        id_url: typeof window !== 'undefined'
            ? window.localStorage.getItem('bb.id_url') || 'https://auth.backbonedao.com'
            : 'https://auth.backbonedao.com',
    },
    addresses: {},
    keys: {
        test: '6261636b626f6e653a2f2f696e646578',
    },
    network: {
        bootstrap_servers: process.env.BOOTSTRAP
            ? ['127.0.0.1:60000', '127.0.0.1:60001', '127.0.0.1:60002']
            : ['wss://node1.network.backbonedao.com:1337'],
        bootstrap_servers_ws: process.env.BOOTSTRAP
            ? 'ws://127.0.0.1:50000'
            : 'wss://network.backbonedao.com:50000',
        stunturn_servers: ['stun:node1.network.backbonedao.com:19302'],
        swarm_refresh_frequency: 15 * 60 * 1000,
    },
};
//# sourceMappingURL=bbconfig.js.map