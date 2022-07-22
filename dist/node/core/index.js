"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const data_manager_1 = __importDefault(require("@backbonedao/data-manager"));
const data_viewer_1 = __importDefault(require("@backbonedao/data-viewer"));
const data_db_1 = __importDefault(require("@backbonedao/data-db"));
const network_node_1 = __importDefault(require("@backbonedao/network-node"));
const common_1 = require("../common");
const bbconfig_1 = __importDefault(require("../bbconfig"));
const b4a_1 = __importDefault(require("b4a"));
const crypto_1 = require("@backbonedao/crypto");
const models_1 = require("../models");
const get_storage_1 = __importDefault(require("./get_storage"));
const CORES = {};
class CoreClass {
    constructor(config, protocol) {
        this.connected_peers = 0;
        this.peers_cache = { peers: {}, trusted_peers: {} };
        this.config = {
            network: {
                bootstrap: bbconfig_1.default.network.bootstrap_servers,
                simplePeer: {
                    config: {
                        iceServers: [
                            {
                                urls: bbconfig_1.default.network.stunturn_servers,
                            },
                        ],
                    },
                },
            },
            ...config,
        };
        this.protocol = protocol || async function () { };
        const { storage, storage_id } = get_storage_1.default(config);
        this.datamanager = CORES[storage_id] || new data_manager_1.default(storage);
        if (!CORES[storage_id])
            CORES[storage_id] = this.datamanager;
    }
    async init() {
        const self = this;
        this.address = this.config.address;
        if (!this.address.match('backbone://'))
            this.address_hash = crypto_1.createHash(`backbone://${this.config.address}`);
        else
            this.address_hash = crypto_1.createHash(this.config.address);
        if (!this.config.id)
            this.mode = 'read';
        else {
            if (!this.config.key)
                return common_1.error(`Core key needs to be supplied if opened in write mode`);
            this.config.key = this.config.key + this.address_hash;
            this.mode = 'write';
        }
        let encryptionKey;
        if (this.config?.encryption_key !== false && typeof this.config.encryption_key === 'string') {
            encryptionKey = b4a_1.default.from(crypto_1.createHash(this.config.encryption_key), 'hex');
            this.encryption_key = encryptionKey;
        }
        else
            encryptionKey = null;
        let writer_conf = { encryptionKey };
        let index_conf = { encryptionKey };
        let meta_conf = { encryptionKey };
        let meta_index_conf = { encryptionKey };
        if (this.config.key) {
            writer_conf['keyPair'] = crypto_1.keyPair(crypto_1.createHash(this.config.key + 'writer'));
            index_conf['keyPair'] = crypto_1.keyPair(crypto_1.createHash(this.config.key + 'index'));
            meta_conf['keyPair'] = crypto_1.keyPair(crypto_1.createHash(this.config.key + 'meta'));
            meta_index_conf['keyPair'] = crypto_1.keyPair(crypto_1.createHash(this.config.key + 'meta_index'));
        }
        else {
            writer_conf['name'] = 'writer';
            index_conf['name'] = 'index';
            meta_conf['name'] = 'meta';
            meta_index_conf['name'] = 'meta_index';
        }
        this.writer = this.datamanager.get(writer_conf);
        this.index = this.datamanager.get(index_conf);
        this.meta = this.datamanager.get(meta_conf);
        this.meta_index = this.datamanager.get(meta_index_conf);
        await this.writer.ready();
        await this.index.ready();
        await this.meta.ready();
        await this.meta_index.ready();
        this.writer_key = common_1.buf2hex(this.writer.key);
        this.index_key = common_1.buf2hex(this.index.key);
        this.meta_key = common_1.buf2hex(this.meta.key);
        async function getDataAPI(data) {
            return {
                put: async (params) => {
                    if (typeof params === 'string' || !params?.key || !params?.value)
                        return common_1.error('INVALID PARAMS');
                    const encoded_data = common_1.encodeCoreData(params.value);
                    await data.put(params.key, encoded_data);
                    const value = await data.get(params.key);
                    if (value?.value.toString() === encoded_data.toString())
                        return;
                    console.log('FAIL', params.key, value, encoded_data);
                    return common_1.error('PUT FAILED');
                },
                del: async (key) => {
                    return data.del(key);
                },
                get: async (key) => {
                    const dat = await data.get(key);
                    if (!dat)
                        return null;
                    return common_1.decodeCoreData(dat.value);
                },
                query: async function (params) {
                    if (!params?.limit)
                        params.limit = 100;
                    const stream = data.createReadStream(params);
                    if (params?.stream)
                        return stream;
                    return new Promise((resolve, reject) => {
                        const bundle = [];
                        stream.on('data', (data) => {
                            bundle.push(common_1.decodeCoreData(data.value));
                        });
                        stream.on('end', () => {
                            resolve(bundle);
                        });
                    });
                },
            };
        }
        this.metaviewer = new data_viewer_1.default({
            localInput: this.meta,
            inputs: [this.meta],
            outputs: [],
            localOutput: this.meta_index,
            autostart: true,
            unwrap: true,
            eagerUpdate: true,
            view: (core) => new data_db_1.default(core.unwrap(), {
                keyEncoding: 'utf-8',
                valueEncoding: 'binary',
                extension: false,
            }),
            async apply(data, operations) {
                const dat = data.batch({ update: false });
                const DataAPI = await getDataAPI(dat);
                for (const { value } of operations) {
                    const o = common_1.decodeCoreData(value);
                    const op = new models_1.Operation(o);
                    try {
                        switch (op.type) {
                            case 'set':
                                await DataAPI.put({ key: o.key, value: o.value });
                                break;
                        }
                    }
                    catch (error) {
                        throw error;
                    }
                }
                await dat.flush();
            },
        });
        this.metadb = this.metaviewer.view;
        await this.metaviewer.ready();
        this.dataviewer = new data_viewer_1.default({
            localInput: this.writer,
            inputs: [this.writer],
            outputs: [],
            localOutput: this.index,
            autostart: true,
            unwrap: true,
            eagerUpdate: true,
            view: (core) => new data_db_1.default(core.unwrap(), {
                keyEncoding: 'utf-8',
                valueEncoding: 'binary',
                extension: false,
            }),
            async apply(data, operations) {
                const dat = data.batch({ update: false });
                const DataAPI = await getDataAPI(dat);
                for (const { value } of operations) {
                    const o = common_1.decodeCoreData(value);
                    const op = new models_1.Operation(o);
                    await self.protocol(op, DataAPI, this.mode === 'write'
                        ? {
                            sign: {},
                        }
                        : null, {
                        get: async (key) => {
                            const data = await self.datadb.get(key);
                            if (!data)
                                return null;
                            return common_1.decodeCoreData(data.value);
                        },
                        query: async function (params) {
                            if (!params?.limit)
                                params.limit = 100;
                            const stream = self.datadb.createReadStream(params);
                            if (params?.stream)
                                return stream;
                            return new Promise((resolve, reject) => {
                                const bundle = [];
                                stream.on('data', (data) => {
                                    bundle.push(common_1.decodeCoreData(data.value));
                                });
                                stream.on('end', () => {
                                    resolve(bundle);
                                });
                            });
                        },
                    });
                }
                await dat.flush();
            },
        });
        this.datadb = this.dataviewer.view;
        await this.dataviewer.ready();
        common_1.log(`initialized Core ${this.writer_key} / ${this.index_key}`);
        const kp = crypto_1.keyPair(this.address_hash);
        const root = this.datamanager.get(b4a_1.default.from(kp.publicKey, 'hex'));
        await root.ready();
        function _addPeer(params) {
            if (params.key !== self.writer_key && params.key !== self.meta_key) {
                self.addPeer(params);
            }
        }
        function _addTrustedPeer(params) {
            return;
            if (params.key !== self.index_key) {
                common_1.emit({
                    ch: 'network',
                    msg: `Trusted peer: ${self.index_key.slice(0, 8)} got key ${params.key} from peer`,
                });
                self.addTrustedPeer(params);
            }
        }
        const addPeersExt = root.registerExtension('key-exchange', {
            encoding: 'json',
            onmessage: async (msg) => {
                msg.data.peers.forEach((key) => {
                    _addPeer({ key, partition: 'data' });
                });
                msg.meta.peers.forEach((key) => {
                    _addPeer({ key, partition: 'meta' });
                });
                msg.data.trusted_peers.forEach((key) => {
                    _addTrustedPeer({ key, partition: 'data' });
                });
                msg.meta.trusted_peers.forEach((key) => {
                    _addTrustedPeer({ key, partition: 'meta' });
                });
            },
        });
        root.on('peer-add', (peer) => {
            addPeersExt.send({
                data: {
                    peers: this.dataviewer.inputs.map((core) => common_1.buf2hex(core.key)),
                    trusted_peers: this.dataviewer.outputs.map((core) => common_1.buf2hex(core.key)),
                },
                meta: {
                    peers: this.metaviewer.inputs.map((core) => common_1.buf2hex(core.key)),
                    trusted_peers: this.metaviewer.outputs.map((core) => common_1.buf2hex(core.key)),
                },
            }, peer);
            common_1.emit({
                ch: 'network',
                msg: `${this.writer_key.slice(0, 8)} Added peer`,
            });
        });
        await this._updatePeerCache();
        common_1.emit({
            ch: 'init',
            msg: `discovery keys:\nwriter: ${common_1.buf2hex(this.writer.discoveryKey)}\nindex: ${common_1.buf2hex(this.index.discoveryKey)}\nroot: ${common_1.buf2hex(root.discoveryKey)} \nmeta: ${common_1.buf2hex(this.meta.discoveryKey)}`,
        });
        common_1.emit({
            ch: 'init',
            msg: `public keys:\nwriter: ${common_1.buf2hex(this.writer.key)}\nindex: ${common_1.buf2hex(this.index.key)}\nroot: ${common_1.buf2hex(root.key)} \nmeta: ${common_1.buf2hex(this.meta.key)}`,
        });
    }
    async connect(opts) {
        if (this.network)
            return common_1.error('NETWORK EXISTS');
        if (!this.config?.network)
            return common_1.error('CONNECT NEEDS NETWORK CONFIG');
        if (this.config.private)
            return common_1.error('ACCESS DENIED - PRIVATE CORE');
        const network_config = this.config.network;
        common_1.emit({
            ch: 'network',
            msg: `Connect with conf: ${JSON.stringify(network_config)}`,
        });
        if (this.config.firewall)
            network_config.firewall = this.config.firewall;
        if (!this.config.network_id) {
            this.config.network_id = crypto_1.keyPair();
        }
        network_config.keyPair = this.config.network_id;
        let self = this;
        async function connectToNetwork() {
            try {
                const network = network_node_1.default(network_config);
                network.on('connection', async (socket, peer) => {
                    common_1.emit({
                        ch: 'network',
                        msg: `nid: ${common_1.buf2hex(self.config.network_id?.publicKey).slice(0, 8)} | address: ${common_1.buf2hex(self.address_hash).slice(0, 8)}, peers: ${network.peers.size}, conns: ${network.ws.connections.size} - new connection from ${common_1.buf2hex(peer.peer.host).slice(0, 8)}`,
                    });
                    const r = socket.pipe(self.datamanager.replicate(peer.client)).pipe(socket);
                    r.on('error', (err) => {
                        if (err.message !== 'UTP_ETIMEOUT' || err.message !== 'Duplicate connection')
                            common_1.error(err.message);
                    });
                    self.connected_peers++;
                });
                common_1.emit({
                    ch: 'network',
                    msg: `Connecting to ${common_1.buf2hex(self.address_hash)} (backbone://${self.address}) with connection id ${common_1.buf2hex(self.config.network_id?.publicKey)}`,
                });
                network.join(Buffer.isBuffer(self.address_hash)
                    ? self.address_hash
                    : Buffer.from(self.address_hash, 'hex'));
                await network.flush(() => { });
                return network;
            }
            catch (err) {
                common_1.error(err);
            }
        }
        if (!opts?.local_only) {
            this.network = await connectToNetwork();
            this.connection_id = common_1.buf2hex(this.network.webrtc.id);
            common_1.emit({
                ch: 'network',
                msg: `Connection id: ${this.connection_id}`,
            });
        }
        else {
            common_1.emit({
                ch: 'network',
                msg: `Using local connection`,
            });
            this.network = this.datamanager.replicate(opts?.local_only?.initiator, { live: true });
        }
        this.dataviewer.view.update();
        process.once('SIGINT', () => {
            this.network.destroy();
        });
        return this.network;
    }
    async disconnect() {
        if (this.network)
            this.network.destroy();
    }
    async getKeys() {
        return {
            data: {
                writers: [...this.dataviewer.inputs.map((i) => common_1.buf2hex(i.key))],
                indexes: [
                    ...this.dataviewer.outputs.map((i) => common_1.buf2hex(i.key)),
                    common_1.buf2hex(this.dataviewer.localOutput.key),
                ],
            },
            meta: {
                writers: [...this.metaviewer.inputs.map((i) => common_1.buf2hex(i.key))],
                indexes: [
                    ...this.metaviewer.outputs.map((i) => common_1.buf2hex(i.key)),
                    common_1.buf2hex(this.metaviewer.localOutput.key),
                ],
            },
        };
    }
    async _updatePeerCache() {
        const peers_val = await this.metadb.get('peers');
        const trusted_peers_val = await this.metadb.get('trusted_peers');
        if (peers_val?.value) {
            this.peers_cache.peers = common_1.decodeCoreData(peers_val.value);
        }
        else
            this.peers_cache.peers = {};
        if (trusted_peers_val?.value) {
            this.peers_cache.trusted_peers = common_1.decodeCoreData(trusted_peers_val.value);
        }
        else
            this.peers_cache.trusted_peers = {};
    }
    async _changePeerStatus(opts) {
        const { key, status, type = 'peer', partition } = opts;
        const peers = this.peers_cache[type + 's'];
        if (peers[key]) {
            peers[key].status = status;
        }
        else {
            peers[key] = {
                status,
                type,
                partition,
            };
        }
        this.peers_cache[type + 's'] = peers;
        await this.metaprotocol({
            type: 'set',
            key: type + 's',
            value: peers,
        });
    }
    async addKnownPeers(params) {
        const peers = this.peers_cache.peers;
        common_1.emit({
            ch: 'network',
            msg: `Adding ${Object.keys(peers).filter((p) => peers[p].partition === params.partition).length} known peers for ${params.partition} partition`,
        });
        for (const key in peers) {
            if (peers[key]?.partition === params.partition &&
                key !== this.writer_key &&
                key !== this.meta_key) {
                if (peers[key].status === 'active' || peers[key].status === 'frozen') {
                    await this.addPeer({
                        key,
                        skip_status_change: true,
                        partition: peers[key].partition,
                    });
                }
                if (peers[key].status === 'frozen') {
                    switch (peers[key].partition) {
                        case 'data':
                            const dataviewer_i = this.dataviewer.inputs.findIndex((core) => b4a_1.default.equals(core.key, key));
                            if (dataviewer_i >= 0) {
                                const snapshot = this.dataviewer.inputs[dataviewer_i].snapshot();
                                await snapshot.ready();
                                this.dataviewer._inputsByKey.set(key, snapshot);
                            }
                            else {
                                return common_1.emit({ ch: 'error', msg: `couldn't snapshot dataviewer core ${key}` });
                            }
                            break;
                        case 'meta':
                            const metaviewer_i = this.metaviewer.inputs.findIndex((core) => b4a_1.default.equals(core.key, key));
                            if (metaviewer_i >= 0) {
                                const snapshot = this.metaviewer.inputs[metaviewer_i].snapshot();
                                await snapshot.ready();
                                this.metaviewer._inputsByKey.set(key, snapshot);
                            }
                            else {
                                return common_1.emit({ ch: 'error', msg: `couldn't snapshot metaviewer core ${key}` });
                            }
                            break;
                        default:
                            common_1.error('unknown partition');
                            break;
                    }
                }
            }
            else {
            }
        }
        const trusted_peers = this.peers_cache.trusted_peers;
        for (const key in trusted_peers) {
            if (key !== this.writer_key) {
                if (trusted_peers[key].status === 'active' || trusted_peers[key].status === 'frozen') {
                    await this.addTrustedPeer({
                        key,
                        skip_status_change: true,
                        partition: trusted_peers[key].partition,
                    });
                }
                if (trusted_peers[key].status === 'frozen') {
                    const dataviewer_i = this.dataviewer.outputs.findIndex((core) => b4a_1.default.equals(core.key, key));
                    const metaviewer_i = this.metaviewer.outputs.findIndex((core) => b4a_1.default.equals(core.key, key));
                    if (dataviewer_i >= 0) {
                        const snapshot = this.dataviewer.outputs[dataviewer_i].snapshot();
                        await snapshot.ready();
                        this.dataviewer._outputsByKey.set(key, snapshot);
                    }
                    else {
                        return common_1.emit({ ch: 'error', msg: `couldn't dataviewer snapshot core ${key}` });
                    }
                    if (metaviewer_i >= 0) {
                        const snapshot = this.metaviewer.outputs[metaviewer_i].snapshot();
                        await snapshot.ready();
                        this.metaviewer._outputsByKey.set(key, snapshot);
                    }
                    else {
                        return common_1.emit({ ch: 'error', msg: `couldn't metaviewer snapshot core ${key}` });
                    }
                }
            }
        }
    }
    async addPeer(opts) {
        const { key, partition } = opts;
        common_1.emit({
            ch: 'network',
            msg: `Trying to add peer ${partition}/${key} to ${this.connection_id || 'n/a'}`,
        });
        if (key === (await this.writer_key) || key === (await this.meta_key))
            return null;
        const dataviewer_keys = this.dataviewer.inputs.map((core) => common_1.buf2hex(core.key));
        const metaviewer_keys = this.metaviewer.inputs.map((core) => common_1.buf2hex(core.key));
        if (dataviewer_keys.indexOf(key) != -1)
            return;
        if (metaviewer_keys.indexOf(key) != -1)
            return;
        if (!opts.skip_status_change)
            await this._changePeerStatus({
                key,
                status: 'active',
                type: 'peer',
                partition: opts.partition,
            });
        const k = b4a_1.default.from(key, 'hex');
        const c = await this.datamanager.get({
            key: k,
            publicKey: k,
            encryptionKey: this.encryption_key,
        });
        await c.ready();
        switch (partition) {
            case 'data':
                setTimeout(async () => {
                    await this.dataviewer.addInput(c);
                }, 100);
                break;
            case 'meta':
                setTimeout(async () => {
                    await this.metaviewer.addInput(c);
                }, 100);
                break;
            default:
                return common_1.error('partition not specified');
        }
        common_1.emit({ ch: 'network', msg: `Added peer ${partition}/${key} to ${this.connection_id || 'n/a'}` });
    }
    async removePeer(opts) {
        const { key, destroy, partition } = opts;
        const k = b4a_1.default.from(key, 'hex');
        if (destroy) {
            const c = this.datamanager.get({ key: k, publicKey: k, encryptionKey: this.encryption_key });
            switch (partition) {
                case 'data':
                    this.dataviewer.removeInput(c);
                    break;
                case 'meta':
                    this.metaviewer.removeInput(c);
                    break;
                default:
                    return common_1.error('partition not specified');
            }
        }
        else {
            const core_i = this.dataviewer.inputs.findIndex((core) => b4a_1.default.equals(core.key, k));
            if (core_i >= 0) {
                const snapshot = this.dataviewer.inputs[core_i].snapshot();
                await snapshot.ready();
                this.dataviewer._inputsByKey.set(key, snapshot);
            }
            else {
                return common_1.emit({ ch: 'error', msg: `couldn't snapshot core ${key}` });
            }
        }
        await this._changePeerStatus({ key, status: destroy ? 'destroyed' : 'frozen', partition });
        common_1.emit({
            ch: 'network',
            msg: `removed peer ${partition}/${key} from ${this.connection_id || 'n/a'}`,
        });
    }
    async addTrustedPeer(opts) {
        const { key, partition } = opts;
        if (key === (await this.index_key))
            return null;
        if (!opts.skip_status_change)
            await this._changePeerStatus({ key, status: 'active', type: 'trusted_peer', partition });
        const k = b4a_1.default.from(key, 'hex');
        const c = this.datamanager.get({
            key: k,
            publicKey: k,
            encryptionKey: this.encryption_key,
        });
        switch (partition) {
            case 'data':
                this.dataviewer.addOutput(c);
                break;
            case 'meta':
                this.metaviewer.addOutput(c);
            default:
                return common_1.error('unknown protocol');
        }
        common_1.emit({
            ch: 'network',
            msg: `added trusted peer ${partition}/${key} to ${this.connection_id || 'n/a'}`,
        });
    }
    async removeTrustedPeer(opts) {
        const { key, destroy, partition } = opts;
        if (key === (await this.index_key))
            return null;
        const k = b4a_1.default.from(key, 'hex');
        if (destroy) {
            const c = this.datamanager.get({ key: k, publicKey: k, encryptionKey: this.encryption_key });
            switch (partition) {
                case 'data':
                    this.dataviewer.removeOutput(c);
                    break;
                case 'meta':
                    this.metaviewer.removeOutput(c);
                    break;
                default:
                    return common_1.error('unknown protocol');
            }
        }
        else {
            switch (partition) {
                case 'data':
                    const dataviewer_i = this.dataviewer.outputs.findIndex((core) => b4a_1.default.equals(core.key, k));
                    if (dataviewer_i >= 0) {
                        const snapshot = this.dataviewer.outputs[dataviewer_i].snapshot();
                        await snapshot.ready();
                        this.dataviewer._outputsByKey.set(key, snapshot);
                    }
                    else {
                        return common_1.emit({ ch: 'error', msg: `couldn't snapshot core ${key}` });
                    }
                    break;
                case 'meta':
                    const metaviewer_i = this.metaviewer.outputs.findIndex((core) => b4a_1.default.equals(core.key, k));
                    if (metaviewer_i >= 0) {
                        const snapshot = this.metaviewer.outputs[metaviewer_i].snapshot();
                        await snapshot.ready();
                        this.metaviewer._outputsByKey.set(key, snapshot);
                    }
                    else {
                        return common_1.emit({ ch: 'error', msg: `couldn't snapshot core ${partition}/${key}` });
                    }
                    break;
                default:
                    return common_1.error('unknown protocol');
            }
        }
        await this._changePeerStatus({ key, status: destroy ? 'destroyed' : 'frozen', partition });
        common_1.emit({
            ch: 'network',
            msg: `removed trusted peer ${partition}/${key} from ${this.connection_id || 'n/a'}`,
        });
    }
}
async function Core(params) {
    const { config } = params;
    const C = new CoreClass(config);
    await C.init();
    const API = {
        connect: async (opts) => C.connect(opts),
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
            getWriter: () => C.writer,
            getIndex: () => C.index,
            getManager: () => C.datamanager,
            getViewer: () => C.dataviewer,
            getViewerView: () => C.dataviewer.view,
        },
    };
    const protocolBridge = async function (viewer) {
        return async function (op) {
            const o = new models_1.Operation(op);
            const op_buf = common_1.encodeCoreData(op);
            await viewer.append(op_buf);
            await viewer.view.update();
        };
    };
    async function appInit(API, Protocol) {
        return API({
            get: async (key) => {
                const data = await C.datadb.get(key);
                if (!data)
                    return null;
                return common_1.decodeCoreData(data.value);
            },
            query: async function (params) {
                if (!params?.limit)
                    params.limit = 100;
                const stream = C.datadb.createReadStream(params);
                if (params?.stream)
                    return stream;
                return new Promise((resolve, reject) => {
                    const bundle = [];
                    stream.on('data', (data) => {
                        const val = common_1.decodeCoreData(data.value);
                        if (params.include_meta) {
                            bundle.push({ value: val, i: data.seq, key: data.key });
                        }
                        else
                            bundle.push(val);
                    });
                    stream.on('end', () => {
                        resolve(bundle);
                    });
                });
            },
        }, Protocol);
    }
    async function injectAppAPI(appAPI) {
        for (const method in appAPI) {
            if (method.charAt(0) !== '_') {
                API[method] = async function (...args) {
                    return appAPI[method](...args);
                };
            }
        }
    }
    C.metaprotocol = await protocolBridge(C.metaviewer);
    API['_getMeta'] = async (key) => {
        const data = await C.metadb.get(key);
        if (!data)
            return null;
        return common_1.decodeCoreData(data.value);
    };
    API['_allMeta'] = async () => {
        const data = await C.metadb.query({ lt: '~' });
        if (!data)
            return null;
        return common_1.decodeCoreData(data);
    };
    API['_setMeta'] = async (params) => {
        await C.metaprotocol({
            type: 'set',
            key: params.key,
            value: params.value,
        });
    };
    await C.addKnownPeers({ partition: 'meta' });
    return new Promise(async (resolve, reject) => {
        try {
            async function startCore(Protocol, appAPI, UI) {
                C.protocol = Protocol;
                const app = await appInit(appAPI, await protocolBridge(C.dataviewer));
                await injectAppAPI(app);
                await C.addKnownPeers({ partition: 'data' });
                if (!(await API.getNetwork()))
                    await C.connect(params?.config?.connect?.local_only
                        ? { local_only: params?.config?.connect?.local_only }
                        : {});
                common_1.log(`Container initialized successfully`);
                if (typeof window === 'object' && UI) {
                    API.UI = Function(UI + ';return app')();
                }
                resolve(API);
            }
            if (params.app?.Protocol && params.app?.API) {
                common_1.log(`App provided as argument, loading...`);
                await startCore(params.app.Protocol, params.app.API, params?.app?.ui);
            }
            else {
                if (params.config.private)
                    return reject('Private mode is on, but no code was found. Please start core with app when using private mode.');
                common_1.log(`Loading app...`);
                const code = await API['_getMeta']('code');
                if (code?.app) {
                    const app = Function(code.app + ';return app')();
                    if (!app.Protocol)
                        return reject('app loading failed');
                    await startCore(app.Protocol, app.API, code?.ui);
                }
                else {
                    common_1.log(`No code found, querying peers for code, standby...`);
                    await API.connect(params?.config?.connect?.local_only
                        ? { local_only: params?.config?.connect?.local_only }
                        : {});
                    let timeout = 60;
                    const interval = setInterval(async () => {
                        const n = await API.getNetwork();
                        if (n._peers.size > 0) {
                            common_1.log(`Got peers, loading code...`);
                            const code = await API['_getMeta']('code');
                            if (code?.app) {
                                clearInterval(interval);
                                if (code.signature === '!!!DEV!!!') {
                                    alert('APP STARTED IN DEV MODE\nWARNING: SECURITY DISABLED');
                                }
                                else {
                                }
                                const app = Function(code.app + ';return app')();
                                if (!app.Protocol)
                                    return reject('app loading failed');
                                await startCore(app.Protocol, app.API, code?.ui);
                            }
                            else {
                                common_1.log(`No code found, trying again...`);
                            }
                        }
                        timeout--;
                        if (timeout <= 0 && !params?.config?.disable_timeout) {
                            clearInterval(interval);
                            return reject('no peers found');
                        }
                    }, 5000);
                }
            }
        }
        catch (error) {
            return reject(error);
        }
    });
}
exports.default = Core;
//# sourceMappingURL=index.js.map