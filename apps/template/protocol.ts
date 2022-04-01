export interface Operation {
  type: 'set' | 'del',
  data: string,
  key: string,
}

export default async function Protocol (op: Operation, Core: any, Data: any) {
  if (!op?.type) throw new Error('UNKNOWN OP')
  switch (op.type) {
    case 'set': {
      await Core.put(op.key, op.data)
      break;
    }
    case 'del': {
      const p = await Core.get(op.key, { update: false })

      if (!p) break

      await Core.del(op.key)
      break;
    }
    default:
      throw new Error('UNKNOWN OP')
  }
}