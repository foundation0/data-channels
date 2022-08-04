import { Object } from './base'
const { Any } = require('./objectmodel')

const Operation = Object({
  type: String,
  data: Any,
})

export default Operation