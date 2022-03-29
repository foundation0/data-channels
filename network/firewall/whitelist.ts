import { emit, registerMethods } from '../../common'

class WhitelistClass {
  whitelisted_ids = new Set()
  constructor(){
    this.firewall = this.firewall.bind(this)
    this.add = this.add.bind(this)
    this.remove = this.remove.bind(this)
  }
  firewall(connection_id: Buffer) {
    // return true to reject the connection
    const fail = !this.whitelisted_ids.has((connection_id as Buffer).toString('hex'))
    emit({
      ch: 'network',
      msg: `connection from ${(connection_id as Buffer).toString('hex')} - ${
        fail ? 'block' : 'pass'
      }`,
      verbose: true,
    })
    if (fail)
      emit({
        ch: 'network',
        msg: `firewall blocked connection from ${(connection_id as Buffer).toString('hex')}`,
      })
    return fail
  }
  
  add(connection_id: string) {
    this.whitelisted_ids.add(connection_id)
    emit({ ch: 'network', msg: `whitelisted connections from ${connection_id}`, verbose: true })
  }
  
  remove(connection_id: string) {
    this.whitelisted_ids.delete(connection_id)
    emit({ ch: 'network', msg: `removed ${connection_id} from whitelist`, verbose: true })
  }
}

export default async () => {
  const W = new WhitelistClass()
  const API = registerMethods({
    source: W,
    methods: [
      'firewall', 'add', 'remove'
    ],
  })
  return API
}
