import DataManager from '@foundation0/data-manager'
import DataViewer from '@foundation0/data-viewer'
import DataDB from '@foundation0/data-db'
import { CoreConfig } from '../common/interfaces'
import {
  buf2hex,
  decodeCoreData,
  emit,
  encodeCoreData,
  error,
  log,
  subscribeToEvent,
  subscribeToChannel,
  base64,
} from '../common'
import default_config from '../bbconfig'
import _ from 'lodash'
import b4a from 'b4a'
import { createHash, keyPair } from '@foundation0/crypto'
import { Operation } from '../models'
import Storage from './storage'
import {
  addKnownUsers,
  addUser,
  addTrustedUser,
  removeUser,
  removeTrustedUser,
} from '../network/users'
import { connect } from '../network'
import { get, set, createStore } from 'idb-keyval'
import { pack, unpack } from 'msgpackr'
import fs from 'fs'
import mkdirp from 'mkdirp'

let appsCache
let bypassCache = false
if (typeof window === 'object') {
  const store = createStore('apps-cache', 'dc')
  appsCache = {
    get: async (key) => {
      const raw_data = await get(key, store)
      return raw_data ? unpack(raw_data) : false
    },
    set: async (key, value) => {
      return set(key, pack(value), store)
    },
  }
  if (localStorage.getItem('DEV')) bypassCache = true
} else {
  appsCache = {
    get: async (key) => {
      await mkdirp(`${__dirname}/.cache/`)
      try {
        const raw_data = fs.readFileSync(`${__dirname}/.cache/${key}`)
        return raw_data ? unpack(raw_data) : false
      } catch (e) {
        return false
      }
    },
    set: async (key, value) => {
      await mkdirp(`${__dirname}/.cache/`)
      fs.writeFileSync(`${__dirname}/.cache/${key}`, pack(value))
      return true
    },
  }
}

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
  connected_users: number = 0
  users_cache: {
    users: any
    trusted_users: any
  } = { users: {}, trusted_users: {} }

  constructor(config: CoreConfig, protocol?: any) {
    // Set the config and protocol
    this.config = {
      network: {
        bootstrap: default_config.network.bootstrap_servers,
        simplePeer: {
          config: {
            iceServers: default_config.network.stunturn_servers(),
          },
          sdpSemantics: 'unified-plan',
          bundlePolicy: 'max-bundle',
          iceCandidatePoolsize: 1,
        },
      },
      ...config,
    }
    this.protocol = protocol || async function () {}

    // Get storage medium and create new Data Manager
    const { storage, storage_id } = Storage(config)
    this.datamanager = CORES[storage_id] || new DataManager(storage)

    // Simple in-memory cache to avoid duplicate Data Managers
    if (!CORES[storage_id]) CORES[storage_id] = this.datamanager
  }

  async init(this: CoreClass) {
    const self = this

    // Setup dc:// address
    this.address = this.config.address
    if (!this.address.match('dc://'))
      this.address_hash = createHash(`dc://${this.config.address}`)
    else this.address_hash = createHash(this.config.address)

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
    
    await this._applyEventLogging({ core: this.writer, id: 'writer' })
    await this._applyEventLogging({ core: this.index, id: 'index' })
    await this._applyEventLogging({ core: this.meta, id: 'meta' })
    await this._applyEventLogging({ core: this.meta_index, id: 'meta_index' })
    
    await this.writer.ready()
    await this.index.ready()
    await this.meta.ready()
    await this.meta_index.ready()

    this.writer_key = buf2hex(this.writer.key)
    this.index_key = buf2hex(this.index.key)
    this.meta_key = buf2hex(this.meta.key)

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
        const DataAPI = await self.getDataAPI(dat)
        for (const { value } of operations) {
          const o = decodeCoreData(value)
          const op: any = new Operation(o)
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
      autostart: false,

      //sparse: true,
    })

    await this.dataviewer.ready()

    emit({ ch: 'core', msg: `Initialized Core ${this.address}` })

    // Setup automated key exchange extension
    const kp = keyPair(this.address_hash)
    const root = this.datamanager.get(b4a.from(kp.publicKey, 'hex'))
    await root.ready()

    function _addUser(params: { key: string; partition: 'data' | 'meta' }) {
      // Add users to the Core
      if (params.key !== self.writer_key && params.key !== self.meta_key) {
        self.addUser(params)
      }
    }

    function _addTrustedUser(params: { key: string; partition: 'data' | 'meta' }) {
      // Add trusted users to the Core
      // disabled because there needs to be a mechanism to approve trusted users to be added
      return
      if (params.key !== self.index_key) {
        emit({
          ch: 'network',
          msg: `Trusted user: ${self.index_key.slice(0, 8)} got key ${params.key} from user`,
        })

        self.addTrustedUser(params)
      }
    }
    const addPeersExtension = root.registerExtension('key-exchange', {
      encoding: 'json',
      onmessage: async (msg) => {
        const data_users = msg?.data?.users || msg?.data?.peers
        data_users.forEach((key) => {
          _addUser({ key, partition: 'data' })
        })
        const meta_users = msg?.meta?.users || msg?.meta?.peers
        meta_users.forEach((key) => {
          _addUser({ key, partition: 'meta' })
        })
        const data_trusted_users = msg?.data?.trusted_users || msg?.data?.trusted_peers
        data_trusted_users.forEach((key) => {
          _addTrustedUser({ key, partition: 'data' })
        })
        const meta_trusted_users = msg?.meta?.trusted_users || msg?.meta?.trusted_peers
        meta_trusted_users.forEach((key) => {
          _addTrustedUser({ key, partition: 'meta' })
        })
      },
    })

    root.on('peer-add', (user) => {
      addPeersExtension.send(
        {
          data: {
            users: this.dataviewer.inputs.map((core) => buf2hex(core.key)),
            trusted_users: this.dataviewer.outputs.map((core) => buf2hex(core.key)),
          },
          meta: {
            users: this.metaviewer.inputs.map((core) => buf2hex(core.key)),
            trusted_users: this.metaviewer.outputs.map((core) => buf2hex(core.key)),
          },
        },
        user
      )
      emit({
        ch: 'network',
        msg: `New user detected, saying hello...`,
      })
    })

    // Update known users cache
    await this._updateUserCache()

    // Debug log Core details
    emit({
      ch: 'init',
      msg: `discovery keys:\nwriter: ${buf2hex(this.writer.discoveryKey)}\nindex: ${buf2hex(
        this.index.discoveryKey
      )}\nroot: ${buf2hex(root.discoveryKey)} \nmeta: ${buf2hex(this.meta.discoveryKey)}`,
      verbose: true,
    })
    emit({
      ch: 'init',
      msg: `public keys:\nwriter: ${buf2hex(this.writer.key)}\nindex: ${buf2hex(
        this.index.key
      )}\nroot: ${buf2hex(root.key)} \nmeta: ${buf2hex(this.meta.key)}`,
      verbose: true,
    })
  }
  async _applyEventLogging(params: { id: string, core: any }) {
    params.core.on('download', (index, data) => {
      emit({ ch: `_:core:download`, msg: { id: params.id, index, data, length: data.length }})
    })
    params.core.on('upload', (index, data) => {
      emit({ ch: `_:core:upload`, msg: { id: params.id, index, data, length: data.length }})
    })
    params.core.on('append', () => {
      emit({ ch: `_:core:append`, msg: { id: params.id }})
    })
    params.core.on('sync', () => {
      emit({ ch: `_:core:sync`, msg: { id: params.id }})
    })
    params.core.on('close', () => {
      emit({ ch: `_:core:close`, msg: { id: params.id }})
    })
  }
  async getDataAPI(this: CoreClass, data) {
    const API = {
      put: async (params: { key: string; value: any }) => {
        if (typeof params === 'string' || !params?.key || !params?.value)
          return error('INVALID PARAMS')

        if (typeof params?.key !== 'string') return error('key must be a string or a number')

        let unsigned = false
        Object.keys(params).forEach((k) => {
          // if item has _meta, we need to flatten it
          if (params[k]._meta) {
            if (params[k]._meta?.unsigned) unsigned = true
            params[k] = params[k].flatten()
          }
        })
        if (unsigned) {
          await data.del(params.key)
          return error('unsigned data detected in protocol, discarding...')
        }
        const encoded_data = encodeCoreData(params.value)
        if (!encoded_data) return error('put needs data')

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
        try {
          const dat = await data.get(key, { update: false })
          if (!dat) return null
          return decodeCoreData(dat.value)
        } catch (error) {
          return null
        }
      },
      getAll: async () => {
        return API.query({ lt: '~' })
      },
      discard: async (op: { type: string; data: any }, reason?: string) => {
        await data.put('_trash', '1')
        await data.del('_trash')
        return error(
          `protocol discarded an operation ${reason ? `(${reason})` : ''}: ${JSON.stringify(
            op
          ).slice(0, 200)}`
        )
      },
      query: async function (params: {
        gte?: string
        lte?: string
        gt?: string
        lt?: string
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
    return API
  }
  async startDataViewer(this: CoreClass) {
    const self = this
    self.dataviewer.start({
      view: (core) =>
        new DataDB(core.unwrap(), {
          keyEncoding: 'utf-8',
          valueEncoding: 'binary',
          extension: false,
        }),
      unwrap: true,
      eagerUpdate: true,
      async apply(datadb, operations) {
        // Process incoming operations
        const db = datadb.batch({ update: false })

        // failsafe in case protocol crashes
        const failsafe = setTimeout(async function () {
          await db.flush()
        }, 15000)

        const DataAPI = await self.getDataAPI(db)
        for (const { value } of operations) {
          const o = decodeCoreData(value)
          const op = new Operation(o)
          await self.protocol(
            op,
            // Data API
            DataAPI
          )
        }

        // Update Dataviewer
        await db.flush()

        clearTimeout(failsafe)
      },
    })
    self.datadb = self.dataviewer.view
  }
  async _updatePartitions(this: CoreClass) {
    await this.dataviewer.view.update()
    await this.metaviewer.view.update()
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

  async _updateUserCache(this: CoreClass) {
    const users_val = await this.metadb.get('users')
    const trusted_users_val = await this.metadb.get('trusted_users')
    if (users_val?.value) {
      this.users_cache.users = decodeCoreData(users_val.value)
    } else this.users_cache.users = {}
    if (trusted_users_val?.value) {
      this.users_cache.trusted_users = decodeCoreData(trusted_users_val.value)
    } else this.users_cache.trusted_users = {}
  }

  async _changeUserStatus(
    this: CoreClass,
    opts: {
      key: string
      type?: 'user' | 'trusted_user'
      partition: 'data' | 'meta'
      status: 'active' | 'frozen' | 'destroyed'
    }
  ) {
    const { key, status, type = 'user', partition } = opts
    const users = this.users_cache[type + 's']
    if (users[key]) {
      users[key].status = status
    } else {
      users[key] = {
        status,
        type,
        partition,
      }
    }
    // await this.metadb.put(type + 's', encodeCoreData(users))
    this.users_cache[type + 's'] = users
    await this.metaprotocol({
      type: 'set',
      key: type + 's',
      value: users,
    })
  }

  connect = connect
  addKnownUsers = addKnownUsers
  addUser = addUser
  removeUser = removeUser
  addTrustedUser = addTrustedUser
  removeTrustedUser = removeTrustedUser
}

async function checkExistingInstance(config) {
  if (typeof window === 'object' && localStorage.getItem(config.address)) {
    if (
      confirm(
        `Detected potentially another instance of this app running.\n\nPlease close the instance and click ok.\n\nIf this is wrong, click cancel. Beware, running two instances in same browser can result to corrupt data.`
      )
    )
      await checkExistingInstance(config)
    else localStorage.removeItem(config.address)
  }
}

function enableGracefulExit(C, config) {
  // for faster restarts
  if (typeof window === 'object') {
    window.addEventListener(
      'beforeunload',
      async () => {
        emit({
          ch: 'network',
          msg: 'beforeunload event received, cleaning up...',
        })
        localStorage.removeItem(config.address)
        await C.network.destroy()
      },
      { capture: true }
    )
  } else if (typeof global === 'object') {
    process.once('SIGINT', async () => {
      emit({ ch: 'network', msg: 'SIGINT event received, cleaning up...' })
      await C.network.destroy()
    })
  }
}

async function Core(params: {
  config: CoreConfig
  app?: { API: Function; Protocol: Function; ui?: Function }
}): Promise<any> {
  const { config } = params

  // Make sure there's no other instance running on the same VM because that causes corruption in IndexedDB
  await checkExistingInstance(config)

  // Create new Core
  const C = new CoreClass(config)

  enableGracefulExit(C, config)

  // Run init function
  await C.init()
  if (typeof window === 'object')
    localStorage.setItem(config.address, new Date().getTime().toString())

  // Create default API for Core
  const API: any = {
    users: {
      addUser: async (opts) => C.addUser(opts),
      removeUser: async (opts) => C.removeUser(opts),
      addTrustedUser: async (opts) => C.addTrustedUser(opts),
      removeTrustedUser: async (opts) => C.removeTrustedUser(opts),
    },
    meta: {
      getAppVersion: async () => {
        const manifest = await API.meta['_getMeta']('manifest')
        if (!manifest) return error('no manifest found')
        return manifest?.version
      },
      getKeys: async () => C.getKeys(),
    },
    network: {
      getConnectionId: () => C.connection_id,
      getNetwork: () => C.network,
      connect: async (opts: { local_only: { initiator: boolean } }) => C.connect(opts),
      disconnect: async () => C.disconnect(),
    },
    _: {
      on: async (id, cb) => () => subscribeToEvent({ id, cb }),
      listenLog: async (ch, cb) => () => subscribeToChannel({ ch, cb }),
    },
  }

  // Protocol Bridge is a factory function to create standardized bridges for partitions
  const protocolBridge = async function (viewer) {
    // Bridge receives operation from API
    return async function (op) {
      let unsigned = false
      Object.keys(op).forEach((k) => {
        // if item has _meta, we need to flatten it
        if (op[k]?._meta) {
          if (op[k]?._meta?.unsigned) unsigned = true
          op[k] = op[k].flatten()
        }
      })
      if (unsigned) {
        return error('unsigned data detected in API')
      }
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
    const bAPI = {
      onAdd: async (cb) => {
        let last_length = 0
        const timer = setInterval(function () {
          if (last_length < C.dataviewer.localOutput.length) {
            cb(C.dataviewer.localOutput.length)
            last_length = C.dataviewer.localOutput.length
          }
        }, 10)
        return function stopListening() {
          clearInterval(timer)
        }
      },
      get: async (key: string) => {
        try {
          const data = await C.datadb.get(key)
          if (!data) return null
          return decodeCoreData(data.value)
        } catch (error) {
          return null
        }
      },
      getAll: async (params?: { model: any }) => {
        const raw_items = await bAPI.query({ lt: '~', include_meta: true })
        let items
        if (typeof params?.model === 'function') {
          // Apply model to each
          items = await Promise.all(
            raw_items
              .map((item) => {
                if (!item.key.match(/^_/)) {
                  try {
                    return params.model(item.value)
                  } catch (error) {
                    console.log('invalid data', item, error)
                  }
                }
              })
              .filter((i) => i)
          )
        } else items = raw_items
        return items
      },
      query: async function (params: {
        gte?: string
        gt?: string
        lte?: string
        lt?: string
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
    }
    return API(bAPI, Protocol)
  }

  // Extends container's default API with app's API methods
  async function injectAppAPI(appAPI) {
    const reserved_words = ['users', 'meta', 'network', '_']
    for (const method in appAPI) {
      // Add methods from appAPI, unless prefixed with _ marking it private
      if (method.charAt(0) !== '_' && reserved_words.indexOf(method) === -1) {
        API[method] = async function (...args: any[]) {
          return appAPI[method](...args)
        }
      }
    }
  }

  // Create meta partition bridge
  C.metaprotocol = await protocolBridge(C.metaviewer)

  // Quick & dirty key/value app for meta partition
  API.meta['_getMeta'] = async (key: string) => {
    const data = await C.metadb.get(key)
    if (!data) return null
    return decodeCoreData(data.value)
  }
  API.meta['_allMeta'] = async () => {
    const data = await C.metadb.query({ lt: '~' })
    if (!data) return null
    return decodeCoreData(data)
  }
  API.meta['_setMeta'] = async (params: { key: string; value: string }) => {
    await C.metaprotocol({
      type: 'set',
      key: params.key,
      value: params.value,
    })
  }
  // Add known users to meta partition
  await C.addKnownUsers({ partition: 'meta' })

  // For browser UI
  let logUI
  if (typeof window === 'object' && typeof window['appendMsgToUI'] === 'function') {
    logUI = window['appendMsgToUI']
  }

  async function startAppInBrowser(code): Promise<{ Protocol: any; API: any }> {
    return new Promise((resolve, reject) => {
      if (typeof window !== 'object' && !document.body) return error('is this a browser?')
      const app_container = document.createElement('script')
      app_container.setAttribute('id', 'app-container')
      document.body.appendChild(app_container)
      app_container.onload = function () {
        resolve(window['app']?.default || window['app'])
      }
      app_container.setAttribute('src', `data:text/javascript;base64,${base64.encode(code)}`)
    })
  }
  async function startUIInBrowser(code): Promise<boolean> {
    return new Promise((resolve, reject) => {
      if (typeof window !== 'object' && !document.body) return error('is this a browser?')
      const ui_container = document.createElement('script')
      ui_container.setAttribute('id', 'ui-container')
      document.body.appendChild(ui_container)
      ui_container.onload = function () {
        resolve(window['ui']?.default || window['ui'])
      }
      ui_container.setAttribute('src', `data:text/javascript;base64,${base64.encode(code)}`)
    })
  }
  // Return a promise while we try to get the container code
  return new Promise(async (resolve, reject) => {
    try {
      // General function meant to be run after code has been found
      async function startCore(Protocol, appAPI, UI) {
        // Add protocol to the core
        C.protocol = Protocol
        // Init the app code and create protocol bridge to data partition
        const app = await appInit(appAPI, await protocolBridge(C.dataviewer))

        // Inject App API to container's default API
        await injectAppAPI(app)
        // Add known users for data partition
        await C.addKnownUsers({ partition: 'data' })

        await C.startDataViewer()
        // Render UI if one is found
        if (typeof window === 'object' && UI) {
          if (logUI) logUI('Rendering user interface...')
          API.UI = await startUIInBrowser(UI)
        }

        emit({ ch: 'core', msg: `Container initialized successfully` })
        if (logUI) logUI('Container initialized')

        // If we haven't connected to dc:// yet, do it now
        const net = await API.network.getNetwork()
        if (!net)
          setTimeout(function () {
            C.connect(
              params?.config?.connect?.local_only
                ? { local_only: params?.config?.connect?.local_only }
                : {}
            )
          }, 1000)

        resolve(API)
      }

      if (params.app?.Protocol && params.app?.API) {
        // Meant mostly for testing purposes
        emit({ ch: 'core', msg: `App provided as argument, loading...` })
        await startCore(params.app.Protocol, params.app.API, params?.app?.ui)
      } else {
        if (params.config.private)
          return reject(
            'Private mode is on, but no code was found. Please start core with app when using private mode.'
          )
        emit({ ch: 'core', msg: `Loading app...` })
        if (logUI) logUI('Loading app...')

        // Check if we have already downloaded the code (only works on browsers for now)
        let cached_code
        let cached_manifest
        if (appsCache && !bypassCache) {
          cached_code = await appsCache.get(`${config.address}/code`)
          cached_manifest = await appsCache.get(`${config.address}/manifest`)
        }

        if (cached_code?.app) {
          emit({ ch: 'core', msg: `App found from cache` })
          if (logUI) logUI('App found from cache')

          // Code was found locally
          const app = await startAppInBrowser(cached_code.app)
          if (!app.Protocol) {
            let err = 'Error in executing the app code'
            // browser specific
            if (logUI) logUI(err)
            if (typeof window['reset']) window['reset']()

            return reject(err)
          }

          // All good, so start container with the eval'ed app and add UI to API
          await startCore(app.Protocol, app.API, cached_code?.ui)
        } else {
          // Code was not found locally, so we need to connect to users and get the code...
          let msg = `No code found, querying users for code, standby...`
          emit({ ch: 'core', msg })
          if (logUI) logUI(msg)

          await API.network.connect(
            params?.config?.connect?.local_only
              ? { local_only: params?.config?.connect?.local_only }
              : {}
          )

          // 60sec timeout sounds reasonable for most network conditions
          let timeout = 60
          let loading_code = false
          const interval = setInterval(async () => {
            // Get the container's network and see if we have users connected
            const n = await API.network.getNetwork()
            if (n._peers.size > 0) {
              // users found, so try to download the code
              if (!loading_code) {
                loading_code = true

                let msg = `Found other users, searching for app code...`
                emit({ ch: 'network', msg })
                if (logUI) logUI(msg)

                const code = await API.meta['_getMeta']('code')
                if (code?.app) {
                  // Code found, so clean up and try to eval it
                  clearInterval(interval)

                  // Verify security
                  if (code.signature === '!!!DEV!!!') {
                    log('APP STARTED IN DEV MODE\nWARNING: SECURITY DISABLED')
                  } else {
                    // verify
                  }

                  const manifest = await API.meta['_getMeta']('manifest')
                  if (!manifest) {
                    let err = 'No manifest found, invalid container'
                    if (logUI) logUI(err)
                    if (typeof window === 'object' && typeof window['reset'] === 'function')
                      window['reset']()
                    return error(err)
                  }
                  if (appsCache) {
                    await appsCache.set(`${config.address}/code`, code)
                    await appsCache.set(`${config.address}/manifest`, manifest)
                  }

                  if (typeof window === 'object') {
                    emit({ ch: 'core', msg: `Executing in browser environment...` })

                    const loaded_app = await startAppInBrowser(code.app)
                    let timeout_timer
                    const app_loader_timer = setInterval(async function () {
                      // let loaded_app = window['dc']?.app?.default || window['dc'].app
                      if (loaded_app?.Protocol && loaded_app?.API) {
                        clearInterval(app_loader_timer)
                        clearTimeout(timeout_timer)
                        await startCore(loaded_app.Protocol, loaded_app.API, code?.ui)
                      }
                    }, 5)

                    // just in case
                    timeout_timer = setTimeout(function () {
                      clearInterval(app_loader_timer)
                      let err = 'Unknown error in executing the app'
                      if (logUI) logUI(err)
                      if (typeof window['reset']) window['reset']()
                      return error(err)
                    }, 10000)
                  } else {
                    emit({ ch: 'core', msg: `Executing in NodeJS environment...` })
                    const app = Function(code.app + ';return app.default || app')()
                    if (!app.Protocol) return reject('app loading failed')
                    // All good, so start container with the eval'ed app
                    await startCore(app.Protocol, app.API, code?.ui)
                  }
                } else {
                  loading_code = false
                  let msg = `No code found yet, searching more...`
                  emit({ ch: 'core', msg })
                  if (logUI) logUI(msg)
                }
              }
            }
            timeout--
            // Timeout hit, so clean up and stop trying :(
            if (timeout <= 0 && !params?.config?.disable_timeout) {
              clearInterval(interval)
              let err = 'No other users found with code, are you sure the address is right?'
              if (logUI) logUI(err)
              if (typeof window['reset']) window['reset']()
              return reject(err)
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
