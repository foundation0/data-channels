process.setMaxListeners(1000)

module.exports = {
  user: {
    home_dir: '~',
  },
  addresses: {
    
  },
  keys: {
    index: '6261636b626f6e653a2f2f696e646578',
  },
  contracts: {
    alchemy_api_key: process.env.ALCHEMY_API_KEY || '',
    blockchain_id: !process.env.TEST ? 'maticmum' : 'matic',
    nodes_registry: !process.env.TEST ? '0xeB1984B5139A5d1d4CC081f4338926e544857046' : '',
  },
  network: {
    bootstrap_servers: process.env.BOOTSTRAP
      ? ['127.0.0.1:60000', '127.0.0.1:60001', '127.0.0.1:60002']
      : // : ['index.backbonedao.com:60000', 'index.backbonedao.com:60001', 'index.backbonedao.com:60002'],
        [
          'testnet1.hyperdht.org:49736',
          'testnet2.hyperdht.org:49736',
          'testnet3.hyperdht.org:49736',
        ],
    swarm_refresh_frequency: 15 * 60 * 1000, // 15 mins
  },
}
