"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.base64 = exports.sleep = exports.registerMethods = exports.createCache = exports.hash = exports.getHomedir = exports.unique = exports.shuffle = exports.getRandomInt = exports.flatten = exports.JSONparse = exports.decodeCoreData = exports.encodeCoreData = exports.subscribeToEvent = exports.subscribeToChannel = exports.emit = exports.buf2hex = exports.error = exports.log = void 0;
const crypto_1 = require("@backbonedao/crypto");
const os_1 = __importDefault(require("os"));
const bbconfig_1 = __importDefault(require("../bbconfig"));
const ttl_1 = __importDefault(require("ttl"));
const eventemitter2_1 = require("eventemitter2");
const platform_detect_1 = __importDefault(require("platform-detect"));
const b4a_1 = __importDefault(require("b4a"));
const msgpackr_1 = require("msgpackr");
const EE = new eventemitter2_1.EventEmitter2();
function log(message, ...data) {
    if (process.env['LOG'] || (platform_detect_1.default.browser && window?.localStorage.getItem('LOG')))
        console.log(message, ...data);
}
exports.log = log;
function error(message, ...data) {
    if (process.env['LOG'] || (platform_detect_1.default.browser && window?.localStorage.getItem('LOG')))
        console.error(new Error(message), ...data);
    EE.emit('err', `${message} - ${JSON.stringify(data)}`);
    return;
}
exports.error = error;
function buf2hex(buffer) {
    return b4a_1.default.toString(buffer, 'hex');
}
exports.buf2hex = buf2hex;
function emit(params) {
    if (params.verbose && !process.env.VERBOSE)
        return;
    EE.emit(params.ch, params.msg);
    if (params.event)
        EE.emit(params.event);
    if (!params?.no_log)
        log(`${params.ch} > ${params.msg}`);
}
exports.emit = emit;
function subscribeToChannel(params) {
    return EE.on(params.ch, params.cb, { objectify: true });
}
exports.subscribeToChannel = subscribeToChannel;
function subscribeToEvent(params) {
    return EE.on(params.id, params.cb, { objectify: true });
}
exports.subscribeToEvent = subscribeToEvent;
function encodeCoreData(data) {
    if (!data)
        return error('empty data');
    return msgpackr_1.pack(data);
}
exports.encodeCoreData = encodeCoreData;
function decodeCoreData(data) {
    if (!data)
        return error('empty data');
    return msgpackr_1.unpack(data);
}
exports.decodeCoreData = decodeCoreData;
function JSONparse(stringify) {
    return JSON.parse(stringify, (k, v) => {
        if (v !== null &&
            typeof v === 'object' &&
            'type' in v &&
            v.type === 'Buffer' &&
            'data' in v &&
            Array.isArray(v.data)) {
            return b4a_1.default.from(v.data);
        }
        return v;
    });
}
exports.JSONparse = JSONparse;
function flatten(arr) {
    return arr.reduce((a, b) => (Array.isArray(b) ? [...a, ...flatten(b)] : [...a, b]), []);
}
exports.flatten = flatten;
function getRandomInt(min, max) {
    min = Math.ceil(min);
    max = Math.floor(max);
    return Math.floor(Math.random() * (max - min + 1)) + min;
}
exports.getRandomInt = getRandomInt;
function shuffle(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}
exports.shuffle = shuffle;
function unique(array) {
    return Array.from(new Set(array));
}
exports.unique = unique;
function getHomedir() {
    if (bbconfig_1.default?.user?.home_dir === '~')
        return process.env.TEST ? `${os_1.default.homedir()}/.backbone-test` : `${os_1.default.homedir()}/.backbone`;
    else
        return bbconfig_1.default?.user?.home_dir;
}
exports.getHomedir = getHomedir;
function hash(params) {
    const txt = typeof params.data !== 'string' ? JSON.stringify(params.data) : params.data;
    const hash = crypto_1.createHash(params.type);
    hash.update(txt);
    return buf2hex(hash.digest());
}
exports.hash = hash;
function createCache(params) {
    return new ttl_1.default({
        ttl: (params?.ttlsec || 60) * 1000,
        capacity: params?.capacity || 100000,
    });
}
exports.createCache = createCache;
function registerMethods(params) {
    const API = {};
    for (let m in params.methods) {
        API[params.methods[m]] = eval(`params.source.${params.methods[m]}`);
    }
    return API;
}
exports.registerMethods = registerMethods;
function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
exports.sleep = sleep;
exports.base64 = {
    _keyStr: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=',
    encode: function (input) {
        var output = '';
        var chr1, chr2, chr3, enc1, enc2, enc3, enc4;
        var i = 0;
        input = exports.base64._utf8_encode(input);
        while (i < input.length) {
            chr1 = input.charCodeAt(i++);
            chr2 = input.charCodeAt(i++);
            chr3 = input.charCodeAt(i++);
            enc1 = chr1 >> 2;
            enc2 = ((chr1 & 3) << 4) | (chr2 >> 4);
            enc3 = ((chr2 & 15) << 2) | (chr3 >> 6);
            enc4 = chr3 & 63;
            if (isNaN(chr2)) {
                enc3 = enc4 = 64;
            }
            else if (isNaN(chr3)) {
                enc4 = 64;
            }
            output =
                output +
                    this._keyStr.charAt(enc1) +
                    this._keyStr.charAt(enc2) +
                    this._keyStr.charAt(enc3) +
                    this._keyStr.charAt(enc4);
        }
        return output;
    },
    decode: function (input) {
        var output = '';
        var chr1, chr2, chr3;
        var enc1, enc2, enc3, enc4;
        var i = 0;
        input = input.replace(/[^A-Za-z0-9\+\/\=]/g, '');
        while (i < input.length) {
            enc1 = this._keyStr.indexOf(input.charAt(i++));
            enc2 = this._keyStr.indexOf(input.charAt(i++));
            enc3 = this._keyStr.indexOf(input.charAt(i++));
            enc4 = this._keyStr.indexOf(input.charAt(i++));
            chr1 = (enc1 << 2) | (enc2 >> 4);
            chr2 = ((enc2 & 15) << 4) | (enc3 >> 2);
            chr3 = ((enc3 & 3) << 6) | enc4;
            output = output + String.fromCharCode(chr1);
            if (enc3 != 64) {
                output = output + String.fromCharCode(chr2);
            }
            if (enc4 != 64) {
                output = output + String.fromCharCode(chr3);
            }
        }
        output = exports.base64._utf8_decode(output);
        return output;
    },
    _utf8_encode: function (string) {
        var utftext = '';
        string = string.replace(/\r\n/g, '\n');
        for (var n = 0; n < string.length; n++) {
            var c = string.charCodeAt(n);
            if (c < 128) {
                utftext += String.fromCharCode(c);
            }
            else if (c > 127 && c < 2048) {
                utftext += String.fromCharCode((c >> 6) | 192);
                utftext += String.fromCharCode((c & 63) | 128);
            }
            else {
                utftext += String.fromCharCode((c >> 12) | 224);
                utftext += String.fromCharCode(((c >> 6) & 63) | 128);
                utftext += String.fromCharCode((c & 63) | 128);
            }
        }
        return utftext;
    },
    _utf8_decode: function (utftext) {
        var string = '';
        var i = 0;
        var c, c1, c2, c3;
        c = c1 = c2 = 0;
        while (i < utftext.length) {
            c = utftext.charCodeAt(i);
            if (c < 128) {
                string += String.fromCharCode(c);
                i++;
            }
            else if (c > 191 && c < 224) {
                c2 = utftext.charCodeAt(i + 1);
                string += String.fromCharCode(((c & 31) << 6) | (c2 & 63));
                i += 2;
            }
            else {
                c2 = utftext.charCodeAt(i + 1);
                c3 = utftext.charCodeAt(i + 2);
                string += String.fromCharCode(((c & 15) << 12) | ((c2 & 63) << 6) | (c3 & 63));
                i += 3;
            }
        }
        return string;
    },
};
//# sourceMappingURL=index.js.map