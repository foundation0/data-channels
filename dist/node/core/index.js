"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const data_manager_1 = __importDefault(require("@backbonedao/data-manager"));
const data_viewer_1 = __importDefault(require("@backbonedao/data-viewer"));
const data_db_1 = __importDefault(require("@backbonedao/data-db"));
const common_1 = require("../common");
const bbconfig_1 = __importDefault(require("../bbconfig"));
const b4a_1 = __importDefault(require("b4a"));
const crypto_1 = require("@backbonedao/crypto");
const models_1 = require("../models");
const storage_1 = __importDefault(require("./storage"));
const users_1 = require("../network/users");
const network_1 = require("../network");
const idb_keyval_1 = require("idb-keyval");
const msgpackr_1 = require("msgpackr");
const fs_1 = __importDefault(require("fs"));
const mkdirp_1 = __importDefault(require("mkdirp"));
let appsCache;
let bypassCache = false;
if (typeof window === 'object' && typeof window['navigation'] !== 'undefined') {
    const store = idb_keyval_1.createStore('apps-cache', 'backbone');
    appsCache = {
        get: async (key) => {
            const raw_data = await idb_keyval_1.get(key, store);
            return raw_data ? msgpackr_1.unpack(raw_data) : false;
        },
        set: async (key, value) => {
            return idb_keyval_1.set(key, msgpackr_1.pack(value), store);
        },
    };
    if (localStorage.getItem('DEV'))
        bypassCache = true;
}
else {
    appsCache = {
        get: async (key) => {
            await mkdirp_1.default(`${__dirname}/.cache/`);
            try {
                const raw_data = fs_1.default.readFileSync(`${__dirname}/.cache/${key}`);
                return raw_data ? msgpackr_1.unpack(raw_data) : false;
            }
            catch (e) {
                return false;
            }
        },
        set: async (key, value) => {
            await mkdirp_1.default(`${__dirname}/.cache/`);
            fs_1.default.writeFileSync(`${__dirname}/.cache/${key}`, msgpackr_1.pack(value));
            return true;
        },
    };
}
const CORES = {};
class CoreClass {
    constructor(config, protocol) {
        this.connected_users = 0;
        this.users_cache = { users: {}, trusted_users: {} };
        this.connect = network_1.connect;
        this.addKnownUsers = users_1.addKnownUsers;
        this.addUser = users_1.addUser;
        this.removeUser = users_1.removeUser;
        this.addTrustedUser = users_1.addTrustedUser;
        this.removeTrustedUser = users_1.removeTrustedUser;
        this.config = {
            network: {
                bootstrap: bbconfig_1.default.network.bootstrap_servers,
                simplePeer: {
                    config: {
                        iceServers: bbconfig_1.default.network.stunturn_servers(),
                    },
                    sdpSemantics: 'unified-plan',
                    bundlePolicy: 'max-bundle',
                    iceCandidatePoolsize: 1,
                },
            },
            ...config,
        };
        this.protocol = protocol || async function () { };
        const { storage, storage_id } = storage_1.default(config);
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
                const DataAPI = await self.getDataAPI(dat);
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
            autostart: false,
        });
        await this.dataviewer.ready();
        common_1.emit({ ch: 'core', msg: `Initialized Core ${this.address}` });
        const kp = crypto_1.keyPair(this.address_hash);
        const root = this.datamanager.get(b4a_1.default.from(kp.publicKey, 'hex'));
        await root.ready();
        function _addUser(params) {
            if (params.key !== self.writer_key && params.key !== self.meta_key) {
                self.addUser(params);
            }
        }
        function _addTrustedUser(params) {
            return;
            if (params.key !== self.index_key) {
                common_1.emit({
                    ch: 'network',
                    msg: `Trusted user: ${self.index_key.slice(0, 8)} got key ${params.key} from user`,
                });
                self.addTrustedUser(params);
            }
        }
        const addPeersExtension = root.registerExtension('key-exchange', {
            encoding: 'json',
            onmessage: async (msg) => {
                const data_users = msg?.data?.users || msg?.data?.peers;
                data_users.forEach((key) => {
                    _addUser({ key, partition: 'data' });
                });
                const meta_users = msg?.meta?.users || msg?.meta?.peers;
                meta_users.forEach((key) => {
                    _addUser({ key, partition: 'meta' });
                });
                const data_trusted_users = msg?.data?.trusted_users || msg?.data?.trusted_peers;
                data_trusted_users.forEach((key) => {
                    _addTrustedUser({ key, partition: 'data' });
                });
                const meta_trusted_users = msg?.meta?.trusted_users || msg?.meta?.trusted_peers;
                meta_trusted_users.forEach((key) => {
                    _addTrustedUser({ key, partition: 'meta' });
                });
            },
        });
        root.on('peer-add', (user) => {
            addPeersExtension.send({
                data: {
                    users: this.dataviewer.inputs.map((core) => common_1.buf2hex(core.key)),
                    trusted_users: this.dataviewer.outputs.map((core) => common_1.buf2hex(core.key)),
                },
                meta: {
                    users: this.metaviewer.inputs.map((core) => common_1.buf2hex(core.key)),
                    trusted_users: this.metaviewer.outputs.map((core) => common_1.buf2hex(core.key)),
                },
            }, user);
            common_1.emit({
                ch: 'network',
                msg: `New user detected, saying hello...`,
            });
        });
        await this._updateUserCache();
        common_1.emit({
            ch: 'init',
            msg: `discovery keys:\nwriter: ${common_1.buf2hex(this.writer.discoveryKey)}\nindex: ${common_1.buf2hex(this.index.discoveryKey)}\nroot: ${common_1.buf2hex(root.discoveryKey)} \nmeta: ${common_1.buf2hex(this.meta.discoveryKey)}`,
            verbose: true,
        });
        common_1.emit({
            ch: 'init',
            msg: `public keys:\nwriter: ${common_1.buf2hex(this.writer.key)}\nindex: ${common_1.buf2hex(this.index.key)}\nroot: ${common_1.buf2hex(root.key)} \nmeta: ${common_1.buf2hex(this.meta.key)}`,
            verbose: true,
        });
    }
    async getDataAPI(data) {
        const API = {
            put: async (params) => {
                if (typeof params === 'string' || !params?.key || !params?.value)
                    return common_1.error('INVALID PARAMS');
                if (typeof params?.key !== 'string')
                    return common_1.error('key must be a string or a number');
                let unsigned = false;
                Object.keys(params).forEach((k) => {
                    if (params[k]._meta) {
                        if (params[k]._meta?.unsigned)
                            unsigned = true;
                        params[k] = params[k].flatten();
                    }
                });
                if (unsigned) {
                    await data.del(params.key);
                    return common_1.error('unsigned data detected in protocol, discarding...');
                }
                const encoded_data = common_1.encodeCoreData(params.value);
                if (!encoded_data)
                    return common_1.error('put needs data');
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
                try {
                    const dat = await data.get(key, { update: false });
                    if (!dat)
                        return null;
                    return common_1.decodeCoreData(dat.value);
                }
                catch (error) {
                    return null;
                }
            },
            getAll: async () => {
                return API.query({ lt: '~' });
            },
            discard: async (op, reason) => {
                await data.put('_trash', '1');
                await data.del('_trash');
                return common_1.error(`protocol discarded an operation ${reason ? `(${reason})` : ''}: ${JSON.stringify(op).slice(0, 200)}`);
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
        return API;
    }
    async startDataViewer() {
        const self = this;
        self.dataviewer.start({
            view: (core) => new data_db_1.default(core.unwrap(), {
                keyEncoding: 'utf-8',
                valueEncoding: 'binary',
                extension: false,
            }),
            unwrap: true,
            eagerUpdate: true,
            async apply(datadb, operations) {
                const db = datadb.batch({ update: false });
                const failsafe = setTimeout(async function () {
                    await db.flush();
                }, 15000);
                const DataAPI = await self.getDataAPI(db);
                for (const { value } of operations) {
                    const o = common_1.decodeCoreData(value);
                    const op = new models_1.Operation(o);
                    await self.protocol(op, DataAPI);
                }
                await db.flush();
                clearTimeout(failsafe);
            },
        });
        self.datadb = self.dataviewer.view;
    }
    async _updatePartitions() {
        await this.dataviewer.view.update();
        await this.metaviewer.view.update();
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
    async _updateUserCache() {
        const users_val = await this.metadb.get('users');
        const trusted_users_val = await this.metadb.get('trusted_users');
        if (users_val?.value) {
            this.users_cache.users = common_1.decodeCoreData(users_val.value);
        }
        else
            this.users_cache.users = {};
        if (trusted_users_val?.value) {
            this.users_cache.trusted_users = common_1.decodeCoreData(trusted_users_val.value);
        }
        else
            this.users_cache.trusted_users = {};
    }
    async _changeUserStatus(opts) {
        const { key, status, type = 'user', partition } = opts;
        const users = this.users_cache[type + 's'];
        if (users[key]) {
            users[key].status = status;
        }
        else {
            users[key] = {
                status,
                type,
                partition,
            };
        }
        this.users_cache[type + 's'] = users;
        await this.metaprotocol({
            type: 'set',
            key: type + 's',
            value: users,
        });
    }
}
async function checkExistingInstance(config) {
    if (typeof window === 'object' && localStorage.getItem(config.address)) {
        if (confirm(`Detected potentially another instance of this app running.\n\nPlease close the instance and click ok.\n\nIf this is wrong, click cancel. Beware, running two instances in same browser can result to corrupt data.`))
            await checkExistingInstance(config);
        else
            localStorage.removeItem(config.address);
    }
}
function enableGracefulExit(C, config) {
    if (typeof window === 'object') {
        window.addEventListener('beforeunload', async () => {
            common_1.emit({
                ch: 'network',
                msg: 'beforeunload event received, cleaning up...',
            });
            localStorage.removeItem(config.address);
            await C.network.destroy();
        }, { capture: true });
    }
    else if (typeof global === 'object') {
        process.once('SIGINT', async () => {
            common_1.emit({ ch: 'network', msg: 'SIGINT event received, cleaning up...' });
            await C.network.destroy();
        });
    }
}
async function Core(params) {
    const { config } = params;
    await checkExistingInstance(config);
    const C = new CoreClass(config);
    enableGracefulExit(C, config);
    await C.init();
    if (typeof window === 'object')
        localStorage.setItem(config.address, new Date().getTime().toString());
    const API = {
        users: {
            addUser: async (opts) => C.addUser(opts),
            removeUser: async (opts) => C.removeUser(opts),
            addTrustedUser: async (opts) => C.addTrustedUser(opts),
            removeTrustedUser: async (opts) => C.removeTrustedUser(opts),
        },
        meta: {
            getAppVersion: async () => {
                const manifest = await API.meta['_getMeta']('manifest');
                if (!manifest)
                    return common_1.error('no manifest found');
                return manifest?.version;
            },
            getKeys: async () => C.getKeys(),
        },
        network: {
            getConnectionId: () => C.connection_id,
            getNetwork: () => C.network,
            connect: async (opts) => C.connect(opts),
            disconnect: async () => C.disconnect(),
        },
        _: {
            on: async (id, cb) => () => common_1.subscribeToEvent({ id, cb }),
            listenLog: async (ch, cb) => () => common_1.subscribeToChannel({ ch, cb }),
        },
    };
    const protocolBridge = async function (viewer) {
        return async function (op) {
            let unsigned = false;
            Object.keys(op).forEach((k) => {
                if (op[k]?._meta) {
                    if (op[k]?._meta?.unsigned)
                        unsigned = true;
                    op[k] = op[k].flatten();
                }
            });
            if (unsigned) {
                return common_1.error('unsigned data detected in API');
            }
            const o = new models_1.Operation(op);
            const op_buf = common_1.encodeCoreData(op);
            await viewer.append(op_buf);
            await viewer.view.update();
        };
    };
    async function appInit(API, Protocol) {
        const bAPI = {
            onAdd: async (cb) => {
                let last_length = 0;
                const timer = setInterval(function () {
                    if (last_length < C.dataviewer.localOutput.length) {
                        cb(C.dataviewer.localOutput.length);
                        last_length = C.dataviewer.localOutput.length;
                    }
                }, 10);
                return function stopListening() {
                    clearInterval(timer);
                };
            },
            get: async (key) => {
                try {
                    const data = await C.datadb.get(key);
                    if (!data)
                        return null;
                    return common_1.decodeCoreData(data.value);
                }
                catch (error) {
                    return null;
                }
            },
            getAll: async (params) => {
                const raw_items = await bAPI.query({ lt: '~', include_meta: true });
                let items;
                if (typeof params?.model === 'function') {
                    items = await Promise.all(raw_items
                        .map((item) => {
                        if (!item.key.match(/^_/)) {
                            try {
                                return params.model(item.value);
                            }
                            catch (error) {
                                console.log('invalid data', item, error);
                            }
                        }
                    })
                        .filter((i) => i));
                }
                else
                    items = raw_items;
                return items;
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
        };
        return API(bAPI, Protocol);
    }
    async function injectAppAPI(appAPI) {
        const reserved_words = ['users', 'meta', 'network', '_'];
        for (const method in appAPI) {
            if (method.charAt(0) !== '_' && reserved_words.indexOf(method) === -1) {
                API[method] = async function (...args) {
                    return appAPI[method](...args);
                };
            }
        }
    }
    C.metaprotocol = await protocolBridge(C.metaviewer);
    API.meta['_getMeta'] = async (key) => {
        const data = await C.metadb.get(key);
        if (!data)
            return null;
        return common_1.decodeCoreData(data.value);
    };
    API.meta['_allMeta'] = async () => {
        const data = await C.metadb.query({ lt: '~' });
        if (!data)
            return null;
        return common_1.decodeCoreData(data);
    };
    API.meta['_setMeta'] = async (params) => {
        await C.metaprotocol({
            type: 'set',
            key: params.key,
            value: params.value,
        });
    };
    await C.addKnownUsers({ partition: 'meta' });
    let logUI;
    if (typeof window === 'object' && typeof window['appendMsgToUI'] === 'function') {
        logUI = window['appendMsgToUI'];
    }
    async function startAppInBrowser(code) {
        return new Promise((resolve, reject) => {
            if (typeof window !== 'object' && !document.body)
                return common_1.error('is this a browser?');
            const app_container = document.createElement('script');
            app_container.setAttribute('id', 'app-container');
            document.body.appendChild(app_container);
            app_container.onload = function () {
                resolve(window['app']?.default || window['app']);
            };
            app_container.setAttribute('src', `data:text/javascript;base64,${common_1.base64.encode(code)}`);
        });
    }
    async function startUIInBrowser(code) {
        return new Promise((resolve, reject) => {
            if (typeof window !== 'object' && !document.body)
                return common_1.error('is this a browser?');
            const ui_container = document.createElement('script');
            ui_container.setAttribute('id', 'ui-container');
            document.body.appendChild(ui_container);
            ui_container.onload = function () {
                resolve(window['ui']?.default || window['ui']);
            };
            ui_container.setAttribute('src', `data:text/javascript;base64,${common_1.base64.encode(code)}`);
        });
    }
    return new Promise(async (resolve, reject) => {
        try {
            async function startCore(Protocol, appAPI, UI) {
                C.protocol = Protocol;
                const app = await appInit(appAPI, await protocolBridge(C.dataviewer));
                await injectAppAPI(app);
                await C.addKnownUsers({ partition: 'data' });
                await C.startDataViewer();
                if (typeof window === 'object' && UI) {
                    if (logUI)
                        logUI('Rendering user interface...');
                    API.UI = await startUIInBrowser(UI);
                }
                common_1.emit({ ch: 'core', msg: `Container initialized successfully` });
                if (logUI)
                    logUI('Container initialized');
                const net = await API.network.getNetwork();
                if (!net)
                    setTimeout(function () {
                        C.connect(params?.config?.connect?.local_only
                            ? { local_only: params?.config?.connect?.local_only }
                            : {});
                    }, 1000);
                resolve(API);
            }
            if (params.app?.Protocol && params.app?.API) {
                common_1.emit({ ch: 'core', msg: `App provided as argument, loading...` });
                await startCore(params.app.Protocol, params.app.API, params?.app?.ui);
            }
            else {
                if (params.config.private)
                    return reject('Private mode is on, but no code was found. Please start core with app when using private mode.');
                common_1.emit({ ch: 'core', msg: `Loading app...` });
                if (logUI)
                    logUI('Loading app...');
                let cached_code;
                let cached_manifest;
                if (appsCache && !bypassCache) {
                    cached_code = await appsCache.get(`${config.address}/code`);
                    cached_manifest = await appsCache.get(`${config.address}/manifest`);
                }
                if (cached_code?.app) {
                    common_1.emit({ ch: 'core', msg: `App found from cache` });
                    if (logUI)
                        logUI('App found from cache');
                    const app = await startAppInBrowser(cached_code.app);
                    if (!app.Protocol) {
                        let err = 'Error in executing the app code';
                        if (logUI)
                            logUI(err);
                        if (typeof window['reset'])
                            window['reset']();
                        return reject(err);
                    }
                    await startCore(app.Protocol, app.API, cached_code?.ui);
                }
                else {
                    let msg = `No code found, querying users for code, standby...`;
                    common_1.emit({ ch: 'core', msg });
                    if (logUI)
                        logUI(msg);
                    await API.network.connect(params?.config?.connect?.local_only
                        ? { local_only: params?.config?.connect?.local_only }
                        : {});
                    let timeout = 60;
                    let loading_code = false;
                    const interval = setInterval(async () => {
                        const n = await API.network.getNetwork();
                        if (n._peers.size > 0) {
                            if (!loading_code) {
                                loading_code = true;
                                let msg = `Found other users, searching for app code...`;
                                common_1.emit({ ch: 'network', msg });
                                if (logUI)
                                    logUI(msg);
                                const code = await API.meta['_getMeta']('code');
                                if (code?.app) {
                                    clearInterval(interval);
                                    if (code.signature === '!!!DEV!!!') {
                                        common_1.log('APP STARTED IN DEV MODE\nWARNING: SECURITY DISABLED');
                                    }
                                    else {
                                    }
                                    const manifest = await API.meta['_getMeta']('manifest');
                                    if (!manifest) {
                                        let err = 'No manifest found, invalid container';
                                        if (logUI)
                                            logUI(err);
                                        if (typeof window === 'object' && typeof window['reset'] === 'function')
                                            window['reset']();
                                        return common_1.error(err);
                                    }
                                    if (appsCache) {
                                        await appsCache.set(`${config.address}/code`, code);
                                        await appsCache.set(`${config.address}/manifest`, manifest);
                                    }
                                    if (typeof window === 'object') {
                                        common_1.emit({ ch: 'core', msg: `Executing in browser environment...` });
                                        const loaded_app = await startAppInBrowser(code.app);
                                        let timeout_timer;
                                        const app_loader_timer = setInterval(async function () {
                                            if (loaded_app?.Protocol && loaded_app?.API) {
                                                clearInterval(app_loader_timer);
                                                clearTimeout(timeout_timer);
                                                await startCore(loaded_app.Protocol, loaded_app.API, code?.ui);
                                            }
                                        }, 5);
                                        timeout_timer = setTimeout(function () {
                                            clearInterval(app_loader_timer);
                                            let err = 'Unknown error in executing the app';
                                            if (logUI)
                                                logUI(err);
                                            if (typeof window['reset'])
                                                window['reset']();
                                            return common_1.error(err);
                                        }, 10000);
                                    }
                                    else {
                                        common_1.emit({ ch: 'core', msg: `Executing in NodeJS environment...` });
                                        const app = Function(code.app + ';return app.default || app')();
                                        if (!app.Protocol)
                                            return reject('app loading failed');
                                        await startCore(app.Protocol, app.API, code?.ui);
                                    }
                                }
                                else {
                                    loading_code = false;
                                    let msg = `No code found yet, searching more...`;
                                    common_1.emit({ ch: 'core', msg });
                                    if (logUI)
                                        logUI(msg);
                                }
                            }
                        }
                        timeout--;
                        if (timeout <= 0 && !params?.config?.disable_timeout) {
                            clearInterval(interval);
                            let err = 'No other users found with code, are you sure the address is right?';
                            if (logUI)
                                logUI(err);
                            if (typeof window['reset'])
                                window['reset']();
                            return reject(err);
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