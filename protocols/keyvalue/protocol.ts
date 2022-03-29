export interface Operation {
  type: 'set' | 'del'
  value: string
  key: string
}

export default async function Protocol(op: Operation, Core: any, Data: any) {
  if (typeof op !== 'object' || !op?.type) throw new Error('UNKNOWN OP')
  switch (op.type) {
    case 'set': {
      await Core.put({ key: op.key, value: op.value })
      break
    }
    case 'del': {
      const p = await Core.get(op.key, { update: false })
      if (!p) break

      await Core.del(op.key)
      break
    }
    default:
      throw new Error('UNKNOWN OP')
  }
}
