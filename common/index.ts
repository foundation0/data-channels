import { createHash } from 'crypto'
import { homedir } from 'os'
import { user } from '../bbconfig'
import ttl from 'ttl'
import { verifySignature } from './crypto'
import { EventEmitter2 } from 'eventemitter2'
import platform from 'platform-detect'
import Buffer from 'b4a'
import { unpack, pack } from 'msgpackr'

const EE = new EventEmitter2()

export function log(message: string, ...data: any) {
  if (process.env['LOG'] || (platform.browser && window?.localStorage.getItem('LOG'))) console.log(message, ...data)
}
export function error(message: string, ...data: any) {
  if (process.env['LOG'] || (platform.browser && window?.localStorage.getItem('LOG'))) console.log(`ERROR: ${message}`, ...data)
  throw new Error(message)
  // EE.emit('error', `${message} - ${JSON.stringify(data)}`)
}

export function buf2hex(buffer) { // buffer is an ArrayBuffer
  return Buffer.toString(buffer, 'hex')
}

export function emit(params: { ch: string; msg: string; verbose?: boolean; no_log?: boolean }) {
  if (params.verbose && !process.env.VERBOSE) return
  EE.emit(params.ch, params.msg)
  if (!params?.no_log) log(`${params.ch} > ${params.msg}`)
}

export function subscribe(params: { ch: string; cb: any }) {
  return EE.on(params.ch, params.cb, { objectify: true })
}

export function encodeCoreData(data: string | Buffer | object | number) {
  return pack(data)
}

export function decodeCoreData(data: Buffer) {
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
  if (user.home_dir === '~')
    return process.env.TEST ? `${homedir()}/.backbone-test` : `${homedir()}/.backbone`
  else return user.home_dir
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

export async function fetchPeers(type: string) {
  if (process.env.TEST) return []
  return []
}

export function registerMethods(params: { source: object; methods: string[] }) {
  const API: any = {}
  for (let m in params.methods) {
    API[params.methods[m]] = eval(`params.source.${params.methods[m]}`)
  }
  return API
}

async function verifySign(payload) {
  const data = JSON.stringify(payload.meta) + JSON.stringify(payload.object)
  return await verifySignature({
    public_key: payload.owner,
    data,
    signature: payload.signature,
  })
}

export function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
