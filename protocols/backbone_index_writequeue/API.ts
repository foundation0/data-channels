import { decodeCoreData } from "../../common"

export default async function API(Core, Protocol) {
  return {
    async all(stream?: boolean) {
      return Core.query({ lt: '~', stream })
    },
    async getStream(
      params: { gte?: string; lte?: string },
      opts?: { limit?: number; reverse?: boolean }
    ) {
      return await Core.query({ ...params, ...opts, stream: true })
    },
    async _read(key: string) {
      const value = await Core.get(key)
      return value || null
    },
    async readReceipt(key: string) {
      if(key.charAt(1) === '!') key = key.slice(2)
      return this._read(`r!${key}`)
    },
    async readRequest(key: string) {
      if(key.charAt(1) === '!') key = key.slice(2)
      return this._read(`w!${key}`)
    },
    async _write(params: { key: string; data: string }) {
      if (!params?.key || !params?.data) throw new Error('_WRITE REQUIRES BOTH KEY AND DATA')
      await Protocol({
        type: 'set',
        key: params.key,
        data: params.data,
      })
      return params.key.slice(2) // remove sub separator
    },
    async writeReceipt(params: { key: string; data: string }) {
      if(params.key.charAt(1) === '!') params.key = params.key.slice(2)
      return this._write({ ...params, key: `r!${params.key}` })
    },
    async writeRequest(params: { key: string; data: string }) {
      if(params.key.charAt(1) === '!') params.key = params.key.slice(2)
      return this._write({ ...params, key: `w!${params.key}` })
    },
  }
}
