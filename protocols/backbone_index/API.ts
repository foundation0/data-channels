import { decodeCoreData, error } from '../../common'
import { IndexPayload, WriteRequestPayload } from '../../common/interfaces'

export default async function API(Core, Protocol) {
  return {
    async _query(params: {
      query: { lte: string, gte: string }
      addr_position?: number
      limit?: number
      stream?: boolean
    }) {
      if (!params?.limit || params?.limit > 100) params.limit = 100
      const s = await Core.query({ ...params.query, limit: params.limit, stream: true })
      if (params?.stream) return s
      const promises: any = []
      const self = this
      return new Promise((resolve, reject) => {
        const bundle: object[] = []
        s.on('data', (data) => {
          promises.push(
            new Promise(async (resolve, reject) => {
              const key = params?.addr_position
              ? data.key.split('!')[params.addr_position]
              : data.key
              const item = await self.readItem(key)
              if(!item) error(`missing item (key: ${data.key})`)
              else bundle.push(item)
              resolve(true)
            })
          )
        })
        s.on('end', async () => {
          await Promise.all(promises)
          resolve(bundle)
        })
        s.on('error', reject)
      })
    },
    async all(return_stream?: boolean) {
      return this._query({ query: { lte: '~' }, stream: return_stream })
    },
    async latest(params: { limit?: number; return_stream?: boolean }) {
      return this._query({
        query: { gte: 'i!', lte: 'i!~', reverse: true, limit: params?.limit || 100 },
        addr_position: 1,
        stream: params.return_stream,
      })
    },
    async _read(key: string) {
      const value = await Core.get(key)
      return value || null
    },
    async readItem(key: string) {
      return this._read(`i!${key}`)
    },
    async readOwner(key: string) {
      return this._read(`o!${key}`)
    },
    async readSchema(key: string) {
      return this._read(`s!${key}`)
    },
    async readPosition(key: string) {
      return this._read(`m!${key}`)
    },
    async readItemsByOwner(params: {
      owner: string
      reverse?: boolean
      limit?: number
      stream?: boolean
    }) {
      const q = {
        gte: `o!${params.owner}!`,
        lte: `o!${params.owner}!~`,
        reverse: params?.reverse || true,
      }
      return this._query({ ...params, addr_position: 2, query: q })
    },
    async readItemsBySchema(params: {
      schema: string
      reverse?: boolean
      limit?: number
      stream?: boolean
    }) {
      const q = {
        gte: `s!${params.schema}!`,
        lte: `s!${params.schema}!~`,
        reverse: params?.reverse || true,
      }
      return this._query({ ...params, addr_position: 4, query: q })
    },
    async _write(params: { key: string; data: WriteRequestPayload }) {
      if (!params?.key || !params?.data) throw new Error('_WRITE REQUIRES BOTH KEY AND DATA')
      await Protocol({
          type: 'set',
          key: params.key,
          data: params.data,
        }
      )
    },
    async writeItem(params: { key: string; data: IndexPayload }) {
      if (!params?.key || !params?.data) throw new Error('_WRITE REQUIRES BOTH KEY AND DATA')
      await Protocol({
          type: 'setIndex',
          key: `i!${params.key}`,
          data: params.data,
        }
      )
      return params.key
    },
    async writeOwner(params: { key: string; data: IndexPayload }) {
      return this._write({ ...params, key: `o!${params.key}` })
    },
    async writeSchema(params: { key: string; data: IndexPayload }) {
      return this._write({ ...params, key: `s!${params.key}` })
    },
    async writePosition(params: { key: string; data: IndexPayload }) {
      return this._write({ ...params, key: `m!${params.key}` })
    },
  }
}