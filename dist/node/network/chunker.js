"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Split = exports.Merge = void 0;
const varint_1 = __importDefault(require("varint"));
const streamx_1 = require("streamx");
function concat(packet) {
    const buf = new Uint8Array(packet.byteLength);
    let offset = 0;
    packet.chunks.forEach(chunk => {
        buf.set(chunk.data, offset);
        offset += chunk.data.length;
    });
    return buf;
}
const sort = (a, b) => a.index - b.index;
class Merge extends streamx_1.Transform {
    constructor(opts = {}) {
        const { timeout = 5000, ...streamOpts } = opts;
        super(streamOpts);
        this._timeout = timeout;
        this._packets = new Map();
    }
    _open(cb) {
        if (this._timeout) {
            this._timestamp = Date.now();
            this._interval = setInterval(() => {
                this._packets.forEach(packet => {
                    if (Math.abs(packet.timestamp - this._timestamp) > this._timeout) {
                        this._packets.delete(packet.id);
                    }
                });
                this._timestamp = Date.now();
            }, this._timeout);
        }
        cb(null);
    }
    _destroy(cb) {
        this._interval && clearInterval(this._interval);
        cb(null);
    }
    _transform(data, cb) {
        try {
            const buf = this._decodePacket(data);
            if (buf)
                this.push(buf);
            cb(null);
        }
        catch (err) {
            cb(err);
        }
    }
    _decodePacket(data) {
        let offsetDecoder = 0;
        const timestamp = varint_1.default.decode(data, offsetDecoder);
        offsetDecoder += varint_1.default.decode.bytes;
        const offset = varint_1.default.decode(data, offsetDecoder);
        offsetDecoder += varint_1.default.decode.bytes;
        const size = varint_1.default.decode(data, offsetDecoder);
        offsetDecoder += varint_1.default.decode.bytes;
        const index = varint_1.default.decode(data, offsetDecoder);
        offsetDecoder += varint_1.default.decode.bytes;
        data = data.slice(offsetDecoder);
        const id = timestamp + '/' + offset;
        let packet = this._packets.get(id);
        if (!packet) {
            packet = { id, chunks: [], size, byteLength: 0, timestamp: Date.now() };
            this._packets.set(id, packet);
        }
        const chunk = { index, data };
        packet.chunks.push(chunk);
        packet.byteLength += chunk.data.byteLength;
        if (packet.chunks.length === packet.size) {
            packet.chunks.sort(sort);
            this._packets.delete(id);
            return concat(packet);
        }
        return null;
    }
}
exports.Merge = Merge;
function idGenerator() {
    const limit = 10000;
    let timestamp = 0;
    let offset = 0;
    function reset() {
        timestamp = Date.now();
        offset = 0;
    }
    reset();
    return function generate() {
        if (offset > limit) {
            reset();
        }
        return { timestamp, offset: offset++ };
    };
}
const idGenerate = idGenerator();
function encodePacket(data, id, index, size) {
    let offsetEncoder = 0;
    const buf = new Uint8Array(varint_1.default.encodingLength(id.timestamp) +
        varint_1.default.encodingLength(id.offset) +
        varint_1.default.encodingLength(size) +
        varint_1.default.encodingLength(index) +
        data.byteLength);
    varint_1.default.encode(id.timestamp, buf, offsetEncoder);
    offsetEncoder += varint_1.default.encode.bytes;
    varint_1.default.encode(id.offset, buf, offsetEncoder);
    offsetEncoder += varint_1.default.encode.bytes;
    varint_1.default.encode(size, buf, offsetEncoder);
    offsetEncoder += varint_1.default.encode.bytes;
    varint_1.default.encode(index, buf, offsetEncoder);
    offsetEncoder += varint_1.default.encode.bytes;
    buf.set(data, offsetEncoder);
    return buf;
}
class Split extends streamx_1.Transform {
    constructor(opts = {}) {
        const { chunkSize = 1024, ...streamOpts } = opts;
        super(streamOpts);
        this._chunkSize = chunkSize;
    }
    _transform(data, cb) {
        let buf;
        const id = idGenerate();
        if (data.length <= this._chunkSize) {
            buf = encodePacket(data, id, 0, 1);
            this.push(buf);
        }
        else {
            let offset = 0;
            let end = 0;
            let index = 0;
            const size = Math.ceil(data.length / this._chunkSize);
            while (offset < data.length) {
                end = offset + this._chunkSize;
                if (end > data.length) {
                    end = data.length;
                }
                buf = encodePacket(data.slice(offset, end), id, index++, size);
                offset = end;
                this.push(buf);
            }
        }
        cb(null);
    }
}
exports.Split = Split;
//# sourceMappingURL=chunker.js.map