import Store from '@backbonedao/data-manager'
import Rebase from '@backbonedao/data-viewer'
import DataDB from '@backbonedao/data-db'
import Swarm from '@backbonedao/network-node'
// import Store from '../../backbone-data-manager'
// import Rebase from '../../data-viewer'
// import DataDB from '../../backbone-data-db'
// import Swarm from '../../backbone-network-node'
import platform from 'platform-detect'
import RAM from 'random-access-memory'
import RAI from 'random-access-idb'
// import RAW from 'random-access-web'
// import RACF from 'random-access-chrome-file'
import { CoreConfig } from '../common/interfaces'
import { buf2hex, decodeCoreData, emit, encodeCoreData, error, getHomedir, log } from '../common'
import { generateNoiseKeypair, sha256 } from '../common/crypto'
import { homedir } from 'os'
import default_config from '../bbconfig'
import _ from 'lodash'
import b4a from 'b4a'
import { createHash, keyPair } from '@backbonedao/crypto'

export function getStorage(bb_config: CoreConfig) {
  if (!bb_config) throw new Error('GETSTORAGE REQUIRES CORECONFIG')
  let storage: string | object

  if (bb_config?.storage === 'ram') {
    log('RAM storage requested, using memory for storage')
    storage = RAM
  } else if (bb_config?.env === 'node' || platform?.node) {
    log('Node runtime detected, using file system for storage')
    const prefix = bb_config?.storage_prefix ? `${bb_config?.storage_prefix}/` : ''
    // split the path in chunks of two letters to avoid creating file explorer killing directories
    const pathname = bb_config.address.match(/.{1,2}/g)?.join('/')
    storage = process.env.TEST
      ? `${homedir()}/.backbone-test/${prefix}${pathname}`
      : `${getHomedir()}/${prefix}${pathname}`
  } else {
    log('Browser runtime detected, using RAI for storage')
    storage = RAI()
  }
  const storage_id: string = bb_config?.storage_prefix
    ? bb_config.address + bb_config.storage_prefix
    : bb_config.address
  return { storage, storage_id }
}

const CORES = {}

class CoreClass {
  config: CoreConfig
  store: any // needs types
  address: string
  swarm: any // needs types
  kv: any // needs types
  drive: any // needs types
  rebase: any // needs types
  protocol: any
  rebased_index: any // needs types
  writer_key: string
  index_key: string
  connection_id: string
  encryption_key: b4a
  writer: any
  index: any
  swarm_refresh_timer: any

  constructor(config: CoreConfig, protocol: any) {
    this.config = {
      network: {
        bootstrap: default_config.network.bootstrap_servers,
        // simplePeer: {
        //   config: {
        //     iceServers: [
        //       {
        //         urls: default_config.network.stunturn_servers,
        //       },
        //     ],
        //   },
        // },
      },
      ...config,
    }
    const { storage, storage_id } = getStorage(config)
    this.store = CORES[storage_id] || new Store(storage)
    if (!CORES[storage_id]) CORES[storage_id] = this.store
    this.protocol = protocol
  }

