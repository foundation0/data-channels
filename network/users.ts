import { emit, error, getRandomInt } from "../common"
import b4a from 'b4a'
import { buf2hex, hex2buf } from '@backbonedao/crypto'

export async function addKnownUsers(this, params: { partition: 'data' | 'meta' }) {
  // If known users exists, add them
  const users = this.users_cache.users
  emit({
    ch: 'network',
    msg: `Adding ${
      Object.keys(users).filter((p) => users[p].partition === params.partition).length
    } known users for ${params.partition} partition`,
  })
  for (const key in users) {
    if (
      users[key]?.partition === params.partition &&
      key !== this.writer_key &&
      key !== this.meta_key
    ) {
      if (users[key].status === 'active' || users[key].status === 'frozen') {
        await this.addUser({
          key,
          skip_status_change: true,
          partition: users[key].partition,
        })
      }

      if (users[key].status === 'frozen') {
        // replace core with snapshot
        // NOTE: we are sort of trusting that core hasn't updated and eager isn't on
        switch (users[key].partition) {
          case 'data':
            const dataviewer_i = this.dataviewer.inputs.findIndex((core) =>
              b4a.equals(core.key, key)
            )
            if (dataviewer_i >= 0) {
              const snapshot = this.dataviewer.inputs[dataviewer_i].snapshot()
              await snapshot.ready()
              this.dataviewer._inputsByKey.set(key, snapshot)
            } else {
              return emit({ ch: 'error', msg: `couldn't snapshot dataviewer core ${key}` })
            }
            break
          case 'meta':
            const metaviewer_i = this.metaviewer.inputs.findIndex((core) =>
              b4a.equals(core.key, key)
            )
            if (metaviewer_i >= 0) {
              const snapshot = this.metaviewer.inputs[metaviewer_i].snapshot()
              await snapshot.ready()
              this.metaviewer._inputsByKey.set(key, snapshot)
            } else {
              return emit({ ch: 'error', msg: `couldn't snapshot metaviewer core ${key}` })
            }
            break
          default:
            error('unknown partition')
            break
        }
      }
    }
  }

  // Add trusted users (pre-computed views)
  const trusted_users = this.users_cache.trusted_users

  for (const key in trusted_users) {
    if (key !== this.writer_key) {
      if (trusted_users[key].status === 'active' || trusted_users[key].status === 'frozen') {
        await this.addTrustedUser({
          key,
          skip_status_change: true,
          partition: trusted_users[key].partition,
        })
      }

      if (trusted_users[key].status === 'frozen') {
        // replace core with snapshot
        // NOTE: we are sort of trusting that core hasn't updated and eager isn't on
        const dataviewer_i = this.dataviewer.outputs.findIndex((core) =>
          b4a.equals(core.key, key)
        )
        const metaviewer_i = this.metaviewer.outputs.findIndex((core) =>
          b4a.equals(core.key, key)
        )

        if (dataviewer_i >= 0) {
          const snapshot = this.dataviewer.outputs[dataviewer_i].snapshot()
          await snapshot.ready()
          this.dataviewer._outputsByKey.set(key, snapshot)
        } else {
          return emit({ ch: 'error', msg: `couldn't dataviewer snapshot core ${key}` })
        }

        if (metaviewer_i >= 0) {
          const snapshot = this.metaviewer.outputs[metaviewer_i].snapshot()
          await snapshot.ready()
          this.metaviewer._outputsByKey.set(key, snapshot)
        } else {
          return emit({ ch: 'error', msg: `couldn't metaviewer snapshot core ${key}` })
        }
      }
    }
  }
}

export async function addUser(
  this,
  opts: { key: string; partition: 'data' | 'meta'; skip_status_change?: boolean }
) {
  const { key, partition } = opts
  emit({
    ch: 'network',
    msg: `Trying to add user ${partition}/${key} to ${this.connection_id || 'n/a'}`,
    verbose: true,
  })

  if (key === (await this.writer_key) || key === (await this.meta_key)) return null
  const dataviewer_keys = this.dataviewer.inputs.map((core) => buf2hex(core.key))
  const metaviewer_keys = this.metaviewer.inputs.map((core) => buf2hex(core.key))

  if (dataviewer_keys.indexOf(key) != -1) return
  if (metaviewer_keys.indexOf(key) != -1) return
  if (!opts.skip_status_change)
    this._changeUserStatus({
      key,
      status: 'active',
      type: 'user',
      partition: opts.partition,
    })
  const k = b4a.from(key, 'hex')
  const c = await this.datamanager.get({
    key: k,
    publicKey: k,
    encryptionKey: this.encryption_key,
  })
  await c.ready()
  switch (partition) {
    case 'data':
      setTimeout(async () => {
        await this.dataviewer.addInput(c)
        // await this.datadb.update()
      }, getRandomInt(100, 300)) 
      break
    case 'meta':
      setTimeout(async () => {
        await this.metaviewer.addInput(c)
        // await this.datadb.update()
      }, getRandomInt(100, 300))
      break
    default:
      return error('partition not specified')
  }
  emit({
    ch: 'network',
    msg: `Added user ${partition}/${key} to ${this.connection_id || 'n/a'}`,
    //verbose: true,
  })
}

