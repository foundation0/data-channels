import platform from 'platform-detect'
import RAM from 'random-access-memory'
import RAI from 'random-access-idb'
import { homedir } from 'os'
import { CoreConfig } from '../common/interfaces'
import { getHomedir, log } from '../common'

export default function getStorage(bb_config: CoreConfig) {
  if (!bb_config) throw new Error('GETSTORAGE REQUIRES CORECONFIG')
  let storage: string | object

  if (bb_config?.storage === 'ram') {
    log('RAM storage requested, using memory for storage')
    storage = RAM
  } else if (bb_config?.env === 'node' || platform?.node) {
    log('Node runtime detected, using file system for storage')
    const prefix = bb_config?.storage_prefix ? `${bb_config?.storage_prefix}/` : ''
    if(prefix) log(`Using storage prefix: ${prefix}`)
    // split the path in chunks of two letters to avoid creating file explorer killing directories
    const pathname = bb_config.address.match(/.{1,2}/g)?.join('/')
    storage = process.env.TEST
      ? `${homedir()}/.backbone-test/${prefix}${pathname}`
      : `${getHomedir()}/${prefix}${pathname}`
  } else {
    log('Browser runtime detected, using RAI for storage')
    storage = RAI()
  }
  const storage_id: string = bb_config?.storage_prefix
    ? bb_config.address + bb_config.storage_prefix
    : bb_config.address
  return { storage, storage_id }
}