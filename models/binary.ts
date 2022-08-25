const { BasicModel, Any } = require('./objectmodel')
const b4a = require('b4a')

export default BasicModel(Any).assert(data => b4a.isBuffer(data))