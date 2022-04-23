import { decodeCoreData } from '../../common'

export default async function API(Core, Protocol) {
  return {
    async all(stream?: boolean) {
      const items = await Core.query({ lt: '~' }, stream)
      return items
    },
    async get(key: string) {
      const value = await Core.get(key)
      return value || null
    },
    async del(key: string) {
      await Protocol({
        type: 'del',
        key,
      })
    },
    async set(params: { key: string; value: string }) {
      await Protocol({
        type: 'set',
        key: params.key,
        value: params.value
      })
    },
  }
}
