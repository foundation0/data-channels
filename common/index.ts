import { createHash } from '@backbonedao/crypto'
import os from 'os'
import Config from '../bbconfig'
import ttl from 'ttl'
import { EventEmitter2 } from 'eventemitter2'
import platform from 'platform-detect'
import Buffer from 'b4a'
import { unpack, pack } from 'msgpackr'
import {Base64} from 'js-base64';

const EE = new EventEmitter2()
if(typeof window === 'object'){
  window['backbone'] = { ...window['backbone'] || {}, events: EE }
}

export function log(message: string, ...data: any) {
  if (process.env['LOG'] || (platform.browser && window?.localStorage.getItem('LOG')))
    console.log(message, ...data)
}
export function error(message: string, ...data: any) {
  if (process.env['LOG'] || (platform.browser && window?.localStorage.getItem('LOG')))
    console.error(new Error(message), ...data)
  EE.emit('err', `${message} - ${JSON.stringify(data)}`)
  return
  // console.error(message)
}

export function buf2hex(buffer) {
  // buffer is an ArrayBuffer
  return Buffer.toString(buffer, 'hex')
}

export function getEnvVar(key) {
  if(typeof window === 'object') return localStorage.getItem(key)
  if(typeof global === 'object') return process.env[key]
}

export function emit(params: {
  ch: string
  msg: string | object | number
  event?: string
  verbose?: boolean
  no_log?: boolean
}) {
  if (params.verbose && !getEnvVar('VERBOSE')) return
  EE.emit(params.ch, params.msg)
  if (params.event) EE.emit(params.event)
  if (!params?.no_log && params.ch.charAt(0) !== '_') return log(`${params.ch} > ${JSON.stringify(params.msg)}`)
  if (getEnvVar('SYSLOG') && params.ch.charAt(0) === '_') return log(`${params.ch} > ${JSON.stringify(params.msg)}`)
}

export function subscribeToChannel(params: { ch: string; cb: any }) {
  return EE.on(params.ch, params.cb, { objectify: true })
}

export function subscribeToEvent(params: { id: string; cb: any }) {
  return EE.on(params.id, params.cb, { objectify: true })
}

export function encodeCoreData(data: string | Buffer | object | number) {
  if (!data) return error('empty data')
  return pack(data)
}

export function decodeCoreData(data: Buffer) {
  if (!data) return error('empty data')
  return unpack(data)
}

export function JSONparse(stringify) {
  return JSON.parse(stringify, (k, v) => {
    if (
      v !== null &&
      typeof v === 'object' &&
      'type' in v &&
      v.type === 'Buffer' &&
      'data' in v &&
      Array.isArray(v.data)
    ) {
      return Buffer.from(v.data)
    }
    return v
  })
}

export function flatten(arr) {
  return arr.reduce((a, b) => (Array.isArray(b) ? [...a, ...flatten(b)] : [...a, b]), [])
}

export function getRandomInt(min, max) {
  min = Math.ceil(min)
  max = Math.floor(max)
  return Math.floor(Math.random() * (max - min + 1)) + min
}

export function shuffle(array: string[]) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[array[i], array[j]] = [array[j], array[i]]
  }
  return array
}

export function unique(array: string[]) {
  return Array.from(new Set(array))
}

export function getHomedir() {
  if (Config?.user?.home_dir === '~')
    return process.env.TEST ? `${os.homedir()}/.backbone-test` : `${os.homedir()}/.backbone`
  else return Config?.user?.home_dir
}

export function hash(params: { type: string; data: any }) {
  const txt = typeof params.data !== 'string' ? JSON.stringify(params.data) : params.data
  const hash = createHash(params.type)
  hash.update(txt)
  return buf2hex(hash.digest())
}

export function createCache(params: { ttlsec?: number; capacity?: number }) {
  return new ttl({
    ttl: (params?.ttlsec || 60) * 1000,
    capacity: params?.capacity || 100000,
  })
}

