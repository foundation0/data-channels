// import Store from '../../data-manager'
// import Rebase from '../../data-viewer'
// import DataDB from '../../data-db'
// import Swarm from '../../network-node'
import DataManager from '@backbonedao/data-manager'
import DataViewer from '@backbonedao/data-viewer'
import DataDB from '@backbonedao/data-db'
import Network from '@backbonedao/network-node'
import { CoreConfig } from '../common/interfaces'
import { buf2hex, decodeCoreData, emit, encodeCoreData, error, log } from '../common'
import default_config from '../bbconfig'
import _ from 'lodash'
import b4a from 'b4a'
import { createHash, keyPair } from '@backbonedao/crypto'
import { Operation } from '../models'
import getStorage from './get_storage'

const CORES = {}

class CoreClass {
  config: CoreConfig
  datamanager: any // needs types
  address: string
  address_hash: string
  network: any // needs types
  datadb: any // needs types
  dataviewer: any // needs types
  protocol: any
  writer_key: string
  index_key: string
  connection_id: string
  encryption_key: b4a
  writer: any
  index: any
  meta: any
  metadb: any
  network_refresh_timer: any

  constructor(config: CoreConfig, protocol: any) {
    // Set the config and protocol
    this.config = {
      network: {
        bootstrap: default_config.network.bootstrap_servers,
        simplePeer: {
          config: {
            iceServers: [
              {
                urls: default_config.network.stunturn_servers,
              },
            ],
          },
        },
      },
      ...config,
    }
    this.protocol = protocol

    // Get storage medium and create new Data Manager
    const { storage, storage_id } = getStorage(config)
    this.datamanager = CORES[storage_id] || new DataManager(storage)

    // Simple in-memory cache to avoid duplicate Data Managers
    if (!CORES[storage_id]) CORES[storage_id] = this.datamanager
  }

