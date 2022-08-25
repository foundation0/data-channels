import { emit, error } from '../common'
import Swarm from '@backbonedao/network-node'
import Buffer from 'b4a'
import { keyPair, buf2hex, hex2buf } from '@backbonedao/crypto'
import Network from '@backbonedao/network-node'
import { Split, Merge } from './chunker'
import { pipeline } from 'streamx'

let network

export async function getSwarm(network_config) {
  if (!network) network = Swarm(network_config)
  return network
}

export async function connect(
  this,
  opts?: { use_unique_swarm?: boolean; local_only?: { initiator: boolean } }
) {
  if (this.network) return error('NETWORK EXISTS')
  if (!this.config?.network) return error('CONNECT NEEDS NETWORK CONFIG')
  if (this.config.private) return error('ACCESS DENIED - PRIVATE CORE')

  const network_config: {
    bootstrap?: string[]
    simplePeer?: { config: { iceServers: [{ urls: string[] }] } }
    firewall?: Function
    keyPair?: { publicKey: Buffer; secretKey: Buffer }
    dht?: Function
  } = this.config.network

  emit({
    ch: 'network',
    msg: `Connect with conf: ${JSON.stringify(network_config)}`,
  })

  // add firewall
  if (this.config.firewall) network_config.firewall = this.config.firewall

  // add keypair for noise
  if (!this.config.network_id) {
    this.config.network_id = keyPair()
  }

  network_config.keyPair = this.config.network_id

  let self = this
  async function connectToNetwork() {
    try {
      const network = Network(network_config)
      network.on('connection', async (socket, user) => {
        emit({
          event: 'network.new-connection',
          ch: 'network',
          msg: `New connection from ${buf2hex(user.peer.host).slice(0, 8)}`,
        })

        // WebRTC has limited payload size, so we are using 2KB chunks
        // https://tensorworks.com.au/blog/webrtc-stream-limits-investigation/#14-maximum-data-channel-message-size
        const split = new Split({ chunkSize: 2 * 1024 })
        const merge = new Merge()
        const merged = pipeline(
          socket,
          merge,
          self.datamanager.replicate(user.client, { live: true })
        )
        const r = pipeline(merged, split, socket)
        r.on('error', (err) => {
          error(err.message)
        })
        self.connected_peers++
      })
      emit({
        ch: 'network',
        event: 'network.connecting',
        msg: `Connecting to backbone://${self.address}...`,
      })
      // @ts-ignore
      network.join(
        Buffer.isBuffer(self.address_hash)
          ? self.address_hash
          : Buffer.from(self.address_hash, 'hex')
      )
      // @ts-ignore
      await network.flush(() => {})
      return network
    } catch (err) {
      error(err)
    }
  }
  if (!opts?.local_only) {
    this.network = await connectToNetwork()
    this.connection_id = this.network?.webrtc?.id ? buf2hex(this.network.webrtc.id) : 'n/a'
    emit({
      ch: 'network',
      event: 'network.connected',
      msg: `Connected to backbone://${self.address} with id ${this.connection_id.slice(0, 8)}`,
    })
  } else {
    emit({
      ch: 'network',
      msg: `Using local connection`,
    })
    this.network = this.datamanager.replicate(opts?.local_only?.initiator, { live: true })
  }

  return this.network
}
