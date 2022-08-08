"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Set = exports.Map = exports.Array = exports.Object = exports.Model = void 0;
const common_1 = require("../common");
const { Model, BasicModel, ObjectModel, ArrayModel, FunctionModel, MapModel, SetModel, Any, } = require('./objectmodel');
exports.Model = Model;
exports.Object = ObjectModel;
exports.Array = ArrayModel;
exports.Map = MapModel;
exports.Set = SetModel;
const semverSort = require('semver/functions/sort');
const semverGtr = require('semver/ranges/gtr');
const { ethers } = require('ethers');
const binary_1 = __importDefault(require("./binary"));
const crypto_1 = require("@backbonedao/crypto");
const b4a_1 = __importDefault(require("b4a"));
const msgpackr_1 = require("msgpackr");
const Meta = Model({
    version: String,
    hash: [binary_1.default],
    signature: [binary_1.default],
    id: [binary_1.default],
    unsigned: [Boolean],
})
    .assert((data) => {
    if (data?.signature)
        return data.signature.byteLength === 65;
    else
        return true;
}, 'signature should have lenght of 65')
    .assert((data) => {
    if (data?.id)
        return ethers.utils.isAddress(crypto_1.buf2hex(data.id));
    else
        return true;
}, 'Id should be valid 0x address');
async function default_1(data, opts, migrations) {
    if (process.env['TEST'] && opts?.disable_owneronly !== false)
        opts = { ...opts, disable_owneronly: true };
    let ready = false;
    let current_id = null;
    const app_meta = {
        version: opts?._debug?.app_version || '0',
        backbone: (typeof window === 'object' && window.backbone) ||
            (typeof global === 'object' && global.backbone),
    };
    if (app_meta.backbone?.app?.version)
        app_meta.version = app_meta.backbone.app.version;
    function getMetaDetails(meta) {
        const public_key = crypto_1.getPublicKeyFromSig({ message: meta.hash, signature: meta.signature });
        return { ...meta, public_key };
    }
    class datamodel extends Model(data).assert((data) => {
        if (!ready)
            return true;
        if (opts?.disable_owneronly)
            return true;
        if (data['_meta']['unsigned'])
            return true;
        const { signature, public_key } = getMetaDetails(data._meta);
        const { _meta, ...signable_data } = data;
        const hash = crypto_1.createHash(msgpackr_1.pack(signable_data));
        if (!crypto_1.verify(hash, signature, public_key)) {
            data['_meta']['unsigned'] = true;
        }
        return true;
    }, 'signature must verify against data') {
        constructor(data) {
            if (typeof data === 'string')
                data = JSON.parse(data);
            if (data?._meta?.version && data?._meta?.version !== app_meta.version) {
                const direction = semverGtr(data._meta.version, app_meta.version) ? 'down' : 'up';
                const m_vers = semverSort(Object.keys(migrations));
                let migs = [];
                if (direction === 'up')
                    migs = m_vers.slice(0, m_vers.indexOf(app_meta.version) + 1);
                else
                    migs = m_vers.slice(m_vers.indexOf(app_meta.version) + 1).reverse();
                for (let i = 0; i < migs.length; i++) {
                    const ver = migs[i];
                    const migration = migrations[ver];
                    data = migration[direction](data);
                    data._meta.version =
                        direction === 'up'
                            ? ver
                            : m_vers.indexOf(ver) > 0
                                ? m_vers[m_vers.indexOf(ver) - 1]
                                : app_meta.version;
                    if (direction === 'up' &&
                        (!semverGtr(app_meta.version, ver) || migs.indexOf(ver) === migs.length - 1))
                        break;
                    if (direction === 'down' &&
                        (semverGtr(app_meta.version, ver) || migs.indexOf(ver) === migs.length - 1))
                        break;
                }
            }
            let tmp_meta;
            if (data?._meta) {
                tmp_meta = new Meta(data._meta);
                delete data._meta;
            }
            else {
                common_1.error('_meta missing');
            }
            if (data._meta?.unsigned === true)
                common_1.error("can't create object with unsigned data");
            super(data);
            this._meta = tmp_meta;
            ready = true;
        }
        toJSON() {
            const data = {};
            const keys = Object.keys(this);
            keys.forEach((k) => (data[k] = this[k]));
            data['_meta'] = this._meta;
            return JSON.stringify(data);
        }
        async sign() {
            if (typeof this['_meta']?.unsigned === undefined)
                return common_1.error('data is already signed');
            await checkUser(data);
            const { public_key } = getMetaDetails(this['_meta']);
            const pid = crypto_1.getIdFromPublicKey(crypto_1.hex2buf(public_key));
            if (!b4a_1.default.equals(current_id, pid))
                return common_1.error("current id doesn't match the author");
            const signature = await signObject(this);
            const { unsigned, ...meta } = this._meta;
            this._meta = new Meta({ ...meta, ...signature });
        }
    }
    async function signObject(data) {
        const { _meta, ...signable_data } = data;
        const hash = crypto_1.createHash(msgpackr_1.pack(signable_data));
        const signature = await app_meta.backbone.id.signObject({ hash });
        if (!signature) {
            return common_1.error(`signing object failed`);
        }
        else {
            return { signature, hash };
        }
    }
    async function checkUser(data) {
        if (!app_meta.backbone?.id) {
            if (typeof app_meta.backbone?.user?.authenticate === 'function') {
                await app_meta.backbone.user.authenticate();
            }
            else {
                return common_1.error('authentication required but no authentication method found');
            }
        }
        current_id = await app_meta.backbone.id.getId();
    }
    return async (data) => {
        if (typeof data === 'string') {
            try {
                data = JSON.parse(data);
            }
            catch (error) {
                return error('DataModel accepts only objects or stringified objects');
            }
        }
        if (data?._meta) {
            if (!opts?.disable_owneronly && !data._meta.signature) {
                return common_1.error('signature and id required');
            }
            await checkUser(data);
        }
        else {
            if (!opts?.disable_owneronly) {
                await checkUser(data);
                const signature = await signObject(data);
                data['_meta'] = new Meta({ ...signature, version: app_meta.version });
            }
            else {
                data._meta = new Meta({ version: app_meta.version });
            }
        }
        return new datamodel(data);
    };
}
exports.default = default_1;
//# sourceMappingURL=base.js.map