import om from 'objectmodel'
const { BasicModel, Any } = om
const b4a = require('b4a')

export default BasicModel(Any).assert(data => b4a.isBuffer(data))