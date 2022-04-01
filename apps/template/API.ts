export default async function API(Core, Protocol) {
  return {
    async get(key: string) {
      return await Core.get(key)
    },
    async del(key: string) {
      await Protocol({
        type: 'del',
        key,
      })
    },
    async set(params: { key: string; data: string }) {
      await Protocol({
        type: 'set',
        ...params,
      })
    },
  }
}