export async function removeUser(
  this,
  opts: { key: string; partition: 'data' | 'meta'; destroy?: boolean }
) {
  const { key, destroy, partition } = opts
  const k = b4a.from(key, 'hex')
  if (destroy) {
    const c = this.datamanager.get({ key: k, publicKey: k, encryptionKey: this.encryption_key })
    switch (partition) {
      case 'data':
        this.dataviewer.removeInput(c)
        break
      case 'meta':
        this.metaviewer.removeInput(c)
        break
      default:
        return error('partition not specified')
    }
  } else {
    // replace core with snapshot
    const core_i = this.dataviewer.inputs.findIndex((core) => b4a.equals(core.key, k))

    if (core_i >= 0) {
      const snapshot = this.dataviewer.inputs[core_i].snapshot()
      await snapshot.ready()
      this.dataviewer._inputsByKey.set(key, snapshot)
    } else {
      return emit({ ch: 'error', msg: `couldn't snapshot core ${key}` })
    }
  }
  // mark core as frozen or destroyed in the metadb
  await this._changeUserStatus({ key, status: destroy ? 'destroyed' : 'frozen', partition })

  emit({
    ch: 'network',
    msg: `removed user ${partition}/${key} from ${this.connection_id || 'n/a'}`,
  })
}

export async function addTrustedUser(
  this,
  opts: { key: string; partition: 'data' | 'meta'; skip_status_change?: boolean }
) {
  const { key, partition } = opts
  if (key === (await this.index_key)) return null
  if (!opts.skip_status_change)
    await this._changeUserStatus({ key, status: 'active', type: 'trusted_user', partition })

  const k = hex2buf(key)
  const c = this.datamanager.get({
    key: k,
    publicKey: k,
    encryptionKey: this.encryption_key,
  })
  switch (partition) {
    case 'data':
      this.dataviewer.addOutput(c)
      break
    case 'meta':
      this.metaviewer.addOutput(c)
    default:
      return error('unknown protocol')
  }
  emit({
    ch: 'network',
    msg: `added trusted user ${partition}/${key} to ${this.connection_id || 'n/a'}`,
  })
}

export async function removeTrustedUser(
  this,
  opts: { key: string; partition: 'data' | 'meta'; destroy?: boolean }
) {
  const { key, destroy, partition } = opts
  if (key === (await this.index_key)) return null
  const k = hex2buf(key)
  if (destroy) {
    // remove core from outputs (destroy history as well)
    const c = this.datamanager.get({ key: k, publicKey: k, encryptionKey: this.encryption_key })
    switch (partition) {
      case 'data':
        this.dataviewer.removeOutput(c)
        break
      case 'meta':
        this.metaviewer.removeOutput(c)
        break
      default:
        return error('unknown protocol')
    }
  } else {
    // replace core with snapshot
    switch (partition) {
      case 'data':
        const dataviewer_i = this.dataviewer.outputs.findIndex((core) => b4a.equals(core.key, k))

        if (dataviewer_i >= 0) {
          const snapshot = this.dataviewer.outputs[dataviewer_i].snapshot()
          await snapshot.ready()
          this.dataviewer._outputsByKey.set(key, snapshot)
          // mark core as frozen in the metadb
        } else {
          return emit({ ch: 'error', msg: `couldn't snapshot core ${key}` })
        }
        break
      case 'meta':
        const metaviewer_i = this.metaviewer.outputs.findIndex((core) => b4a.equals(core.key, k))

        if (metaviewer_i >= 0) {
          const snapshot = this.metaviewer.outputs[metaviewer_i].snapshot()
          await snapshot.ready()
          this.metaviewer._outputsByKey.set(key, snapshot)
          // mark core as frozen in the metadb
        } else {
          return emit({ ch: 'error', msg: `couldn't snapshot core ${partition}/${key}` })
        }
        break
      default:
        return error('unknown protocol')
    }
  }
  await this._changeUserStatus({ key, status: destroy ? 'destroyed' : 'frozen', partition })

  emit({
    ch: 'network',
    msg: `removed trusted user ${partition}/${key} from ${this.connection_id || 'n/a'}`,
  })
}