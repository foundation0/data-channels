const DHT = require('../common/network/dht')
const async = require('async')

const host = '127.0.0.1'
const ports = [process.argv[2], process.argv[3], process.argv[4]]
// const bootstrap = ports.map((p) => `${host}:${p}`)

function startBootstrapper(port, cb) {
  const node = DHT.bootstrapper(Number(port), { ephemeral: false, bootstrap: ['127.0.0.1:39999'] })

  node.ready().then(function () {
    console.log(
      `backbone://network bootstrap server running on port ${node.address().port} - ${
        node.firewalled ? 'Firewalled!' : 'Not firewalled, all good'
      }`
    )
    cb()
  })
}

;(async () => {
  const bootstrapper1 = DHT.bootstrapper(39999, { ephemeral: true, bootstrap: [] })
  await bootstrapper1.ready()
  console.log(
    `backbone://network bootstrap server running on port 39999 - ${
      bootstrapper1.firewalled ? 'Firewalled!' : 'Not firewalled, all good'
    }`
  )
  async.forEach(
    ports,
    (port, done) => {
      startBootstrapper(port, done)
    },
    async (err) => {
      setInterval(() => {}, 1000)
    }
  )
})()
