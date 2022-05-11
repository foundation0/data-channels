import { decodeCoreData } from "../../common";
import { sha256 } from "../../common/crypto";

export default async function API(Core, Protocol) {
  return {
    async all(stream?: boolean) {
      const posts = await Core.query({ gte: 'posts!', lte: 'posts!~', stream })
      return posts
    },
    async post(data: { text: string, user: string }) {
      const hash = sha256(data.user + data.text)
      await Protocol({
        type: 'post',
        data: {
          hash,
          data: data.text,
          user: data.user,
        }
      })
    }
  }
}