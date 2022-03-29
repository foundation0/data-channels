export interface Operation {
  type: 'set' | 'del'
  data: string
  key: string
}

export default async function Protocol(
  op: Operation,
  Core: { get: Function; query: Function; put: Function; del: Function },
  Data: { get: Function, query: Function}
) {
  if (!op?.type) throw new Error('UNKNOWN OP')
  switch (op.type) {
    case 'set': {
      // ignore all writes that try to replace keys, not allowed
      const p = await Core.get(op.key)
      if (p) {
        // you could report the peer here for guardians for extra scrutiny
        // because the peer is potentially trying to falsify data
        break
      }
      await Core.put({ key: op.key, value: op.data })
      break
    }
    default:
      throw new Error('UNKNOWN OP')
  }
}
