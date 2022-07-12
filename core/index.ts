// import DataManager from '../../data-manager'
// import DataViewer from '../../data-viewer'
// import DataDB from '../../data-db'
// import Network from '../../network-node'
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
// import { unpack } from 'msgpackr'

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
  meta_key: any
  meta_index: any
  metaviewer: any
  metadb: any
  metaprotocol: any
  network_refresh_timer: any
  mode: 'read' | 'write'
  connected_peers: number = 0
  peers_cache: {
    peers: any
    trusted_peers: any
  } = { peers: {}, trusted_peers: {} }

  constructor(config: CoreConfig, protocol?: any) {
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
    this.protocol = protocol || async function () {}

    // Get storage medium and create new Data Manager
    const { storage, storage_id } = getStorage(config)
    this.datamanager = CORES[storage_id] || new DataManager(storage)

    // Simple in-memory cache to avoid duplicate Data Managers
    if (!CORES[storage_id]) CORES[storage_id] = this.datamanager
  }

  async init(this: CoreClass) {
    const self = this

    // Setup backbone:// address
    this.address = this.config.address
    if (!this.address.match('backbone://'))
      this.address_hash = createHash(`backbone://${this.config.address}`)
    else this.address_hash = createHash(this.config.address)

    // if id wasn't supplied, this is read-only Core
    if (!this.config.id) this.mode = 'read'
    else {
      if (!this.config.key) return error(`Core key needs to be supplied if opened in write mode`)

      // mix key with address_hash to create unique combination
      // this way Backbone app can have multiple Cores with same key
      this.config.key = this.config.key + this.address_hash

      // set mode to write
      this.mode = 'write'
    }

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
    let meta_index_conf = { encryptionKey }

    if (this.config.key) {
      // ... if key is provided, use it to create a new keypair for the core
      writer_conf['keyPair'] = keyPair(createHash(this.config.key + 'writer'))
      index_conf['keyPair'] = keyPair(createHash(this.config.key + 'index'))
      meta_conf['keyPair'] = keyPair(createHash(this.config.key + 'meta'))
      meta_index_conf['keyPair'] = keyPair(createHash(this.config.key + 'meta_index'))
    } else {
      // ... if not, use names
      writer_conf['name'] = 'writer'
      index_conf['name'] = 'index'
      meta_conf['name'] = 'meta'
      meta_index_conf['name'] = 'meta_index'
    }

    // Initialize data cores
    this.writer = this.datamanager.get(writer_conf)
    this.index = this.datamanager.get(index_conf)
    this.meta = this.datamanager.get(meta_conf)
    this.meta_index = this.datamanager.get(meta_index_conf)
    await this.writer.ready()
    await this.index.ready()
    await this.meta.ready()
    await this.meta_index.ready()

    this.writer_key = buf2hex(this.writer.key)
    this.index_key = buf2hex(this.index.key)
    this.meta_key = buf2hex(this.meta.key)

    async function getDataAPI(data) {
      return {
        put: async (params: { key: string; value: any }) => {
          if (typeof params === 'string' || !params?.key || !params?.value)
            return error('INVALID PARAMS')
          const encoded_data = encodeCoreData(params.value)
          await data.put(params.key, encoded_data)
          const value = await data.get(params.key)
          if (value?.value.toString() === encoded_data.toString()) return
          console.log('FAIL', params.key, value, encoded_data)
          return error('PUT FAILED')
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
      }
    }

    // Initialize DataViewer for Meta
    // @ts-ignore
    this.metaviewer = new DataViewer({
      localInput: this.meta,
      inputs: [this.meta],
      outputs: [],
      localOutput: this.meta_index,
      autostart: true,
      unwrap: true,
      eagerUpdate: true,
      // sparse: true,
      view: (core) =>
        new DataDB(core.unwrap(), {
          keyEncoding: 'utf-8',
          valueEncoding: 'binary',
          extension: false,
        }),
      async apply(data, operations) {
        // Process incoming operations
        const dat = data.batch({ update: false })
        const DataAPI = await getDataAPI(dat)
        for (const { value } of operations) {
          const o = decodeCoreData(value)
          const op = new Operation(o)
          try {
            switch (op.type) {
              // Bootloader Protocol APIs
              case 'set':
                await DataAPI.put({ key: o.key, value: o.value })
                break
              // Add any protocols here that needs to be built-in
            }
          } catch (error) {
            throw error
          }
        }
        // Update Dataviewer
        await dat.flush()
      },
    })
    this.metadb = this.metaviewer.view
    await this.metaviewer.ready()

    // Initialize DataViewer for Data
    // @ts-ignore
    this.dataviewer = new DataViewer({
      localInput: this.writer,
      inputs: [this.writer],
      outputs: [],
      localOutput: this.index,
      autostart: true,
      unwrap: true,
      eagerUpdate: true,
      //sparse: true,
      view: (core) =>
        new DataDB(core.unwrap(), {
          keyEncoding: 'utf-8',
          valueEncoding: 'binary',
          extension: false,
        }),
      async apply(data, operations) {
        // Process incoming operations
        const dat = data.batch({ update: false })
        const DataAPI = await getDataAPI(dat)
        for (const { value } of operations) {
          const o = decodeCoreData(value)
          const op = new Operation(o)
          await self.protocol(
            op,
            // Data API
            DataAPI,
            // Id API
            // Expose id functions only if in write mode
            this.mode === 'write'
              ? {
                  sign: {},
                }
              : null,
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
        }

        // Update Dataviewer
        await dat.flush()
      },
    })
    this.datadb = this.dataviewer.view
    await this.dataviewer.ready()

    log(`initialized Core ${this.writer_key} / ${this.index_key}`)

    // Setup automated key exchange extension
    const kp = keyPair(this.address_hash)
    const root = this.datamanager.get(b4a.from(kp.publicKey, 'hex'))
    await root.ready()

    function _addPeer(params: { key: string; partition: 'data' | 'meta' }) {
      // Add peers to the Core
      if (params.key !== self.writer_key && params.key !== self.meta_key) {
        self.addPeer(params)
      }
    }

    function _addTrustedPeer(params: { key: string; partition: 'data' | 'meta' }) {
      // Add trusted peers to the Core
      // disabled because there needs to be a mechanism to approve trusted peers to be added
      return
      if (params.key !== self.index_key) {
        emit({
          ch: 'network',
          msg: `Trusted peer: ${self.index_key.slice(0, 8)} got key ${params.key} from peer`,
        })

        self.addTrustedPeer(params)
      }
    }
    const addPeersExt = root.registerExtension('key-exchange', {
      encoding: 'json',
      onmessage: async (msg) => {
        msg.data.peers.forEach((key) => {
          _addPeer({ key, partition: 'data' })
        })
        msg.meta.peers.forEach((key) => {
          _addPeer({ key, partition: 'meta' })
        })
        msg.data.trusted_peers.forEach((key) => {
          _addTrustedPeer({ key, partition: 'data' })
        })
        msg.meta.trusted_peers.forEach((key) => {
          _addTrustedPeer({ key, partition: 'meta' })
        })
      },
    })

    root.on('peer-add', (peer) => {
      addPeersExt.send(
        {
          data: {
            peers: this.dataviewer.inputs.map((core) => buf2hex(core.key)),
            trusted_peers: this.dataviewer.outputs.map((core) => buf2hex(core.key)),
          },
          meta: {
            peers: this.metaviewer.inputs.map((core) => buf2hex(core.key)),
            trusted_peers: this.metaviewer.outputs.map((core) => buf2hex(core.key)),
          },
        },
        peer
      )
      emit({
        ch: 'network',
        msg: `${this.writer_key.slice(0, 8)} Added peer`,
      })
    })

    // Update known peers cache
    await this._updatePeerCache()

    // Debug log Core details
    emit({
      ch: 'init',
      msg: `discovery keys:\nwriter: ${buf2hex(this.writer.discoveryKey)}\nindex: ${buf2hex(
        this.index.discoveryKey
      )}\nroot: ${buf2hex(root.discoveryKey)} \nmeta: ${buf2hex(this.meta.discoveryKey)}`,
    })
    emit({
      ch: 'init',
      msg: `public keys:\nwriter: ${buf2hex(this.writer.key)}\nindex: ${buf2hex(
        this.index.key
      )}\nroot: ${buf2hex(root.key)} \nmeta: ${buf2hex(this.meta.key)}`,
    })
  }
  async connect(
    this: CoreClass,
    opts?: { use_unique_swarm?: boolean; local_only?: { initiator: boolean } }
  ) {
    if (this.network) return error('NETWORK EXISTS')
    if (!this.config?.network) return error('CONNECT NEEDS NETWORK CONFIG')
    if (this.config.private) return error('ACCESS DENIED - PRIVATE CORE')

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

    let self = this
    async function connectToNetwork() {
      try {
        const network = Network(network_config)

        network.on('connection', async (socket, peer) => {
          emit({
            ch: 'network',
            msg: `nid: ${buf2hex(self.config.network_id?.publicKey).slice(
              0,
              8
            )} | address: ${buf2hex(self.address_hash).slice(0, 8)}, peers: ${
              network.peers.size
            }, conns: ${network.ws.connections.size} - new connection from ${buf2hex(
              peer.peer.host
            ).slice(0, 8)}`,
          })

          const r = socket.pipe(self.datamanager.replicate(peer.client)).pipe(socket)
          r.on('error', (err) => {
            if (err.message !== 'UTP_ETIMEOUT' || err.message !== 'Duplicate connection')
              error(err.message)
          })
          self.connected_peers++
        })
        emit({
          ch: 'network',
          msg: `Connecting to ${buf2hex(self.address_hash)} (backbone://${
            self.address
          }) with connection id ${buf2hex(self.config.network_id?.publicKey)}`,
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
      this.connection_id = buf2hex(this.network.webrtc.id)
      emit({
        ch: 'network',
        msg: `Connection id: ${this.connection_id}`,
      })
    } else {
      emit({
        ch: 'network',
        msg: `Using local connection`,
      })
      this.network = this.datamanager.replicate(opts?.local_only?.initiator, { live: true })
    }
    this.dataviewer.view.update()

    // for faster restarts
    process.once('SIGINT', () => {
      this.network.destroy()
    })

    return this.network
  }

  async disconnect(this: CoreClass) {
    if (this.network) this.network.destroy()
    //clearInterval(this.network_refresh_timer)
  }

  async getKeys(this: CoreClass) {
    return {
      data: {
        writers: [...this.dataviewer.inputs.map((i) => buf2hex(i.key))],
        indexes: [
          ...this.dataviewer.outputs.map((i) => buf2hex(i.key)),
          buf2hex(this.dataviewer.localOutput.key),
        ],
      },
      meta: {
        writers: [...this.metaviewer.inputs.map((i) => buf2hex(i.key))],
        indexes: [
          ...this.metaviewer.outputs.map((i) => buf2hex(i.key)),
          buf2hex(this.metaviewer.localOutput.key),
        ],
      },
    }
  }

  async _updatePeerCache(this: CoreClass) {
    const peers_val = await this.metadb.get('peers')
    const trusted_peers_val = await this.metadb.get('trusted_peers')
    if (peers_val?.value) {
      this.peers_cache.peers = decodeCoreData(peers_val.value)
    } else this.peers_cache.peers = {}
    if (trusted_peers_val?.value) {
      this.peers_cache.trusted_peers = decodeCoreData(trusted_peers_val.value)
    } else this.peers_cache.trusted_peers = {}
  }

  async _changePeerStatus(
    this: CoreClass,
    opts: {
      key: string
      type?: 'peer' | 'trusted_peer'
      partition: 'data' | 'meta'
      status: 'active' | 'frozen' | 'destroyed'
    }
  ) {
    const { key, status, type = 'peer', partition } = opts
    const peers = this.peers_cache[type + 's']
    if (peers[key]) {
      peers[key].status = status
    } else {
      peers[key] = {
        status,
        type,
        partition,
      }
    }
    // await this.metadb.put(type + 's', encodeCoreData(peers))
    this.peers_cache[type + 's'] = peers
    await this.metaprotocol({
      type: 'set',
      key: type + 's',
      value: peers,
    })
  }

  async addKnownPeers(this: CoreClass, params: { partition: 'data' | 'meta' }) {
    // If known peers exists, add them
    const peers = this.peers_cache.peers
    emit({
      ch: 'network',
      msg: `Adding ${
        Object.keys(peers).filter((p) => peers[p].partition === params.partition).length
      } known peers for ${params.partition} partition`,
    })
    for (const key in peers) {
      if (
        peers[key]?.partition === params.partition &&
        key !== this.writer_key &&
        key !== this.meta_key
      ) {
        if (peers[key].status === 'active' || peers[key].status === 'frozen') {
          await this.addPeer({
            key,
            skip_status_change: true,
            partition: peers[key].partition,
          })
        }

        if (peers[key].status === 'frozen') {
          // replace core with snapshot
          // NOTE: we are sort of trusting that core hasn't updated and eager isn't on
          switch (peers[key].partition) {
            case 'data':
              const dataviewer_i = this.dataviewer.inputs.findIndex((core) =>
                b4a.equals(core.key, key)
              )
              if (dataviewer_i >= 0) {
                const snapshot = this.dataviewer.inputs[dataviewer_i].snapshot()
                await snapshot.ready()
                this.dataviewer._inputsByKey.set(key, snapshot)
              } else {
                return emit({ ch: 'error', msg: `couldn't snapshot dataviewer core ${key}` })
              }
              break
            case 'meta':
              const metaviewer_i = this.metaviewer.inputs.findIndex((core) =>
                b4a.equals(core.key, key)
              )
              if (metaviewer_i >= 0) {
                const snapshot = this.metaviewer.inputs[metaviewer_i].snapshot()
                await snapshot.ready()
                this.metaviewer._inputsByKey.set(key, snapshot)
              } else {
                return emit({ ch: 'error', msg: `couldn't snapshot metaviewer core ${key}` })
              }
              break
            default:
              error('unknown partition')
              break
          }
        }
      } else {
        // console.log(peers.length)
      }
    }

    // Add trusted peers (pre-computed views)
    const trusted_peers = this.peers_cache.trusted_peers

    for (const key in trusted_peers) {
      if (key !== this.writer_key) {
        if (trusted_peers[key].status === 'active' || trusted_peers[key].status === 'frozen') {
          await this.addTrustedPeer({
            key,
            skip_status_change: true,
            partition: trusted_peers[key].partition,
          })
        }

        if (trusted_peers[key].status === 'frozen') {
          // replace core with snapshot
          // NOTE: we are sort of trusting that core hasn't updated and eager isn't on
          const dataviewer_i = this.dataviewer.outputs.findIndex((core) =>
            b4a.equals(core.key, key)
          )
          const metaviewer_i = this.metaviewer.outputs.findIndex((core) =>
            b4a.equals(core.key, key)
          )

          if (dataviewer_i >= 0) {
            const snapshot = this.dataviewer.outputs[dataviewer_i].snapshot()
            await snapshot.ready()
            this.dataviewer._outputsByKey.set(key, snapshot)
          } else {
            return emit({ ch: 'error', msg: `couldn't dataviewer snapshot core ${key}` })
          }

          if (metaviewer_i >= 0) {
            const snapshot = this.metaviewer.outputs[metaviewer_i].snapshot()
            await snapshot.ready()
            this.metaviewer._outputsByKey.set(key, snapshot)
          } else {
            return emit({ ch: 'error', msg: `couldn't metaviewer snapshot core ${key}` })
          }
        }
      }
    }
  }

  async addPeer(
    this: CoreClass,
    opts: { key: string; partition: 'data' | 'meta'; skip_status_change?: boolean }
  ) {
    const { key, partition } = opts
    emit({
      ch: 'network',
      msg: `Trying to add peer ${partition}/${key} to ${this.connection_id || 'n/a'}`,
    })

    if (key === (await this.writer_key) || key === (await this.meta_key)) return null
    const dataviewer_keys = this.dataviewer.inputs.map((core) => buf2hex(core.key))
    const metaviewer_keys = this.metaviewer.inputs.map((core) => buf2hex(core.key))

    if (dataviewer_keys.indexOf(key) != -1) return
    if (metaviewer_keys.indexOf(key) != -1) return
    if (!opts.skip_status_change)
      await this._changePeerStatus({
        key,
        status: 'active',
        type: 'peer',
        partition: opts.partition,
      })
    const k = b4a.from(key, 'hex')
    const c = await this.datamanager.get({
      key: k,
      publicKey: k,
      encryptionKey: this.encryption_key,
    })
    await c.ready()
    switch (partition) {
      case 'data':
        setTimeout(async () => {
          await this.dataviewer.addInput(c)
        }, 100)
        break
      case 'meta':
        setTimeout(async () => {
          await this.metaviewer.addInput(c)
        }, 100)
        break
      default:
        return error('partition not specified')
    }
    emit({ ch: 'network', msg: `Added peer ${partition}/${key} to ${this.connection_id || 'n/a'}` })
  }

  async removePeer(
    this: CoreClass,
    opts: { key: string; partition: 'data' | 'meta'; destroy?: boolean }
  ) {
    const { key, destroy, partition } = opts
    const k = b4a.from(key, 'hex')
    if (destroy) {
      const c = this.datamanager.get({ key: k, publicKey: k, encryptionKey: this.encryption_key })
      switch (partition) {
        case 'data':
          this.dataviewer.removeInput(c)
          break
        case 'meta':
          this.metaviewer.removeInput(c)
          break
        default:
          return error('partition not specified')
      }
    } else {
      // replace core with snapshot
      const core_i = this.dataviewer.inputs.findIndex((core) => b4a.equals(core.key, k))

      if (core_i >= 0) {
        const snapshot = this.dataviewer.inputs[core_i].snapshot()
        await snapshot.ready()
        this.dataviewer._inputsByKey.set(key, snapshot)
      } else {
        return emit({ ch: 'error', msg: `couldn't snapshot core ${key}` })
      }
    }
    // mark core as frozen or destroyed in the metadb
    await this._changePeerStatus({ key, status: destroy ? 'destroyed' : 'frozen', partition })

    emit({
      ch: 'network',
      msg: `removed peer ${partition}/${key} from ${this.connection_id || 'n/a'}`,
    })
  }

  async addTrustedPeer(
    this: CoreClass,
    opts: { key: string; partition: 'data' | 'meta'; skip_status_change?: boolean }
  ) {
    const { key, partition } = opts
    if (key === (await this.index_key)) return null
    if (!opts.skip_status_change)
      await this._changePeerStatus({ key, status: 'active', type: 'trusted_peer', partition })

    const k = b4a.from(key, 'hex')
    const c = this.datamanager.get({
      key: k,
      publicKey: k,
      encryptionKey: this.encryption_key,
    })
    switch (partition) {
      case 'data':
        this.dataviewer.addOutput(c)
        break
      case 'meta':
        this.metaviewer.addOutput(c)
      default:
        return error('unknown protocol')
    }
    emit({
      ch: 'network',
      msg: `added trusted peer ${partition}/${key} to ${this.connection_id || 'n/a'}`,
    })
  }

  async removeTrustedPeer(
    this: CoreClass,
    opts: { key: string; partition: 'data' | 'meta'; destroy?: boolean }
  ) {
    const { key, destroy, partition } = opts
    if (key === (await this.index_key)) return null
    const k = b4a.from(key, 'hex')
    if (destroy) {
      // remove core from outputs (destroy history as well)
      const c = this.datamanager.get({ key: k, publicKey: k, encryptionKey: this.encryption_key })
      switch (partition) {
        case 'data':
          this.dataviewer.removeOutput(c)
          break
        case 'meta':
          this.metaviewer.removeOutput(c)
          break
        default:
          return error('unknown protocol')
      }
    } else {
      // replace core with snapshot
      switch (partition) {
        case 'data':
          const dataviewer_i = this.dataviewer.outputs.findIndex((core) => b4a.equals(core.key, k))

          if (dataviewer_i >= 0) {
            const snapshot = this.dataviewer.outputs[dataviewer_i].snapshot()
            await snapshot.ready()
            this.dataviewer._outputsByKey.set(key, snapshot)
            // mark core as frozen in the metadb
          } else {
            return emit({ ch: 'error', msg: `couldn't snapshot core ${key}` })
          }
          break
        case 'meta':
          const metaviewer_i = this.metaviewer.outputs.findIndex((core) => b4a.equals(core.key, k))

          if (metaviewer_i >= 0) {
            const snapshot = this.metaviewer.outputs[metaviewer_i].snapshot()
            await snapshot.ready()
            this.metaviewer._outputsByKey.set(key, snapshot)
            // mark core as frozen in the metadb
          } else {
            return emit({ ch: 'error', msg: `couldn't snapshot core ${partition}/${key}` })
          }
          break
        default:
          return error('unknown protocol')
      }
    }
    await this._changePeerStatus({ key, status: destroy ? 'destroyed' : 'frozen', partition })

    emit({
      ch: 'network',
      msg: `removed trusted peer ${partition}/${key} from ${this.connection_id || 'n/a'}`,
    })
  }
}

async function Core(params: {
  config: CoreConfig
  app?: { API: Function; Protocol: Function }
}): Promise<any> {
  const { config } = params

  // Create new Core
  const C = new CoreClass(config)

  // Run init function
  await C.init()

  // Create default API for Core
  const API: any = {
    connect: async (opts: { local_only: { initiator: boolean } }) => C.connect(opts),
    disconnect: async () => C.disconnect(),
    getKeys: async () => C.getKeys(),
    addPeer: async (opts) => C.addPeer(opts),
    removePeer: async (opts) => C.removePeer(opts),
    addTrustedPeer: async (opts) => C.addTrustedPeer(opts),
    removeTrustedPeer: async (opts) => C.removeTrustedPeer(opts),
    getWriterKey: () => C.writer_key,
    getIndexKey: () => C.index_key,
    getConnectionId: () => C.connection_id,
    metadb: C.metadb,
    getNetwork: () => C.network,
    _: {
      // Sort of private functions for debugging, maybe remove these in the future?
      getWriter: () => C.writer,
      getIndex: () => C.index,
      getManager: () => C.datamanager,
      getViewer: () => C.dataviewer,
      getViewerView: () => C.dataviewer.view,
    },
  }

  // Protocol Bridge is a factory function to create standardized bridges for partitions
  const protocolBridge = async function (viewer) {
    // Bridge receives operation from API
    return async function (op) {
      const o = new Operation(op) // validate the op
      const op_buf = encodeCoreData(op)
      // Add operation to data viewer
      await viewer.append(op_buf)
      // Update data viewer to run apply() function
      await viewer.view.update()
    }
  }

  // Initializes app's API & protocol
  // Feeds arguments to API(Data, Protocol) in apps
  async function appInit(API, Protocol) {
    return API(
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
      Protocol
    )
  }

  // Extends container's default API with app's API methods
  async function injectAppAPI(appAPI) {
    for (const method in appAPI) {
      // Add methods from appAPI, unless prefixed with _ marking it private
      if (method.charAt(0) !== '_') {
        API[method] = async function (...args: any[]) {
          return appAPI[method](...args)
        }
      }
    }
  }

  // Create meta partition bridge
  C.metaprotocol = await protocolBridge(C.metaviewer)

  // Quick & dirty key/value app for meta partition
  API['_getMeta'] = async (key: string) => {
    const data = await C.metadb.get(key)
    if (!data) return null
    return decodeCoreData(data.value)
  }
  API['_allMeta'] = async () => {
    const data = await C.metadb.query({ lt: '~' })
    if (!data) return null
    return decodeCoreData(data)
  }
  API['_setMeta'] = async (params: { key: string; value: string }) => {
    await C.metaprotocol({
      type: 'set',
      key: params.key,
      value: params.value,
    })
  }
  // Add known peers to meta partition
  await C.addKnownPeers({ partition: 'meta' })

  // Return a promise while we try to get the container code
  return new Promise(async (resolve, reject) => {
    try {
      // General function meant to be run after code has been found
      async function startCore(Protocol, appAPI) {
        // Add protocol to the core
        C.protocol = Protocol
        // Init the app code and create protocol bridge to data partition
        const app = await appInit(appAPI, await protocolBridge(C.dataviewer))
        // Inject App API to container's default API
        await injectAppAPI(app)
        // Add known peers for data partition
        await C.addKnownPeers({ partition: 'data' })
        // If we haven't connected to backbone:// yet, do it now
        if (!(await API.getNetwork()))
          await C.connect(
            params?.config?.connect?.local_only
              ? { local_only: params?.config?.connect?.local_only }
              : {}
          )

        log(`Container initialized successfully`)
        resolve(API)
      }
      if (params.app?.Protocol && params.app?.API) {
        // Meant mostly for testing purposes
        log(`App provided as argument, loading...`)
        await startCore(params.app.Protocol, params.app.API)
      } else {
        log(`Loading app...`)
        // Check if we have already downloaded the code
        const code = await API['_getMeta']('code')
        if (code?.code) {
          // Code was found locally, so let's try to eval it
          const app = Function(code.code + ';return app')()
          if (!app.Protocol) return reject('app loading failed')
          // All good, so start container with the eval'ed app
          await startCore(app.Protocol, app.API)
        } else {
          // Code was not found locally, so we need to connect to peers and get the code...
          log(`No code found, querying peers for code, standby...`)
          await API.connect(
            params?.config?.connect?.local_only
              ? { local_only: params?.config?.connect?.local_only }
              : {}
          )

          // 60sec timeout sounds reasonable for most network conditions
          let timeout = 60
          const interval = setInterval(async () => {
            // Get the container's network and see if we have peers connected
            const n = await API.getNetwork()
            if (n._peers.size > 0) {
              // Peers found, so try to download the code
              log(`Got peers, loading code...`)
              const code = await API['_getMeta']('code')
              if (code?.code) {
                // Code found, so clean up and try to eval it
                clearInterval(interval)
                const app = Function(code.code + ';return app')()
                if (!app.Protocol) return reject('app loading failed')

                // All good, so start container with the eval'ed app
                await startCore(app.Protocol, app.API)
              } else {
                log(`No code found, trying again...`)
              }
            }
            timeout--
            // Timeout hit, so clean up and stop trying :(
            if (timeout <= 0 && !params?.config?.disable_timeout) {
              clearInterval(interval)
              return reject('no peers found')
            }
          }, 5000)
        }
      }
    } catch (error) {
      return reject(error)
    }
  })
}

export default Core
