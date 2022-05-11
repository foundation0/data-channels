import { ObjectModel } from './base'

const User = ObjectModel({
  username: String,
  public_key: String,
})

export default User