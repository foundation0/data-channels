import { createHash } from 'crypto'
import { homedir } from 'os'
import { user } from '../bbconfig'
import ttl from 'ttl'
import { verifySignature } from './crypto'
import { IndexPayment } from './interfaces'
import { EventEmitter2 } from 'eventemitter2'
import { fetchPeersFromContract } from '../network'
import { validateObject } from './validation'

const EE = new EventEmitter2()

export function log(message: string, ...data: any) {
  if (process.env['LOG']) console.log(message, ...data)
}
export function error(message: string, ...data: any) {
  if (process.env['LOG']) console.log(`ERROR: ${message}`, ...data)
  EE.emit('error', `${message} - ${JSON.stringify(data)}`)
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
  let d: Buffer
  if (Buffer.isBuffer(data)) d = Buffer.concat([Buffer.from('1|'), data])
  else if (typeof data === 'string') d = Buffer.concat([Buffer.from('2|'), Buffer.from(data)])
  else if (typeof data === 'object')
    d = Buffer.concat([Buffer.from('3|'), Buffer.from(JSON.stringify(data))])
  else if (typeof data === 'number')
    d = Buffer.concat([Buffer.from('4|'), Buffer.from(data.toString())])
  else throw new Error('UNKNOWN DATA FORMAT')
  return d
}

export function decodeCoreData(data: Buffer) {
  if (!Buffer.isBuffer(data)) throw new Error('NOT BUFFER')
  let decoded_data: any
  const type = data.slice(0, 2)
  if (type.toString() === Buffer.from('1|').toString()) decoded_data = data.slice(2)
  if (type.toString() === Buffer.from('2|').toString())
    decoded_data = Buffer.from(data.slice(2)).toString()
  if (type.toString() === Buffer.from('3|').toString())
    decoded_data = JSONparse(Buffer.from(data.slice(2)).toString())
  if (type.toString() === Buffer.from('4|').toString())
    decoded_data = parseFloat(Buffer.from(data.slice(2)).toString())
  return decoded_data
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
  return hash.digest().toString('hex')
}

export function createCache(params: { ttlsec?: number; capacity?: number }) {
  return new ttl({
    ttl: (params?.ttlsec || 60) * 1000,
    capacity: params?.capacity || 100000,
  })
}

export async function fetchPeers(type: string) {
  if (process.env.TEST) return []
  return [...(await fetchPeersFromContract(type))]
}

export function registerMethods(params: { source: object; methods: string[] }) {
  const API: any = {}
  for (let m in params.methods) {
    API[params.methods[m]] = eval(`params.source.${params.methods[m]}`)
  }
  return API
}

export async function verifyPayload(payload) {
  // verify object
  if (!payload?.object) throw new Error('OBJECT_FIELD_MISSING')
  if (!(await validateObject(payload.object))) throw new Error('INVALID_OBJECT')

  // verify signature
  if (!payload?.signature) throw new Error('SIGNATURE_FIELD_MISSING')
  if (!(await verifySign(payload))) throw new Error('INVALID_SIGNATURE')

  // verify owner
  if (!payload?.owner) throw new Error('OWNER_FIELD_MISSING')

  // verify address is valid Ethereum address
  if (!payload?.address) throw new Error('ADDRESS_FIELD_MISSING')

  // verify meta
  if (!payload?.meta) throw new Error('META_FIELD_MISSING')

  // TODO: upgrade this once 3dhashint is ready
  if (payload?.meta.position && typeof payload.meta.position === 'number')
    throw new Error('INVALID_POSITION')

  // TODO: upgrade this once there is consensus how metaverse ids are assigned
  if (payload?.meta.metaverse_id && payload.meta.metaverse_id !== 0)
    throw new Error('INVALID_METAVERSE_ID')

  return true
}

export async function verifyPayment(payment: IndexPayment) {
  // TODO move payment checking here, so it can be used by all
  return true
}

export async function verifyTx(params: { id: string; chain: number }) {
  return 1
}

// export async function verifyObject(object) {
//   return true
// }

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
