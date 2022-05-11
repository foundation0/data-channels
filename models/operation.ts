import { ObjectModel, Any } from './base'

const Operation = ObjectModel({
  type: String,
  data: Any,
})

export default Operation