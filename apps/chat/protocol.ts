import { sha256 } from "../../common/crypto";

export interface Operation {
  type: 'post' | 'vote',
  data: string,
  user: string,
  hash?: string
  up?: boolean,
  down?: boolean
}

export default async function Protocol (op: Operation, Core: any, Data: any) {
  if (!op?.type) throw new Error('UNKNOWN OP')
  switch (op.type) {
    case 'post': {
      const hash = op.hash
      await Core.put({ key: 'posts!' + hash, value: { hash, votes: 0, data: op.data, user: op.user }})
      const p = await Core.get(`posts!${hash}`)
      break;
    }
    case 'vote': {
      const inc = op.up ? 1 : -1
      const p = await Core.get('posts!' + op.hash, { update: false })
      if (!p) break

      p.value.votes += inc
      await Core.del('posts!' + op.hash)
      await Core.put('posts!' + op.hash, p.value)
      break;
    }
    default:
      throw new Error('UNKNOWN OP')
  }
}