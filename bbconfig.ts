// process.setMaxListeners(1000)

function getRandomInt(min, max) {
  min = Math.ceil(min)
  max = Math.floor(max)
  return Math.floor(Math.random() * (max - min + 1)) + min
}

export default {
  user: {
    home_dir: '~',
    id_url:
      typeof window !== 'undefined'
        ? window.localStorage.getItem('dc.id_url') || 'https://id.foundation0.net'
        : 'https://id.foundation0.net',
  },
  addresses: {},
  keys: {
    test: '6261636b626f6e653a2f2f696e646578',
  },
  network: {
    bootstrap_servers: process.env.BOOTSTRAP
      ? ['127.0.0.1:60000', '127.0.0.1:60001', '127.0.0.1:60002']
      : ['wss://node1.network.foundation0.net:1337', 'wss://node2.network.foundation0.net:1337'],
    stunturn_servers: function () {
      const stuns = [
        'stun:node1.network.foundation0.net:19302',
        'stun:node2.network.foundation0.net:19302',
        'stun:openrelay.metered.ca:80',
        'stun:global.stun.twilio.com:3478',
      ]
      const turns = [
        {
          urls: [
            // 'turn:openrelay.metered.ca:80',
            // 'turn:openrelay.metered.ca:443',
            'turn:openrelay.metered.ca:443?transport=tcp',
          ],
          username: 'openrelayproject',
          credential: 'openrelayproject',
        },
      ]
      return [
        // NOTE: Using more than two STUN/TURN servers slows down discovery
        // TODO: Add randomizing function to distribute which servers users connect to
        {
          urls: [stuns[getRandomInt(0, stuns.length-1)]],
        },
        turns[getRandomInt(0, turns.length-1)]
      ]
    },
  },
}
