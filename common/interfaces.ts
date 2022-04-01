import { Mnemonic } from 'ethers/lib/utils'

export interface UserConfig {
  username: string
  password: string
  signer_type: 'native' | 'ledger'
  new?: boolean
  reminder?: string
  pin?: string
  rewards_address?: string
}

export interface BackboneConfig {
  env?: 'browser' | 'node'
  homedir?: string
  debug?: boolean
}

export interface CoreConfig extends BackboneConfig {
  address: string
  encryption_key?: string | boolean
  writers: string[]
  indexes: string[]
  private: boolean
  network?: string[]
  storage_prefix: string
  storage?: 'ram' | 'rai' | 'raf'
  firewall?: Function
  noiseKeypair?: string
}

export interface AccessConfig extends BackboneConfig {
  port: number
  host: string
  no_servers?: boolean
  address?: string
}

export interface Id {
  publicKey: string
  privateKey: string
  fingerprint?: string
  parentFingerprint?: string
  address: string
  mnemonic?: Mnemonic
  path?: string
  chainCode?: string
  index?: number
  depth?: number
}

export interface EncryptedObject {
  cipher: Buffer
  nonce: string
}

export interface AuthWrapper {
  reminder: string
  user: EncryptedObject
}

export interface KeyVault {
  pin?: string
  signer_type: 'native' | 'ledger'
  seed?: string // used with native signer
  verify_nonce?: string // used with ledger
  verify_signature?: string // used with ledger
}

export interface Path {
  address: string
  encryption_key: string
}

export type IndexPayment = {
  pow?: {
    work: string
    threshold?: string
    blockHash?: string
    challenge?: string
  }
  tx?: {
    id: string
    chain: number
    value: number
    // tbd
  }
}

export interface Token {
  type: 'ERC20' | 'ERC721'
  address: string
}

export interface Wallet {
  type: 'EO' | 'contract'
}

export interface IndexPayload {
  owner: string
  signature?: string
  address: string // wallet address
  token?: Token
  meta: {
    metaverse_id: number
    position: number
    nonce?: number
  }
  object: {
    [key: string]: string | object
  }
  _data?: WriteRequestMetaData
}

export type WriteRequestMetaData = {
  payment: IndexPayment
  __: {
    queuer?: {
      public_key: string
      signature: string
    }
    writer?: {
      public_key: string
      signature: string
    }
  }
}

export type WriteRequestPayload = IndexPayload & WriteRequestMetaData
