import { ObjectModel, Any } from './base'
import { verify, hex2buf } from '@backbonedao/crypto'

const OwnerOnly = ObjectModel({
  owner: String,
  signature: String,
  data: Any,
}).assert((model) => {
  // check if signature matches data
  return verify(JSON.stringify(model.data), hex2buf(model.signature), hex2buf(model.owner))
}, "data doesn't match signature")

export default OwnerOnly
