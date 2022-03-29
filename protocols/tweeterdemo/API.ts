import { decodeCoreData } from '../../common'
import { sha256 } from '../../common/crypto'
import { Post, Like, Retweet, Reply } from './interfaces'

export default async function API(Core, Protocol) {
  return {
    async all(stream?: boolean) {
      const posts = await Core.query({ gte: 'posts!', lte: 'posts!~', stream })
      return posts
    },
    async post(opts: { data: { tweet: string; username: string }, meta: { signature: string, pubkey: string }}) {
      const timestamp = new Date().getTime()
      const data: Post = {
        timestamp,
        tweet_id: sha256(timestamp + opts.data.username + opts.data.tweet),
        ...opts.data
      }
      await Protocol({
        type: 'post',
        data: { data, meta: opts.meta, packet: opts.data },
      })
    },
    async like(opts: { data: { tweet_id: string; username: string }, meta: { signature: string, pubkey: string }}) {
      const data: Like = opts.data
      await Protocol({
        type: 'like',
        data: { data, meta: opts.meta, packet: opts.data },
      })
    },
    async retweet(opts: { data: {retweet_id: string; username: string}, meta: { signature: string, pubkey: string } }) {
      const timestamp = new Date().getTime()
      const data: Retweet = {
        timestamp,
        tweet_id: sha256(timestamp + opts.data.username + opts.data.retweet_id),
        tweet: '',
        ...opts.data
      }
      await Protocol({
        type: 'retweet',
        data: { data, meta: opts.meta, packet: opts.data },
      })
    },
    async reply(opts: { data: {reply_to: string, tweet: string; username: string}, meta: { signature: string, pubkey: string } }) {
      const timestamp = new Date().getTime()
      const data: Reply = {
        timestamp,
        tweet_id: sha256(timestamp + opts.data.username + opts.data.reply_to),
        ...opts.data
      }
      await Protocol({
        type: 'reply',
        data: { data, meta: opts.meta, packet: opts.data }
      })
    },
  }
}
