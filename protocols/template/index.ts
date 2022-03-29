import Protocol from './protocol'
import API from './API'

if (require.main === module) {
  // run Core as independent
  const Core = require('../../core').default
  ;(async () => {
    const core = await Core({
      address: 'f00',
      writers: [],
      indexes: [],
      private: false,
      protocol: { API, Protocol },
      encryption_key: 'f00',
      // noiseKeypair,
    })
    console.log(core)
  })()
}
export default { Protocol, API }