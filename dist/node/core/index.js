"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getStorage = void 0;
const data_manager_1 = __importDefault(require("@backbonedao/data-manager"));
const data_viewer_1 = __importDefault(require("@backbonedao/data-viewer"));
const data_db_1 = __importDefault(require("@backbonedao/data-db"));
const network_node_1 = __importDefault(require("@backbonedao/network-node"));
const platform_detect_1 = __importDefault(require("platform-detect"));
const random_access_memory_1 = __importDefault(require("random-access-memory"));
const random_access_idb_1 = __importDefault(require("random-access-idb"));
const common_1 = require("../common");
const crypto_1 = require("../common/crypto");
const os_1 = require("os");
const bbconfig_1 = __importDefault(require("../bbconfig"));
const b4a_1 = __importDefault(require("b4a"));
const crypto_2 = require("@backbonedao/crypto");
function getStorage(bb_config) {
    if (!bb_config)
        throw new Error('GETSTORAGE REQUIRES CORECONFIG');
    let storage;
    if (bb_config?.storage === 'ram') {
        common_1.log('RAM storage requested, using memory for storage');
        storage = random_access_memory_1.default;
    }
    else if (bb_config?.env === 'node' || platform_detect_1.default?.node) {
        common_1.log('Node runtime detected, using file system for storage');
        const prefix = bb_config?.storage_prefix ? `${bb_config?.storage_prefix}/` : '';
        const pathname = bb_config.address.match(/.{1,2}/g)?.join('/');
        storage = process.env.TEST
            ? `${os_1.homedir()}/.backbone-test/${prefix}${pathname}`
            : `${common_1.getHomedir()}/${prefix}${pathname}`;
    }
    else {
        common_1.log('Browser runtime detected, using RAI for storage');
        storage = random_access_idb_1.default();
    }
    const storage_id = bb_config?.storage_prefix
        ? bb_config.address + bb_config.storage_prefix
        : bb_config.address;
    return { storage, storage_id };
}
exports.getStorage = getStorage;
const CORES = {};
class CoreClass {
    constructor(config, protocol) {
        this.config = {
            network: {
                bootstrap: bbconfig_1.default.network.bootstrap_servers,
            },
            ...config,
        };
        const { storage, storage_id } = getStorage(config);
        this.store = CORES[storage_id] || new data_manager_1.default(storage);
        if (!CORES[storage_id])
            CORES[storage_id] = this.store;
        this.protocol = protocol;
    }
    async init() {
        const self = this;
        let encryptionKey;
        if (this.config?.encryption_key !== false && typeof this.config.encryption_key === 'string') {
            encryptionKey = b4a_1.default.from(this.config.encryption_key, 'hex');
            this.encryption_key = encryptionKey;
        }
        else
            encryptionKey = null;
        const writer = this.store.get({ name: 'writer', encryptionKey });
        const index = this.store.get({ name: 'index', encryptionKey });
        await writer.ready();
        await index.ready();
        this.writer_key = common_1.buf2hex(writer.key);
        this.index_key = common_1.buf2hex(index.key);
        this.address = this.config.address;
        this.rebase = new data_viewer_1.default({
            localInput: writer,
            inputs: [writer],
            outputs: [],
            localOutput: index,
            autostart: true,
            unwrap: true,
            async apply(batch) {
                const index = self.kv.batch({ update: false });
                for (const { value } of batch) {
                    const op = common_1.decodeCoreData(value);
                    try {
                        await self.protocol(op, {
                            put: async (params) => {
                                if (typeof params === 'string' || !params?.key || !params?.value)
                                    throw new Error('INVALID PARAMS');
                                const encoded_data = common_1.encodeCoreData(params.value);
                                await index.put(params.key, encoded_data);
                                const value = await index.get(params.key);
                                if (value?.value.toString() === encoded_data.toString())
                                    return;
                                console.log('FAIL', params.key, value, encoded_data);
                                throw new Error('PUT FAILED');
                            },
                            del: async (key) => {
                                return index.del(key);
                            },
                            get: async (key) => {
                                const data = await index.get(key);
                                if (!data)
                                    return null;
                                return common_1.decodeCoreData(data.value);
                            },
                            query: async function (params) {
                                if (!params?.limit)
                                    params.limit = 100;
                                const stream = index.createReadStream(params);
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
                                const data = await self.kv.get(key);
                                if (!data)
                                    return null;
                                return common_1.decodeCoreData(data.value);
                            },
                            query: async function (params) {
                                if (!params?.limit)
                                    params.limit = 100;
                                const stream = self.kv.createReadStream(params);
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
                await index.flush();
            },
        });
        for (const key of this.config.writers || []) {
            if (key !== this.writer_key) {
                await this.addWriter({ key });
            }
        }
        for (const key of this.config.indexes || []) {
            if (key !== this.index_key) {
                await this.addIndex({ key });
            }
        }
        await this.rebase.ready();
        this.rebased_index = this.rebase.view;
        this.kv = new data_db_1.default(this.rebased_index, {
            extension: false,
            keyEncoding: 'utf-8',
            valueEncoding: 'binary',
        });
        common_1.log(`initialized Core ${this.writer_key} / ${this.index_key}`);
        const shatopic = crypto_2.createHash(`backbone://${this.address}`);
        const kp = crypto_2.keyPair(shatopic);
        const root = this.store.get(b4a_1.default.from(kp.publicKey, 'hex'));
        await root.ready();
        const addWritersExt = root.registerExtension('polycore', {
            encoding: 'json',
            onmessage: async (msg) => {
                msg.writers.forEach((key) => {
                    common_1.emit({
                        ch: 'network',
                        msg: `${this.writer_key.slice(0, 8)} got key ${key} from peer`,
                    });
                    this.addWriter({ key });
                });
            },
        });
        root.on('peer-add', (peer) => {
            addWritersExt.send({
                writers: this.rebase.inputs.map((core) => common_1.buf2hex(core.key)),
            }, peer);
            common_1.emit({
                ch: 'network',
                msg: `${this.writer_key.slice(0, 8)} Added peer`,
            });
        });
        this.writer = writer;
        this.index = index;
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
        if (this.config.networkId) {
            network_config.keyPair = this.config.networkId;
        }
        let self = this;
        async function connectToSwarm() {
            const swarm = network_node_1.default(network_config);
            const shatopic = crypto_1.sha256(`backbone://${self.address}`);
            const topic = b4a_1.default.from(shatopic, 'hex');
            swarm.on('connection', async (socket, peer) => {
                console.log('Connection', peer);
                const r = socket.pipe(self.store.replicate(peer.client)).pipe(socket);
                r.on('error', (err) => {
                    if (err.message !== 'UTP_ETIMEOUT' || err.message !== 'Duplicate connection')
                        common_1.error(err.message);
                });
            });
            common_1.emit({
                ch: 'network',
                msg: `Connecting to ${shatopic} (backbone://${self.address}) with connection id ...`,
            });
            swarm.join(Buffer.isBuffer(topic) ? topic : Buffer.from(topic, 'hex'));
            await swarm.flush(() => { });
            return swarm;
        }
        this.swarm = await connectToSwarm();
        this.rebased_index.update();
        process.once('SIGINT', () => {
            this.swarm.destroy();
        });
        this.connection_id = common_1.buf2hex(this.swarm.webrtc.id);
        return this.swarm;
    }
    async disconnect() {
        clearInterval(this.swarm_refresh_timer);
    }
    async getKeys() {
        return {
            writers: [...this.rebase.inputs.map((i) => common_1.buf2hex(i.key))],
            indexes: [
                ...this.rebase.outputs.map((i) => common_1.buf2hex(i.key)),
                common_1.buf2hex(this.rebase.localOutput.key),
            ],
        };
    }
    async addWriter(opts) {
        const { key } = opts;
        if (key === (await this.writer_key)) {
            common_1.emit({ ch: 'network', msg: `duplicated writer key ${key}` });
            return null;
        }
        const k = b4a_1.default.from(key, 'hex');
        this.rebase.addInput(this.store.get({
            key: k,
            publicKey: k,
            encryptionKey: this.encryption_key,
        }));
        common_1.emit({ ch: 'network', msg: `added writer ${key} to ${this.connection_id || 'n/a'}` });
    }
    async removeWriter(opts) {
        const { key } = opts;
        if (key === (await this.index_key))
            return null;
        const k = b4a_1.default.from(key, 'hex');
        this.rebase.removeInput(this.store.get({ key: k, publicKey: k, encryptionKey: this.encryption_key }));
        common_1.emit({ ch: 'network', msg: `removed writer ${key} from ${this.connection_id || 'n/a'}` });
    }
    async addIndex(opts) {
        const { key } = opts;
        if (key === (await this.index_key))
            return null;
        const k = b4a_1.default.from(key, 'hex');
        this.rebase.addOutput(this.store.get({
            key: k,
            publicKey: k,
            encryptionKey: this.encryption_key,
        }));
        common_1.emit({ ch: 'network', msg: `added index ${key} to ${this.connection_id || 'n/a'}` });
    }
    async removeIndex(key) {
        if (key === (await this.index_key))
            return null;
        const k = b4a_1.default.from(key, 'hex');
        this.rebase.removeOutput(this.store.get({ key: k, publicKey: k, encryptionKey: this.encryption_key }));
        common_1.emit({ ch: 'network', msg: `removed index ${key} from ${this.connection_id || 'n/a'}` });
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
        addWriter: async (key) => C.addWriter(key),
        removeWriter: async (key) => C.removeWriter(key),
        addIndex: async (key) => C.addIndex(key),
        removeIndex: async (key) => C.removeIndex(key),
        getWriterKey: () => C.writer_key,
        getIndexKey: () => C.index_key,
        getConnectionId: () => C.connection_id,
    };
    const protocolAPI = await params.app.API({
        get: async (key) => {
            const data = await C.kv.get(key);
            if (!data)
                return null;
            return common_1.decodeCoreData(data.value);
        },
        query: async function (params) {
            if (!params?.limit)
                params.limit = 100;
            const stream = C.kv.createReadStream(params);
            if (params?.stream)
                return stream;
            return new Promise((resolve, reject) => {
                const bundle = [];
                stream.on('data', (data) => {
                    const val = common_1.decodeCoreData(data.value);
                    if (params.i) {
                        bundle.push({ value: val, i: data.seq });
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
        const op_buf = common_1.encodeCoreData(op);
        await C.rebase.append(op_buf);
        await C.rebased_index.update();
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