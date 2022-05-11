import * as Commons from './common'
import Base from './base'
import User from './user'
import AppendOnly from './append_only'
import OwnerOnly from './owner_only'
import Operation from './operation'

function create(core?) {
  return Base(core || null)
}

export default create
export { Commons, User, AppendOnly, OwnerOnly, Operation }