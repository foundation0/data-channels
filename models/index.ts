import * as Commons from './common'
import Base from './base'
import AppendOnly from './append_only'
import OwnerOnly from './owner_only'
import Operation from './operation'
import Binary from './binary'
import { error } from '../common'

function create(
  model: Object | String,
  opts?: {
    disable_owneronly?: boolean
    _debug?: { app_version: string; meta?: { signature: string; id: string } }
  },
  migrations?,
) {
  return async (data) => {
    const m = await Base(model, opts, migrations)
    if(typeof m === 'function') return m(data)
    else return error('error in creating data model')
  }
}

export default create
export { Commons, AppendOnly, OwnerOnly, Operation, Binary, create as DataModel }
