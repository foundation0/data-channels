export interface Operation {
  type: 'post' | 'vote'
  data: {
    data: string
    user: string
    hash?: string
    up?: boolean
    down?: boolean
  }
}

export default async function Protocol(op: Operation, Core: any) {
  if (!op?.type) throw new Error('UNKNOWN OP')
  switch (op.type) {
    case 'post': {
      const { hash, data, user } = op.data
      await Core.put({ key: 'posts!' + hash, value: { hash, votes: 0, data, user } })
      const p = await Core.get(`posts!${hash}`)
      break
    }
    case 'vote': {
      const { up, hash } = op.data
      const inc = up ? 1 : -1
      const p = await Core.get('posts!' + hash, { update: false })
      if (!p) break

      p.value.votes += inc
      await Core.del('posts!' + hash)
      await Core.put('posts!' + hash, p.value)
      break
    }
    default:
      throw new Error('UNKNOWN OP')
  }
}
