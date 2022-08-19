import { ethers } from 'ethers'
import sodium from 'sodium-javascript'
import {  decodeCoreData, encodeCoreData, error, getRandomInt } from '.'
import { Id } from './interfaces'
import b4a from 'b4a'
const Buffer = b4a
import crypto from '@backbonedao/crypto'

export const randomBytes = crypto.randomBytes 

export function numericHash(seed?: Buffer) {
  let s = seed ? crypto.buf2hex(seed) : sha256(crypto.buf2hex(randomBytes(32)))
  return (BigInt('0x' + s) % (10n ** BigInt(10))).toString()
}

export const sha256 = crypto.createHash

export function randomStr(len: number = 32) {
  return crypto.buf2hex(randomBytes(32)).slice(0, 32)
}

export function encrypt(params: { key: string, data: string | Buffer | object }) {
  let d = encodeCoreData(params.data)
  if(!d) return error('encrypt needs data')

  const secret = Buffer.from(sha256(params.key), 'hex').slice(0, 32)
  const nonce = Buffer.alloc(sodium.crypto_secretbox_NONCEBYTES)

  sodium.randombytes_buf(nonce)

  const cipher = Buffer.alloc(d.length + sodium.crypto_secretbox_MACBYTES)

  sodium.crypto_secretbox_easy(cipher, d, nonce, secret)
  return { cipher, nonce: crypto.buf2hex(nonce) }
}

export function decrypt(params: { key: string, cipher: Buffer, nonce: string }) {
  const decrypted_data = Buffer.alloc(params.cipher.length - sodium.crypto_secretbox_MACBYTES)
  const secret = Buffer.from(sha256(params.key), 'hex').slice(0, 32)
  sodium.crypto_secretbox_open_easy(decrypted_data, params.cipher, Buffer.from(params.nonce, 'hex'), secret)
  return decodeCoreData(decrypted_data)
}

export const securePassword = crypto.securePassword

export const verifyPassword = crypto.verifyPassword

export async function createId(seed: string) {
  return crypto.keyPair(seed)
}

export async function sign(params: { id: Id, data: any }) {
  return crypto.sign(params.data, params.id.secretKey)
}

export function verifySignature(params: { public_key: string, data: any, signature: string }) {
  return crypto.verify(params.data, params.signature, params.public_key)
}

export async function generatePathAddress(params: { signer_type: 'native' | 'ledger' | 'walletconnect', path?: string, seed?: string, level1?: number, level2?: number }) {
  const max_path = 2140000000
  const level1 = params?.level1 || getRandomInt(0, max_path)
  const level2 = params?.level2 || getRandomInt(0, max_path)
  const path = `m/44'/60'/0'/${level1}/${level2}`
  let address: string
  if(params?.signer_type === 'native') {
    if(!params?.seed) throw new Error('NATIVE SIGNER NEEDS SEED')
    const master = ethers.utils.HDNode.fromSeed(Buffer.from(params.seed))
    const derived_wallet = master.derivePath(path)
    address = derived_wallet.address
  } else if(params?.signer_type === 'ledger') {
    throw new Error('NOT_AVAILABLE')
    // const signer = _initLedger(path)
    // address = await signer.getAddress()
  } else throw new Error('UNKNOWN SIGNER TYPE')
  return { address, level1, level2, path }
}

export function generateNoiseKeypair(seed: string) {
  return crypto.keyPair(seed)
}

export function generateAddress(seed: string) {
  const keyPair = crypto.keyPair(seed)
  return keyPair.publicKey
}