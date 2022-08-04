import * as Commons from './common'
import Base from './base'
import AppendOnly from './append_only'
import OwnerOnly from './owner_only'
import Operation from './operation'
import Binary from './binary'

function create(
  data: Object | String,
  opts?: {
    disable_owneronly?: boolean
    _debug?: { app_version: string; meta?: { signature: string; id: string } }
  },
  migrations?,
) {
  return Base.apply(null, arguments)
}

export default create
export { Commons, AppendOnly, OwnerOnly, Operation, Binary, create as DataModel }