  async init(this: CoreClass) {
    const self = this

    // init cores
    let encryptionKey
    if (this.config?.encryption_key !== false && typeof this.config.encryption_key === 'string') {
      encryptionKey = b4a.from(this.config.encryption_key, 'hex')
      this.encryption_key = encryptionKey
    } else encryptionKey = null
    const writer = this.store.get({ name: 'writer', encryptionKey })
    const index = this.store.get({ name: 'index', encryptionKey })
    await writer.ready()
    await index.ready()

    this.writer_key = buf2hex(writer.key)
    this.index_key = buf2hex(index.key)
    this.address = this.config.address

    // init index
    this.rebase = new Rebase({
      localInput: writer,
      inputs: [writer],
      outputs: [],
      localOutput: index,
      autostart: true,
      unwrap: true,
      async apply(batch) {
        const index = self.kv.batch({ update: false })
        for (const { value } of batch) {
          const op = decodeCoreData(value)
          try {
            await self.protocol(
              op,
              {
                put: async (params: { key: string; value: any }) => {
                  if (typeof params === 'string' || !params?.key || !params?.value)
                    throw new Error('INVALID PARAMS')
                  const encoded_data = encodeCoreData(params.value)
                  await index.put(params.key, encoded_data)
                  const value = await index.get(params.key)
                  if (value?.value.toString() === encoded_data.toString()) return
                  console.log('FAIL', params.key, value, encoded_data)
                  throw new Error('PUT FAILED')
                },
                del: async (key: string) => {
                  return index.del(key)
                },
                get: async (key: string) => {
                  const data = await index.get(key)
                  if (!data) return null
                  return decodeCoreData(data.value)
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
                  const stream = index.createReadStream(params)
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
              {
                get: async (key: string) => {
                  const data = await self.kv.get(key)
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
                  const stream = self.kv.createReadStream(params)
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

        await index.flush()
      },
    })

    // add remote writers
    for (const key of this.config.writers || []) {
      if (key !== this.writer_key) {
        await this.addWriter({ key })
      }
    }

    // add remote indexes
    for (const key of this.config.indexes || []) {
      if (key !== this.index_key) {
        await this.addIndex({ key })
      }
    }

    await this.rebase.ready()

    // init index generator
    this.rebased_index = this.rebase.view

    // init kv
    this.kv = new DataDB(this.rebased_index, {
      extension: false,
      keyEncoding: 'utf-8',
      valueEncoding: 'binary',
    })

    log(`initialized Core ${this.writer_key} / ${this.index_key}`)

    // Automated key exchange extension
    const shatopic = createHash(`backbone://${this.address}`)
    const kp = keyPair(shatopic)
    const root = this.store.get(b4a.from(kp.publicKey, 'hex'))
    await root.ready()

    const addWritersExt = root.registerExtension('polycore', {
      encoding: 'json',
      onmessage: async (msg) => {
        msg.writers.forEach((key) => {
          emit({
            ch: 'network',
            msg: `${this.writer_key.slice(0, 8)} got key ${key} from peer`,
          })
          this.addWriter({ key })
        })
      },
    })

    root.on('peer-add', (peer) => {
      addWritersExt.send(
        {
          writers: this.rebase.inputs.map((core) => buf2hex(core.key)),
        },
        peer
      )
      emit({
        ch: 'network',
        msg: `${this.writer_key.slice(0, 8)} Added peer`,
      })
    })

    this.writer = writer
    this.index = index
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
    if (this.config.networkId) {
      network_config.keyPair = this.config.networkId
    }

    let self = this
    async function connectToSwarm() {
      // const swarm = use_unique_swarm ? new Swarm(network_config) : await getSwarm(network_config) //
      // const swarm = await getSwarm(network_config) //new Swarm(network_config)
      const swarm = Swarm(network_config)
      const shatopic = sha256(`backbone://${self.address}`)
      const topic = b4a.from(shatopic, 'hex')

      swarm.on('connection', async (socket, peer) => {
        /* if (buf2hex(swarm.keyPair.publicKey) !== buf2hex(peer.publicKey)) {
          emit({
            ch: 'network',
            msg: `cid: ${buf2hex(swarm.keyPair.publicKey).slice(0, 8)} | addr: ${self.address.slice(
              0,
              8
            )} | topic: ${buf2hex(topic).slice(0, 8)}, peers: ${swarm.peers.size}, conns: ${
              swarm.connections.size
            }, prioritized: ${peer.prioritized} - new connection from ${buf2hex(
              peer.publicKey
            ).slice(0, 8)}`,
          })
        } */
        console.log('Connection', peer)
        const r = socket.pipe(self.store.replicate(peer.client)).pipe(socket)
        // const r = self.store.replicate(socket, { live: true })
        // console.log('r', r)
        r.on('error', (err) => {
          if (err.message !== 'UTP_ETIMEOUT' || err.message !== 'Duplicate connection')
            error(err.message)
        })
      })
      emit({
        ch: 'network',
        msg: `Connecting to ${shatopic} (backbone://${self.address}) with connection id ...`, //${buf2hex(swarm.keyPair.publicKey)}
      })
      // @ts-ignore
      swarm.join(Buffer.isBuffer(topic) ? topic : Buffer.from(topic, 'hex'))
      // @ts-ignore
      await swarm.flush(() => {})
      return swarm
    }
    this.swarm = await connectToSwarm()
    this.rebased_index.update()

    // for faster restarts
    process.once('SIGINT', () => {
      this.swarm.destroy()
    })

    this.connection_id = buf2hex(this.swarm.webrtc.id)
    return this.swarm
  }

  async disconnect(this: CoreClass) {
    // if (this.swarm) this.swarm.destroy()
    clearInterval(this.swarm_refresh_timer)
  }

  async getKeys(this: CoreClass) {
    return {
      writers: [...this.rebase.inputs.map((i) => buf2hex(i.key))],
      indexes: [
        ...this.rebase.outputs.map((i) => buf2hex(i.key)),
        buf2hex(this.rebase.localOutput.key),
      ],
    }
  }

  async addWriter(this: CoreClass, opts: { key: string }) {
    const { key } = opts

    if (key === (await this.writer_key)) {
      emit({ ch: 'network', msg: `duplicated writer key ${key}` })
      return null
    }
    const k = b4a.from(key, 'hex')
    this.rebase.addInput(
      this.store.get({
        key: k,
        publicKey: k,
        encryptionKey: this.encryption_key,
      })
    )
    emit({ ch: 'network', msg: `added writer ${key} to ${this.connection_id || 'n/a'}` })
  }

  async removeWriter(this: CoreClass, opts: { key: string }) {
    const { key } = opts
    if (key === (await this.index_key)) return null
    const k = b4a.from(key, 'hex')
    this.rebase.removeInput(
      this.store.get({ key: k, publicKey: k, encryptionKey: this.encryption_key })
    )
    emit({ ch: 'network', msg: `removed writer ${key} from ${this.connection_id || 'n/a'}` })
  }

  async addIndex(this: CoreClass, opts: { key: string }) {
    const { key } = opts
    if (key === (await this.index_key)) return null
    const k = b4a.from(key, 'hex')
    this.rebase.addOutput(
      this.store.get({
        key: k,
        publicKey: k,
        encryptionKey: this.encryption_key,
      })
    )
    emit({ ch: 'network', msg: `added index ${key} to ${this.connection_id || 'n/a'}` })
  }

  async removeIndex(this: CoreClass, key: string) {
    if (key === (await this.index_key)) return null
    const k = b4a.from(key, 'hex')
    this.rebase.removeOutput(
      this.store.get({ key: k, publicKey: k, encryptionKey: this.encryption_key })
    )
    emit({ ch: 'network', msg: `removed index ${key} from ${this.connection_id || 'n/a'}` })
  }
}

async function Core(params: { config: CoreConfig; app: { API: Function; Protocol: Function } }) {
  const { config } = params
  // const protocol = typeof config.protocol === 'string' ? Protocol[config.protocol] : config.protocol
  const C = new CoreClass(config, params.app.Protocol)
  await C.init()
  const API: any = {
    connect: async (use_unique_swarm) => C.connect(use_unique_swarm),
    disconnect: async () => C.disconnect(),
    getKeys: async () => C.getKeys(),
    addWriter: async (key) => C.addWriter(key),
    removeWriter: async (key) => C.removeWriter(key),
    addIndex: async (key) => C.addIndex(key),
    removeIndex: async (key) => C.removeIndex(key),
    getWriterKey: () => C.writer_key,
    getIndexKey: () => C.index_key,
    getConnectionId: () => C.connection_id,
  }

  const protocolAPI = await params.app.API(
    {
      get: async (key: string) => {
        const data = await C.kv.get(key)
        if (!data) return null
        return decodeCoreData(data.value)
      },
      query: async function (params: {
        gte: string
        lte: string
        limit?: number
        stream?: boolean
        reverse?: boolean
        i?: boolean
      }) {
        if (!params?.limit) params.limit = 100
        const stream = C.kv.createReadStream(params)
        if (params?.stream) return stream
        return new Promise((resolve, reject) => {
          const bundle: object[] = []
          stream.on('data', (data) => {
            const val = decodeCoreData(data.value)
            if (params.i) {
              bundle.push({ value: val, i: data.seq })
            } else bundle.push(val)
          })
          stream.on('end', () => {
            resolve(bundle)
          })
        })
      },
    },
    async function (op) {
      const op_buf = encodeCoreData(op)
      await C.rebase.append(op_buf)
      await C.rebased_index.update()
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
