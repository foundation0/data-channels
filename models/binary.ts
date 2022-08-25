import { BasicModel, Any } from 'objectmodel'
import b4a from 'b4a'

export default BasicModel(Any).assert(data => b4a.isBuffer(data))