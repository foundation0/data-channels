import { randomBytes, buf2hex, hex2buf, getPublicKeyFromSig } from '@backbonedao/crypto'
import { base64 } from 'ethers/lib/utils';
import { error } from './common'

export async function UUID(len?) {
  return buf2hex(randomBytes(len || 32))
}

export async function verifyAuthor(params: { model: any; model2?: any }) {
  if (!params?.model?._meta?.signature || !params?.model?._meta?.hash)
    return error('model has invalid _meta')
  if (!params?.model2?._meta?.signature || !params?.model2?._meta?.hash)
    return error('model2 has invalid _meta')

  // extract public key from model1
  const meta = params.model._meta
  const sig1 = getPublicKeyFromSig({
    message: hex2buf(meta.hash),
    signature: hex2buf(meta.signature),
  })

  // extract public key from model2
  const meta2 = params.model2._meta
  const sig2 = getPublicKeyFromSig({
    message: hex2buf(meta2.hash),
    signature: hex2buf(meta2.signature),
  })
  // check if they match
  return sig1 === sig2
}
