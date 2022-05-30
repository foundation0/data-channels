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
        this.protocol = protocol;
        const { storage, storage_id } = get_storage_1.default(config);
        this.datamanager = CORES[storage_id] || new data_manager_1.default(storage);
        if (!CORES[storage_id])
            CORES[storage_id] = this.datamanager;
    }
    async init() {
        const self = this;
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
        if (this.config.key) {
            writer_conf['keyPair'] = crypto_1.keyPair(crypto_1.createHash(this.config.key + 'writer'));
            index_conf['keyPair'] = crypto_1.keyPair(crypto_1.createHash(this.config.key + 'index'));
            meta_conf['keyPair'] = crypto_1.keyPair(crypto_1.createHash(this.config.key + 'meta'));
        }
        else {
            writer_conf['name'] = 'writer';
            index_conf['name'] = 'index';
            meta_conf['name'] = 'meta';
        }
        this.writer = this.datamanager.get(writer_conf);
        this.index = this.datamanager.get(index_conf);
        this.meta = this.datamanager.get(meta_conf);
        await this.writer.ready();
        await this.index.ready();
        await this.meta.ready();
        this.writer_key = common_1.buf2hex(this.writer.key);
        this.index_key = common_1.buf2hex(this.index.key);
        this.address = this.config.address;
        if (!this.address.match('backbone://'))
            this.address_hash = crypto_1.createHash(`backbone://${this.config.address}`);
        else
            this.address_hash = crypto_1.createHash(this.config.address);
        this.dataviewer = new data_viewer_1.default({
            localInput: this.writer,
            inputs: [this.writer],
            outputs: [],
            localOutput: this.index,
            autostart: true,
            unwrap: true,
            async apply(operations) {
                const data = self.datadb.batch({ update: false });
                for (const { value } of operations) {
                    const o = common_1.decodeCoreData(value);
                    const op = new models_1.Operation(o);
                    try {
                        await self.protocol(op, {
                            put: async (params) => {
                                if (typeof params === 'string' || !params?.key || !params?.value)
                                    throw new Error('INVALID PARAMS');
                                const encoded_data = common_1.encodeCoreData(params.value);
                                await data.put(params.key, encoded_data);
                                const value = await data.get(params.key);
                                if (value?.value.toString() === encoded_data.toString())
                                    return;
                                console.log('FAIL', params.key, value, encoded_data);
                                throw new Error('PUT FAILED');
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
                        }, {
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
                    catch (error) {
                        throw error;
                    }
                }
                await data.flush();
            },
        });
        this.metadb = new data_db_1.default(this.meta, {
            extension: false,
            keyEncoding: 'utf-8',
            valueEncoding: 'json',
        });
        const peers = (await this.metadb.get('peers')) || [];
        if (peers?.value) {
            for (const key of peers?.value) {
                if (key !== this.writer_key) {
                    await this.addPeer({ key, pass_check: true });
                }
            }
        }
        for (const key of this.config.trusted_peers || []) {
            if (key !== this.index_key) {
                await this.addTrustedPeer({ key });
            }
        }
        await this.dataviewer.ready();
        this.datadb = new data_db_1.default(this.dataviewer.view, {
            extension: false,
            keyEncoding: 'utf-8',
            valueEncoding: 'binary',
        });
        common_1.log(`initialized Core ${this.writer_key} / ${this.index_key}`);
        const kp = crypto_1.keyPair(this.address_hash);
        const root = this.datamanager.get(b4a_1.default.from(kp.publicKey, 'hex'));
        await root.ready();
        const addPeersExt = root.registerExtension('key-exchange', {
            encoding: 'json',
            onmessage: async (msg) => {
                msg.peers.forEach((key) => {
                    if (key !== this.writer_key) {
                        common_1.emit({
                            ch: 'network',
                            msg: `Peer: ${this.writer_key.slice(0, 8)} got key ${key} from peer`,
                        });
                        this.addPeer({ key });
                    }
                });
                msg.trusted_peers.forEach((key) => {
                    return;
                    if (key !== this.index_key) {
                        common_1.emit({
                            ch: 'network',
                            msg: `Trusted peer: ${this.index_key.slice(0, 8)} got key ${key} from peer`,
                        });
                        this.addTrustedPeer({ key });
                    }
                });
            },
        });
        root.on('peer-add', (peer) => {
            addPeersExt.send({
                peers: this.dataviewer.inputs.map((core) => common_1.buf2hex(core.key)),
                trusted_peers: this.dataviewer.outputs.map((core) => common_1.buf2hex(core.key)),
            }, peer);
            common_1.emit({
                ch: 'network',
                msg: `${this.writer_key.slice(0, 8)} Added peer`,
            });
        });
        common_1.emit({
            ch: 'network',
            msg: `discovery keys:\nwriter: ${common_1.buf2hex(this.writer.discoveryKey)}\nindex: ${common_1.buf2hex(this.index.discoveryKey)}\nroot: ${common_1.buf2hex(root.discoveryKey)}`,
        });
        common_1.emit({
            ch: 'network',
            msg: `public keys:\nwriter: ${common_1.buf2hex(this.writer.key)}\nindex: ${common_1.buf2hex(this.index.key)}\nroot: ${common_1.buf2hex(root.key)}`,
        });
    }
    async connect(use_unique_swarm) {
        if (!this.config?.network)
            throw new Error('CONNECT NEEDS NETWORK CONFIG');
        if (this.config.private)
            throw new Error('ACCESS DENIED - PRIVATE CORE');
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
        common_1.emit({
            ch: 'network',
            msg: `network id:\nhex: ${common_1.buf2hex(this.config.network_id?.publicKey)}\nbuf: ${this.config.network_id?.publicKey}`,
        });
        let self = this;
        async function connectToNetwork() {
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
            });
            common_1.emit({
                ch: 'network',
                msg: `Connecting to ${common_1.buf2hex(self.address_hash)} (backbone://${self.address}) with connection id ...`,
            });
            network.join(Buffer.isBuffer(self.address_hash)
                ? self.address_hash
                : Buffer.from(self.address_hash, 'hex'));
            await network.flush(() => { });
            return network;
        }
        this.network = await connectToNetwork();
        this.dataviewer.view.update();
        process.once('SIGINT', () => {
            this.network.destroy();
        });
        this.connection_id = common_1.buf2hex(this.network.webrtc.id);
        return this.network;
    }
    async disconnect() {
        clearInterval(this.network_refresh_timer);
    }
    async getKeys() {
        return {
            writers: [...this.dataviewer.inputs.map((i) => common_1.buf2hex(i.key))],
            indexes: [
                ...this.dataviewer.outputs.map((i) => common_1.buf2hex(i.key)),
                common_1.buf2hex(this.dataviewer.localOutput.key),
            ],
        };
    }
    async addPeer(opts) {
        const { key } = opts;
        const peers = await this.metadb.get('peers');
        if (!peers?.value || peers?.value.indexOf(key) === -1 || opts.pass_check) {
            const w = peers?.value || [];
            if (w.indexOf(key) === -1) {
                w.push(key);
                await this.metadb.put('peers', w);
            }
            const k = b4a_1.default.from(key, 'hex');
            const v = await this.datamanager.get({
                key: k,
                publicKey: k,
                encryptionKey: this.encryption_key,
            });
            this.dataviewer.addInput(v);
            common_1.emit({ ch: 'network', msg: `added peer ${key} to ${this.connection_id || 'n/a'}` });
        }
    }
    async removePeer(opts) {
        const { key } = opts;
        const k = b4a_1.default.from(key, 'hex');
        this.dataviewer.removeInput(this.datamanager.get({ key: k, publicKey: k, encryptionKey: this.encryption_key }));
        common_1.emit({ ch: 'network', msg: `removed peer ${key} from ${this.connection_id || 'n/a'}` });
    }
    async addTrustedPeer(opts) {
        const { key } = opts;
        if (key === (await this.index_key))
            return null;
        const trusted_peers = await this.metadb.get('trusted_peers');
        if (!trusted_peers?.value || trusted_peers?.value.indexOf(key) === -1 || opts.pass_check) {
            const w = trusted_peers?.value || [];
            if (w.indexOf(key) === -1) {
                w.push(key);
                await this.metadb.put('trusted_peers', w);
            }
            const k = b4a_1.default.from(key, 'hex');
            this.dataviewer.addOutput(this.datamanager.get({
                key: k,
                publicKey: k,
                encryptionKey: this.encryption_key,
            }));
            common_1.emit({ ch: 'network', msg: `added trusted peer ${key} to ${this.connection_id || 'n/a'}` });
        }
    }
    async removeTrustedPeer(opts) {
        const { key } = opts;
        if (key === (await this.index_key))
            return null;
        const k = b4a_1.default.from(key, 'hex');
        this.dataviewer.removeOutput(this.datamanager.get({ key: k, publicKey: k, encryptionKey: this.encryption_key }));
        common_1.emit({ ch: 'network', msg: `removed trusted peer ${key} from ${this.connection_id || 'n/a'}` });
    }
}
async function Core(params) {
    const { config } = params;
    const C = new CoreClass(config, params.app.Protocol);
    await C.init();
    const API = {
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
    };
    const protocolAPI = await params.app.API({
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
    }, async function (op) {
        const o = new models_1.Operation(op);
        const op_buf = common_1.encodeCoreData(op);
        await C.dataviewer.append(op_buf);
        await C.dataviewer.view.update();
    });
    for (const method in protocolAPI) {
        if (method.charAt(0) !== '_') {
            API[method] = async function (...args) {
                return protocolAPI[method](...args);
            };
        }
    }
    return API;
}
exports.default = Core;
//# sourceMappingURL=index.js.map