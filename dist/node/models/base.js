"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Set = exports.Map = exports.Array = exports.Object = exports.Model = void 0;
const common_1 = require("../common");
const objectmodel_1 = __importDefault(require("objectmodel"));
const { Model, ObjectModel, ArrayModel, MapModel, SetModel } = objectmodel_1.default;
exports.Model = Model;
exports.Object = ObjectModel;
exports.Array = ArrayModel;
exports.Map = MapModel;
exports.Set = SetModel;
const semverSort = require('semver/functions/sort');
const semverGtr = require('semver/ranges/gtr');
const ethers_1 = require("ethers");
const crypto_1 = require("@backbonedao/crypto");
const b4a_1 = __importDefault(require("b4a"));
const msgpackr_1 = require("msgpackr");
const Meta = Model({
    version: String,
    hash: [String],
    signature: [String],
    id: [String],
    unsigned: [Boolean],
})
    .assert((data) => {
    if (data?.signature)
        return data.signature.length === 130;
    else
        return true;
}, 'signature should have lenght of 130')
    .assert((data) => {
    if (data?.id)
        return ethers_1.ethers.utils.isAddress(data.id);
    else
        return true;
}, 'Id should be valid 0x address');
async function default_1(data, opts, migrations) {
    if (process.env['TEST'] && opts?.disable_owneronly !== false)
        opts = { ...opts, disable_owneronly: true };
    let ready = false;
    let current_id = '';
    const app_meta = {
        version: opts?._debug?.app_version || '0',
        backbone: () => (typeof window === 'object' && window.backbone) ||
            (typeof global === 'object' && global.backbone),
    };
    if (typeof app_meta.backbone()?.app?.meta?._getMeta === 'function') {
        const manifest = await app_meta.backbone().app.meta?._getMeta('manifest');
        if (!manifest)
            return common_1.error('no manifest found');
        app_meta.version = manifest.version;
    }
    function getMetaDetails(meta) {
        const public_key = crypto_1.getPublicKeyFromSig({
            message: crypto_1.hex2buf(meta.hash),
            signature: crypto_1.hex2buf(meta.signature),
        });
        return { ...meta, public_key };
    }
    class datamodel extends Model(data).assert((data) => {
        if (!ready)
            return true;
        if (opts?.disable_owneronly)
            return true;
        if (!data?._meta)
            return true;
        if (data?._meta?.unsigned)
            return true;
        if (!current_id) {
            data['_meta']['unsigned'] = true;
            return true;
        }
        const { signature, public_key } = getMetaDetails(data._meta);
        const { _meta, ...signable_data } = data;
        const hash = crypto_1.createHash(msgpackr_1.pack(signable_data));
        if (data._initial) {
            return true;
        }
        else if (!crypto_1.verify(hash, signature, public_key)) {
            const og_id = crypto_1.getIdFromPublicKey(crypto_1.hex2buf(public_key));
            if (b4a_1.default.equals(og_id, current_id)) {
                data['_meta']['unsigned'] = true;
                return true;
            }
            else
                return false;
        }
        else {
            return true;
        }
    }, 'signature must verify against data') {
        constructor(data) {
            try {
                if (typeof data === 'string')
                    data = JSON.parse(data);
            }
            catch (error) {
                error('input data must be an object or stringified JSON');
            }
            if (Object.keys(migrations || {}).length > 0 && data?._meta?.version && data?._meta?.version !== app_meta.version) {
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
            if (!opts?.disable_owneronly && data._meta?.unsigned === true)
                common_1.error("can't create object with unsigned data");
            super(data);
            this._meta = tmp_meta;
            delete this._initial;
            ready = true;
        }
        flatten() {
            const data = {};
            Object.keys(this).forEach((k) => (data[k] = this[k]));
            data['_meta'] = {};
            Object.keys(this._meta).forEach((k) => (data['_meta'][k] = this['_meta'][k]));
            return data;
        }
        toJSON() {
            const data = this.flatten();
            return JSON.stringify(data);
        }
        async sign() {
            if (typeof this['_meta']?.unsigned === undefined)
                return common_1.error('data is already signed');
            await checkUser();
            if (!current_id)
                return common_1.error('tried to sign without being authenticated');
            let { public_key } = getMetaDetails(this['_meta']);
            let pid = crypto_1.getIdFromPublicKey(crypto_1.hex2buf(public_key));
            if (!b4a_1.default.isBuffer(public_key))
                public_key = crypto_1.hex2buf(public_key);
            if (!b4a_1.default.isBuffer(current_id))
                current_id = crypto_1.hex2buf(current_id.match(/^0x/) ? current_id : '0x' + current_id);
            if (!b4a_1.default.equals(current_id, pid))
                return common_1.error("current id doesn't match the author");
            const signature = await signObject(this);
            const { unsigned, ...meta } = this._meta;
            const m = new Meta({ ...meta, ...signature });
            this._meta = m;
            return true;
        }
    }
    async function signObject(data) {
        if (!current_id) {
            return checkUser();
        }
        let signable_data;
        if (data?._meta) {
            let { _meta, ..._signable_data } = data;
            signable_data = _signable_data;
            if (_meta?.signature && _meta?.hash && !_meta?.unsigned)
                return _meta;
        }
        else {
            signable_data = data;
        }
        let hash = crypto_1.createHash(msgpackr_1.pack(signable_data));
        let signature = await app_meta.backbone().id.signObject({ hash });
        if (b4a_1.default.isBuffer(hash))
            hash = crypto_1.buf2hex(hash);
        if (b4a_1.default.isBuffer(signature))
            signature = crypto_1.buf2hex(signature);
        if (!signature) {
            return common_1.error(`signing object failed`);
        }
        else {
            return { signature, hash };
        }
    }
    async function checkUser() {
        if (!app_meta.backbone()?.id) {
            if (typeof app_meta.backbone()?.user === 'function') {
                await app_meta.backbone().user();
                await checkUser();
            }
            else {
                return common_1.error('authentication required but no authentication method found');
            }
        }
        else {
            const is_authenticated = await app_meta.backbone().id.isAuthenticated();
            if (is_authenticated) {
                current_id = await app_meta.backbone().id.getId();
                if (!current_id)
                    return common_1.error('error in getting user id');
            }
            else {
                await app_meta.backbone().user();
                await checkUser();
            }
        }
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
        }
        else {
            if (!opts?.disable_owneronly) {
                await checkUser();
                const signature = await signObject(data);
                data['_meta'] = new Meta({ ...signature, version: app_meta.version });
                data['_initial'] = true;
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