import { createCache, emit, error, hash, subscribe } from '../../common'
import lexint from 'lexicographic-integer'
import { v4 } from 'uuid'

export interface Operation {
  type: 'set' | 'setIndex' | 'del'
  data: string
  key: string
}

const WriteRequestsCache = createCache({ ttlsec: 60 })
const IndexCache = createCache({ ttlsec: 60 })

export default async function Protocol (op: Operation, Core: any, Data: any) {
  if (!op?.type) throw new Error('UNKNOWN OP')
  switch (op.type) {
    case 'set': {
      await Core.put({ key: op.key, value: op.data })
      break
    }
    case 'setIndex': {
      // TODO: add validation that the writer is a valid writer
      // should be as easy as checking whether "official" writer
      // sources contain the public key and then verify the signature

      // ignore all writes that try to replace keys, not allowed
      if (await IndexCache.get(op.key)) break
      const item = await Core.get(op.key, { update: false })
      if (item) {
        // you could report the peer here for guardians for extra scrutiny
        // because the peer is potentially trying to falsify data
        error('DUPLICATE ITEM WRITE', op) // TODO: Add writer to indexFunc arguments
        break
      }
      // check write request matches writequeue receipt
      let data
      if (typeof op.data === 'object') data = op.data
      else data = JSON.parse(op.data)
      let write_request = JSON.parse(JSON.stringify(data))
      write_request._data.__.writer = {
        public_key: '',
        signature: '',
      }
      delete write_request.meta.nonce
      const id = hash({ type: 'ripemd160', data: JSON.stringify(write_request) })
      const write_value: number = data._data.payment.tx?.value
        ? Math.floor(data._data.payment.tx.value * 1000) // 4 decimals
        : 0
      const wq_key = `${lexint.pack(write_value, 'hex')}!${id}`

      // This tries to query write requests for 30 seconds which should be plenty.
      // Not sure about this in very large scale though...
      async function checkWriteRequests(wq_key: string, round: number = 0) {
        return new Promise((resolve, reject) => {
          const rid = v4()
          const failsafe = setTimeout(() => {
            reject('timeout')
          }, 15000)
          const sub = subscribe({
            ch: `wq-${rid}`,
            cb: (write_request) => {
              clearTimeout(failsafe)
              sub.off(`wq-${rid}`, () => {})
              resolve(write_request ? true : false)
            },
          })
          emit({ ch: 'wq/readRequest', msg: `${rid}|${wq_key}`, no_log: true })
        })
      }

      let is_valid: any = false
      if (await WriteRequestsCache.get(wq_key)) is_valid = await WriteRequestsCache.get(wq_key)
      else is_valid = await checkWriteRequests(wq_key)
      if (!is_valid) {
        // write request can't be found
        // this means that either the network hasn't catched up or
        // someone is trying to bypass write request queue, not cool
        error('WRITE REQUEST NOT FOUND', op)
        break
      }
      await Core.put({ key: op.key, value: op.data })
      break
    }
    default:
      throw new Error('UNKNOWN OP')
  }
}