  async init(this: CoreClass) {
    const self = this

    // Setup encryption
    let encryptionKey
    if (this.config?.encryption_key !== false && typeof this.config.encryption_key === 'string') {
      encryptionKey = b4a.from(createHash(this.config.encryption_key), 'hex')
      this.encryption_key = encryptionKey
    } else encryptionKey = null

    // Setup data stores
    let writer_conf = { encryptionKey }
    let index_conf = { encryptionKey }
    let meta_conf = { encryptionKey }

    if (this.config.key) {
      // ... if key is provided, use it to create a new keypair for the core
      writer_conf['keyPair'] = keyPair(createHash(this.config.key + 'writer'))
      index_conf['keyPair'] = keyPair(createHash(this.config.key + 'index'))
      meta_conf['keyPair'] = keyPair(createHash(this.config.key + 'meta'))
    } else {
      // ... if not, use names
      writer_conf['name'] = 'writer'
      index_conf['name'] = 'index'
      meta_conf['name'] = 'meta'
    }

    // Initialize data cores
    this.writer = this.datamanager.get(writer_conf)
    this.index = this.datamanager.get(index_conf)
    this.meta = this.datamanager.get(meta_conf)
    await this.writer.ready()
    await this.index.ready()
    await this.meta.ready()

    this.writer_key = buf2hex(this.writer.key)
    this.index_key = buf2hex(this.index.key)

    // Setup backbone:// address
    this.address = this.config.address
    if (!this.address.match('backbone://'))
      this.address_hash = createHash(`backbone://${this.config.address}`)
    else this.address_hash = createHash(this.config.address)

    // Initialize DataViewer
    this.dataviewer = new DataViewer({
      localInput: this.writer,
      inputs: [this.writer],
      outputs: [],
      localOutput: this.index,
      autostart: true,
      unwrap: true,
      async apply(operations) {
        // Process incoming operations
        const data = self.datadb.batch({ update: false })
        for (const { value } of operations) {
          const o = decodeCoreData(value)
          const op = new Operation(o)
          try {
            // Run operation through protocol
            await self.protocol(
              op,
              // Data API
              {
                put: async (params: { key: string; value: any }) => {
                  if (typeof params === 'string' || !params?.key || !params?.value)
                    throw new Error('INVALID PARAMS')
                  const encoded_data = encodeCoreData(params.value)
                  await data.put(params.key, encoded_data)
                  const value = await data.get(params.key)
                  if (value?.value.toString() === encoded_data.toString()) return
                  console.log('FAIL', params.key, value, encoded_data)
                  throw new Error('PUT FAILED')
                },
                del: async (key: string) => {
                  return data.del(key)
                },
                get: async (key: string) => {
                  const dat = await data.get(key)
                  if (!dat) return null
                  return decodeCoreData(dat.value)
                },
                query: async function (params: {
                  gte: string
                  lte: string
                  gt: string
                  lt: string
                  limit?: number
                  stream?: boolean
                  reverse?: boolean
                }) {
                  if (!params?.limit) params.limit = 100
                  const stream = data.createReadStream(params)
                  if (params?.stream) return stream
                  return new Promise((resolve, reject) => {
                    const bundle: string[] = []
                    stream.on('data', (data) => {
                      bundle.push(decodeCoreData(data.value))
                    })
                    stream.on('end', () => {
                      resolve(bundle)
                    })
                  })
                },
              },
              // DataViewer view API
              {
                get: async (key: string) => {
                  const data = await self.datadb.get(key)
                  if (!data) return null
                  return decodeCoreData(data.value)
                },
                query: async function (params: {
                  gte: string
                  lte: string
                  limit?: number
                  stream?: boolean
                  reverse?: boolean
                }) {
                  if (!params?.limit) params.limit = 100
                  const stream = self.datadb.createReadStream(params)
                  if (params?.stream) return stream
                  return new Promise((resolve, reject) => {
                    const bundle: string[] = []
                    stream.on('data', (data) => {
                      bundle.push(decodeCoreData(data.value))
                    })
                    stream.on('end', () => {
                      resolve(bundle)
                    })
                  })
                },
              }
            )
          } catch (error) {
            throw error
          }
        }
        // Update Dataviewer
        await data.flush()
      },
    })

    // Setup MetaDB for Core metadata
    this.metadb = new DataDB(this.meta, {
      extension: false,
      keyEncoding: 'utf-8',
      valueEncoding: 'json',
    })

    // If known peers exists, add them
    const peers = (await this.metadb.get('peers')) || []
    if (peers?.value) {
      for (const key of peers?.value) {
        if (key !== this.writer_key) {
          await this.addPeer({ key, pass_check: true })
        }
      }
    }

    // Add trusted peers (pre-computed views)
    for (const key of this.config.trusted_peers || []) {
      if (key !== this.index_key) {
        await this.addTrustedPeer({ key })
      }
    }

    await this.dataviewer.ready()

    // Setup Data aggregation layer
    this.datadb = new DataDB(this.dataviewer.view, {
      extension: false,
      keyEncoding: 'utf-8',
      valueEncoding: 'binary',
    })

    log(`initialized Core ${this.writer_key} / ${this.index_key}`)

    // Setup automated key exchange extension
    const kp = keyPair(this.address_hash)
    const root = this.datamanager.get(b4a.from(kp.publicKey, 'hex'))
    await root.ready()

    const addPeersExt = root.registerExtension('key-exchange', {
      encoding: 'json',
      onmessage: async (msg) => {
        msg.peers.forEach((key) => {
          // Add peers to the Core
          if (key !== this.writer_key) {
            emit({
              ch: 'network',
              msg: `Peer: ${this.writer_key.slice(0, 8)} got key ${key} from peer`,
            })

            this.addPeer({ key })
          }
        })
        msg.trusted_peers.forEach((key) => {
          // Add trusted peers to the Core
          // disabled because there needs to be a mechanism to approve trusted peers to be added
          return
          if (key !== this.index_key) {
            emit({
              ch: 'network',
              msg: `Trusted peer: ${this.index_key.slice(0, 8)} got key ${key} from peer`,
            })

            this.addTrustedPeer({ key })
          }
        })
      },
    })

    root.on('peer-add', (peer) => {
      addPeersExt.send(
        {
          peers: this.dataviewer.inputs.map((core) => buf2hex(core.key)),
          trusted_peers: this.dataviewer.outputs.map((core) => buf2hex(core.key)),
        },
        peer
      )
      emit({
        ch: 'network',
        msg: `${this.writer_key.slice(0, 8)} Added peer`,
      })
    })

    // Debug log Core details
    emit({
      ch: 'network',
      msg: `discovery keys:\nwriter: ${buf2hex(this.writer.discoveryKey)}\nindex: ${buf2hex(
        this.index.discoveryKey
      )}\nroot: ${buf2hex(root.discoveryKey)}`,
    })
    emit({
      ch: 'network',
      msg: `public keys:\nwriter: ${buf2hex(this.writer.key)}\nindex: ${buf2hex(
        this.index.key
      )}\nroot: ${buf2hex(root.key)}`,
    })
  }
  async connect(this: CoreClass, use_unique_swarm?: boolean) {
    if (!this.config?.network) throw new Error('CONNECT NEEDS NETWORK CONFIG')
    if (this.config.private) throw new Error('ACCESS DENIED - PRIVATE CORE')

    const network_config: {
      bootstrap?: string[]
      simplePeer?: { config: { iceServers: [{ urls: string[] }] } }
      firewall?: Function
      keyPair?: { publicKey: b4a; secretKey: b4a }
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

    emit({
      ch: 'network',
      msg: `network id:\nhex: ${buf2hex(this.config.network_id?.publicKey)}\nbuf: ${
        this.config.network_id?.publicKey
      }`,
    })

    let self = this
    async function connectToNetwork() {
      // const swarm = use_unique_swarm ? new Swarm(network_config) : await getSwarm(network_config) //
      // const swarm = await getSwarm(network_config) //new Swarm(network_config)
      const network = Network(network_config)

      network.on('connection', async (socket, peer) => {
        emit({
          ch: 'network',
          msg: `nid: ${buf2hex(self.config.network_id?.publicKey).slice(0, 8)} | address: ${buf2hex(
            self.address_hash
          ).slice(0, 8)}, peers: ${network.peers.size}, conns: ${
            network.ws.connections.size
          } - new connection from ${buf2hex(peer.peer.host).slice(0, 8)}`,
        })

        const r = socket.pipe(self.datamanager.replicate(peer.client)).pipe(socket)
        r.on('error', (err) => {
          if (err.message !== 'UTP_ETIMEOUT' || err.message !== 'Duplicate connection')
            error(err.message)
        })
      })
      emit({
        ch: 'network',
        msg: `Connecting to ${buf2hex(self.address_hash)} (backbone://${
          self.address
        }) with connection id ...`, //${buf2hex(swarm.keyPair.publicKey)}
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
    }
    this.network = await connectToNetwork()
    this.dataviewer.view.update()

    // for faster restarts
    process.once('SIGINT', () => {
      this.network.destroy()
    })

    this.connection_id = buf2hex(this.network.webrtc.id)
    return this.network
  }

  async disconnect(this: CoreClass) {
    // if (this.swarm) this.swarm.destroy()
    clearInterval(this.network_refresh_timer)
  }

  async getKeys(this: CoreClass) {
    return {
      writers: [...this.dataviewer.inputs.map((i) => buf2hex(i.key))],
      indexes: [
        ...this.dataviewer.outputs.map((i) => buf2hex(i.key)),
        buf2hex(this.dataviewer.localOutput.key),
      ],
    }
  }

  async addPeer(this: CoreClass, opts: { key: string; pass_check?: boolean }) {
    const { key } = opts
    const peers = await this.metadb.get('peers')
    if (!peers?.value || peers?.value.indexOf(key) === -1 || opts.pass_check) {
      const w = peers?.value || []
      if (w.indexOf(key) === -1) {
        // TODO: implement status in peers [active | frozen | destroyed]
        w.push(key)
        await this.metadb.put('peers', w)
      }
      const k = b4a.from(key, 'hex')
      const v = await this.datamanager.get({
        key: k,
        publicKey: k,
        encryptionKey: this.encryption_key,
      })
      this.dataviewer.addInput(v)
      emit({ ch: 'network', msg: `added peer ${key} to ${this.connection_id || 'n/a'}` })
    }
  }

  async removePeer(this: CoreClass, opts: { key: string, destroy?: boolean }) {
    const { key } = opts
    // TODO: implement marking peers as frozen or destroyed in metadb
    const k = b4a.from(key, 'hex')
    this.dataviewer.removeInput(
      this.datamanager.get({ key: k, publicKey: k, encryptionKey: this.encryption_key })
    )
    emit({ ch: 'network', msg: `removed peer ${key} from ${this.connection_id || 'n/a'}` })
  }

  async addTrustedPeer(this: CoreClass, opts: { key: string, pass_check?: boolean, destroy?: boolean }) {
    const { key } = opts
    if (key === (await this.index_key)) return null
    const trusted_peers = await this.metadb.get('trusted_peers')
    if (!trusted_peers?.value || trusted_peers?.value.indexOf(key) === -1 || opts.pass_check) {
      const w = trusted_peers?.value || []
      if (w.indexOf(key) === -1) {
        w.push(key)
        await this.metadb.put('trusted_peers', w)
      }
    const k = b4a.from(key, 'hex')
    this.dataviewer.addOutput(
      this.datamanager.get({
        key: k,
        publicKey: k,
        encryptionKey: this.encryption_key,
      })
    )
    emit({ ch: 'network', msg: `added trusted peer ${key} to ${this.connection_id || 'n/a'}` })
    }
  }

  async removeTrustedPeer(this: CoreClass, opts: { key: string, destroy?: boolean }) {
    const { key } = opts
    if (key === (await this.index_key)) return null
    const k = b4a.from(key, 'hex')
    this.dataviewer.removeOutput(
      this.datamanager.get({ key: k, publicKey: k, encryptionKey: this.encryption_key })
    )
    emit({ ch: 'network', msg: `removed trusted peer ${key} from ${this.connection_id || 'n/a'}` })
  }
}

async function Core(params: { config: CoreConfig; app: { API: Function; Protocol: Function } }) {
  const { config } = params
  const C = new CoreClass(config, params.app.Protocol)
  await C.init()
  const API: any = {
    connect: async (use_unique_swarm) => C.connect(use_unique_swarm),
    disconnect: async () => C.disconnect(),
    getKeys: async () => C.getKeys(),
    addPeer: async (key) => C.addPeer(key),
    removePeer: async (key) => C.removePeer(key),
    addTrustedPeer: async (key) => C.addTrustedPeer(key),
    removeTrustedPeer: async (key) => C.removeTrustedPeer(key),
    getWriterKey: () => C.writer_key,
    getIndexKey: () => C.index_key,
    getConnectionId: () => C.connection_id,
    getNetwork: () => C.network,
    _: {
      getWriter: () => C.writer,
      getIndex: () => C.index,
      getManager: () => C.datamanager,
      getViewer: () => C.dataviewer,
      getViewerView: () => C.dataviewer.view,
    },
  }

  const protocolAPI = await params.app.API(
    {
      get: async (key: string) => {
        const data = await C.datadb.get(key)
        if (!data) return null
        return decodeCoreData(data.value)
      },
      query: async function (params: {
        gte: string
        lte: string
        limit?: number
        stream?: boolean
        reverse?: boolean
        include_meta?: boolean
      }) {
        if (!params?.limit) params.limit = 100
        const stream = C.datadb.createReadStream(params)
        if (params?.stream) return stream
        return new Promise((resolve, reject) => {
          const bundle: object[] = []
          stream.on('data', (data) => {
            const val = decodeCoreData(data.value)
            if (params.include_meta) {
              bundle.push({ value: val, i: data.seq, key: data.key })
            } else bundle.push(val)
          })
          stream.on('end', () => {
            resolve(bundle)
          })
        })
      },
    },
    async function (op) {
      const o = new Operation(op)
      const op_buf = encodeCoreData(op)
      await C.dataviewer.append(op_buf)
      await C.dataviewer.view.update()
    }
  )
  for (const method in protocolAPI) {
    if (method.charAt(0) !== '_') {
      API[method] = async function (...args: any[]) {
        return protocolAPI[method](...args)
      }
    }
  }
  return API
}

export default Core
