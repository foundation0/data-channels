import { emit, error } from '../common'
import Swarm from '@backbonedao/network-node'
import b4a from 'b4a'
import { keyPair, buf2hex, hex2buf } from '@backbonedao/crypto'
import Network from '@backbonedao/network-node'
import { Split, Merge } from './chunker'
import { pipeline } from 'streamx'
import _ from 'lodash'
import ws from 'websocket-stream'

let network

export async function getSwarm(network_config) {
  if (!network) network = Swarm(network_config)
  return network
}

export async function findBootstrapNode(nodes: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    nodes = _.shuffle(nodes)
    function testBatch() {
      // pick random two
      const node_batch: string[] = nodes.slice(0, 2)
      if(node_batch.length === 0) return reject('no bootstrap nodes available')
      // try to make connection
      let streams: any = []
      node_batch.forEach((address, i) => {
        const timer = setTimeout(() => {
          streams.forEach((s) => s.destroy())
          delete nodes[nodes.indexOf(address)]
          testBatch()
        }, 5000)
        try {
          streams[i] = ws(`${address}/signal`)
          streams[i].once('connect', () => {
            streams.forEach((s) => s.destroy())
            clearTimeout(timer)
            resolve(address)
          })
          streams[i].on('error', () => {})
        } catch (error) {
          
        }
      })
      // with any connection, resolve immediately

      // if no connection in 5 secs, try another batch
    }
    testBatch()
  })
}

export async function connect(
  this,
  opts?: { use_unique_swarm?: boolean; local_only?: { initiator: boolean } }
) {
  if (this.network) return
  if (!this.config?.network) return error('CONNECT NEEDS NETWORK CONFIG')
  if (this.config.private) return error('ACCESS DENIED - PRIVATE CORE')

  const network_config: {
    bootstrap?: string[]
    simplePeer?: { config: { iceServers: [{ urls: string[] }] } }
    firewall?: Function
    keyPair?: { publicKey: b4a; secretKey: b4a }
    dht?: Function
  } = this.config.network

  // override default bootstrap nodes with user-specified ones
  if(typeof window === 'object' && typeof window.localStorage.getItem('bb.network_config.bootstrap') === 'string') network_config.bootstrap = JSON.parse(window.localStorage.getItem('bb.network_config.bootstrap') || '')

  // shuffle the order of bootstraps to spread the load
  if (network_config?.bootstrap && network_config.bootstrap.length > 0) {
    // network_config.bootstrap = _.shuffle(network_config.bootstrap)
    try {
      const alive_server: string = await findBootstrapNode(network_config.bootstrap)
      network_config.bootstrap = [alive_server]
    } catch (error) {
      return error(error)
    }
  }

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

        r.on('data', (...args) => {
          emit({
            ch: `_:core:data`,
            msg: { id: 'datamanager', ...args },
          })
        })
        r.on('drain', (...args) => {
          emit({
            ch: `_:core:drain`,
            msg: { id: 'datamanager', ...args },
          })
        })
        r.on('close', (...args) => {
          emit({ ch: `_:core:close`, msg: { id: 'datamanager', ...args } })
        })
        r.on('finish', (...args) => {
          emit({ ch: `_:core:finish`, msg: { id: 'datamanager', ...args } })
        })
        r.on('end', (...args) => {
          emit({ ch: `_:core:end`, msg: { id: 'datamanager', ...args } })
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
      emit({
        ch: 'network',
        event: 'network.restarting',
        msg: `Restarting network...`,
      })
      this.network = await connectToNetwork()
    }
  }
  if (!opts?.local_only) {
    this.network = await connectToNetwork()
    this.connection_id = buf2hex(this.network.webrtc.id)
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
