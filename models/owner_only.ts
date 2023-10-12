import { Object } from './base'
import om from 'objectmodel'; const { Any } = om
import { verify, hex2buf } from '@foundation0/crypto'

const OwnerOnly = Object({
  owner: String,
  signature: String,
  data: Any,
}).assert((model) => {
  // check if signature matches data
  return verify(JSON.stringify(model.data), hex2buf(model.signature), hex2buf(model.owner))
}, "data doesn't match signature")

export default OwnerOnly