export function registerMethods(params: { source: object; methods: string[] }) {
  const API: any = {}
  for (let m in params.methods) {
    API[params.methods[m]] = eval(`params.source.${params.methods[m]}`)
  }
  return API
}
export function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/* export const base64_old = {
  // private property
  _keyStr: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=',

  // public method for encoding
  encode: function (input) {
    var output = ''
    var chr1, chr2, chr3, enc1, enc2, enc3, enc4
    var i = 0

    input = base64._utf8_encode(input)

    while (i < input.length) {
      chr1 = input.charCodeAt(i++)
      chr2 = input.charCodeAt(i++)
      chr3 = input.charCodeAt(i++)

      enc1 = chr1 >> 2
      enc2 = ((chr1 & 3) << 4) | (chr2 >> 4)
      enc3 = ((chr2 & 15) << 2) | (chr3 >> 6)
      enc4 = chr3 & 63

      if (isNaN(chr2)) {
        enc3 = enc4 = 64
      } else if (isNaN(chr3)) {
        enc4 = 64
      }

      output =
        output +
        this._keyStr.charAt(enc1) +
        this._keyStr.charAt(enc2) +
        this._keyStr.charAt(enc3) +
        this._keyStr.charAt(enc4)
    } // Whend

    return output
  }, // End Function encode

  // public method for decoding
  decode: function (input) {
    var output = ''
    var chr1, chr2, chr3
    var enc1, enc2, enc3, enc4
    var i = 0

    input = input.replace(/[^A-Za-z0-9\+\/\=]/g, '')
    while (i < input.length) {
      enc1 = this._keyStr.indexOf(input.charAt(i++))
      enc2 = this._keyStr.indexOf(input.charAt(i++))
      enc3 = this._keyStr.indexOf(input.charAt(i++))
      enc4 = this._keyStr.indexOf(input.charAt(i++))

      chr1 = (enc1 << 2) | (enc2 >> 4)
      chr2 = ((enc2 & 15) << 4) | (enc3 >> 2)
      chr3 = ((enc3 & 3) << 6) | enc4

      output = output + String.fromCharCode(chr1)

      if (enc3 != 64) {
        output = output + String.fromCharCode(chr2)
      }

      if (enc4 != 64) {
        output = output + String.fromCharCode(chr3)
      }
    } // Whend

    output = base64._utf8_decode(output)

    return output
  }, // End Function decode

  // private method for UTF-8 encoding
  _utf8_encode: function (string) {
    var utftext = ''
    string = string.replace(/\r\n/g, '\n')

    for (var n = 0; n < string.length; n++) {
      var c = string.charCodeAt(n)

      if (c < 128) {
        utftext += String.fromCharCode(c)
      } else if (c > 127 && c < 2048) {
        utftext += String.fromCharCode((c >> 6) | 192)
        utftext += String.fromCharCode((c & 63) | 128)
      } else {
        utftext += String.fromCharCode((c >> 12) | 224)
        utftext += String.fromCharCode(((c >> 6) & 63) | 128)
        utftext += String.fromCharCode((c & 63) | 128)
      }
    } // Next n

    return utftext
  }, // End Function _utf8_encode

  // private method for UTF-8 decoding
  _utf8_decode: function (utftext) {
    var string = ''
    var i = 0
    var c, c1, c2, c3
    c = c1 = c2 = 0

    while (i < utftext.length) {
      c = utftext.charCodeAt(i)

      if (c < 128) {
        string += String.fromCharCode(c)
        i++
      } else if (c > 191 && c < 224) {
        c2 = utftext.charCodeAt(i + 1)
        string += String.fromCharCode(((c & 31) << 6) | (c2 & 63))
        i += 2
      } else {
        c2 = utftext.charCodeAt(i + 1)
        c3 = utftext.charCodeAt(i + 2)
        string += String.fromCharCode(((c & 15) << 12) | ((c2 & 63) << 6) | (c3 & 63))
        i += 3
      }
    } // Whend

    return string
  }, // End Function _utf8_decode
} */

export const base64 = {
  encode: Base64.encode,
  decode: Base64.decode,
}
