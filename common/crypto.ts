import { createHash, randomBytes } from 'crypto'
import { ethers } from 'ethers'
import sodium from 'sodium-universal'
import * as secp256k1 from 'noble-secp256k1'
import { decodeCoreData, encodeCoreData, getRandomInt, JSONparse } from '.'
import { Id } from './interfaces'
import { LedgerSigner } from "@ethersproject/hardware-wallets"
import b4a from 'b4a'

export function numericHash(seed?: Buffer) {
  let s = seed ? seed.toString('hex') : createHash('sha256').update(randomBytes(32)).digest('hex')
  return (BigInt('0x' + s) % (10n ** BigInt(10))).toString()
}

export function sha256(input: string) {
  return createHash('sha256').update(input.toString()).digest('hex')
}

export function randomStr(len: number = 32) {
  return randomBytes(32).toString('hex').slice(0, 32)
}

export function encrypt(params: { key: string, data: string | Buffer | object }) {
  let d = encodeCoreData(params.data)

  const secret = Buffer.from(sha256(params.key)).slice(0, 32)
  const nonce = Buffer.alloc(sodium.crypto_secretbox_NONCEBYTES)

  sodium.randombytes_buf(nonce)

  const cipher = Buffer.alloc(d.length + sodium.crypto_secretbox_MACBYTES)

  sodium.crypto_secretbox_easy(cipher, d, nonce, secret)
  return { cipher, nonce: nonce.toString('hex') }
}

export function decrypt(params: { key: string, cipher: Buffer, nonce: string }) {
  //console.log(params.cipher.length, sodium.crypto_secretbox_MACBYTES)
  const decrypted_data = Buffer.alloc(params.cipher.length - sodium.crypto_secretbox_MACBYTES)
  const secret = Buffer.from(sha256(params.key)).slice(0, 32)
  sodium.crypto_secretbox_open_easy(decrypted_data, params.cipher, Buffer.from(params.nonce, 'hex'), secret)
  const type = decrypted_data.slice(0, 2)

  // let data: any
  // if (Buffer.compare(type, Buffer.from('0|')) === 1) data = decrypted_data.slice(2)
  // if (Buffer.compare(type, Buffer.from('1|')) === 1) data = Buffer.from(decrypted_data.slice(2)).toString()
  // if (Buffer.compare(type, Buffer.from('2|')) === 1) data = JSONparse(Buffer.from(decrypted_data.slice(2)).toString())
  // return data
  return decodeCoreData(decrypted_data)
}

export function securePassword(input: string) {
  const output = Buffer.alloc(sodium.crypto_pwhash_STRBYTES)
  const passwd = Buffer.from(input)
  const opslimit = sodium.crypto_pwhash_OPSLIMIT_INTERACTIVE
  const memlimit = sodium.crypto_pwhash_MEMLIMIT_INTERACTIVE
  sodium.crypto_pwhash_str(output, passwd, opslimit, memlimit)
  return output.toString('hex')
}

export function verifyPassword(params: { hash: string, password: string }) {
  return sodium.crypto_pwhash_str_verify(Buffer.from(params?.hash, 'hex'), Buffer.from(params?.password))
}

export async function createId(seed: string) {
  let id: Id = ethers.utils.HDNode.fromSeed(Buffer.from(seed))
  const uncompressed_publicKey = secp256k1.getPublicKey(id.privateKey.replace('0x', ''))
  return { ...id, publicKey: uncompressed_publicKey }
}

export async function sign(params: { id: Id, data: any }) {
  return await secp256k1.sign(sha256(JSON.stringify(params.data)), params.id.privateKey.replace('0x', ''))
}

function _initLedger(path: string){
  const provider = new ethers.providers.JsonRpcProvider();
  const signer = new LedgerSigner(provider, "hid", path || undefined)
  return signer
}

export async function signLedger(params: { data: any, path?: string }) {
  const signer = _initLedger(params?.path || '')
  return await signer.signMessage(JSON.stringify(params.data))
}

export function verifySignature(params: { public_key: string, data: any, signature: string }) {
  return secp256k1.verify(params.signature, sha256(JSON.stringify(params.data)), params.public_key)
}

export async function generatePathAddress(params: { signer_type: 'native' | 'ledger', path?: string, seed?: string, level1?: number, level2?: number }) {
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
    const signer = _initLedger(path)
    address = await signer.getAddress()
  } else throw new Error('UNKNOWN SIGNER TYPE')
  return { address, level1, level2, path }
}

export function generateNoiseKeypair(seed: string) {
  const publicKey = b4a.allocUnsafe(sodium.crypto_sign_PUBLICKEYBYTES)
  const secretKey = b4a.allocUnsafe(sodium.crypto_sign_SECRETKEYBYTES)

  if (seed) sodium.crypto_sign_seed_keypair(publicKey, secretKey, Buffer.from(seed, 'hex'))
  else sodium.crypto_sign_keypair(publicKey, secretKey)

  return {
    publicKey,
    secretKey
  }
}