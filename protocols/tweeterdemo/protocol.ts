import { Operation, Post, Like, Retweet, Reply, Meta } from './interfaces'
import _ from 'lodash'
import { verifySignature } from '../../common/crypto'

export default async function Protocol(op: Operation, Core: any, Data: any) {
  if (!op?.type) throw new Error('UNKNOWN OP')
  switch (op.type) {
    case 'post': {
      const data: Post = op.data.data
      const meta: Meta = op.data.meta

      const is_valid = await verifySignature({
        public_key: meta.pubkey,
        signature: meta.signature,
        data: op.data.packet,
      })
      if (!is_valid) {
        console.log(is_valid)
        console.log('SIGNATURE ERROR')
        break
      }
      const exists = await Core.get(`posts!${data.tweet_id}`)
      if (exists) break

      await Core.put({
        key: 'posts!' + data.tweet_id,
        value: {
          ...data,
          username: data.username,
          tweet: data.tweet,
          likes: [],
          retweets: [],
          replies: [],
          ...meta
        },
      })
      const p = await Core.get(`posts!${data.tweet_id}`)
      if (!p) throw new Error('SAVE ERROR')
      break
    }
    case 'like': {
      const data: Like = op.data.data
      const meta: Meta = op.data.meta

      const is_valid = await verifySignature({
        public_key: meta.pubkey,
        signature: meta.signature,
        data: op.data.packet,
      })
      if (!is_valid) {
        console.log(is_valid)
        console.log('SIGNATURE ERROR')
        break
      }
      const orig_tweet = await Core.get('posts!' + data.tweet_id, { update: false })
      if (!orig_tweet) break
      if (
        _.find(orig_tweet.likes, (r) => {
          if (r[0] === data.username) return true
        })
      )
        break
      orig_tweet.likes.push([data.username, meta.pubkey, meta.signature])
      await Core.del('posts!' + data.tweet_id)
      await Core.put({ key: 'posts!' + data.tweet_id, value: orig_tweet })
      const p2 = await Core.get('posts!' + data.tweet_id, { update: false })
      if (!p2) throw new Error('SAVE ERROR')
      break
    }
    case 'retweet': {
      const data: Retweet = op.data.data
      const meta: Meta = op.data.meta

      const is_valid = await verifySignature({
        public_key: meta.pubkey,
        signature: meta.signature,
        data: op.data.packet,
      })
      if (!is_valid) {
        console.log(is_valid)
        console.log('SIGNATURE ERROR')
        break
      }

      // Add retweet to the original
      const orig_tweet = await Core.get('posts!' + data.retweet_id, { update: false })
      if (!orig_tweet) break
      if (
        _.find(orig_tweet.retweets, (r) => {
          if (r[0] === data.username) return true
        })
      )
        break
      orig_tweet.retweets.push([data.username, meta.pubkey, meta.signature, data.tweet_id])
      await Core.del('posts!' + orig_tweet.tweet_id)
      await Core.put({ key: 'posts!' + orig_tweet.tweet_id, value: orig_tweet })
      const orig_tweet_exists = await Core.get('posts!' + orig_tweet.tweet_id, { update: false })
      if (!orig_tweet_exists) throw new Error('ORIGINAL SAVE ERROR')

      // Post new retweet
      await Core.put({
        key: 'posts!' + data.tweet_id,
        value: {
          ...data,
          tweet: '',
          likes: [],
          retweets: [],
          replies: [],
        },
      })
      const retweet_exists = await Core.get(`posts!${data.tweet_id}`, { update: false })
      if (!retweet_exists) throw new Error('RETWEET SAVE ERROR')
      break
    }

    case 'reply': {
      const data: Reply = op.data.data
      const meta: Meta = op.data.meta

      const is_valid = await verifySignature({
        public_key: meta.pubkey,
        signature: meta.signature,
        data: op.data.packet,
      })
      if (!is_valid) {
        console.log(is_valid)
        console.log('SIGNATURE ERROR')
        break
      }

      // Add reply to the original
      const orig_tweet = await Core.get('posts!' + data.reply_to, { update: false })
      if (!orig_tweet) break
      orig_tweet.replies.push([data.username, meta.pubkey, meta.signature, data.tweet_id])
      await Core.del('posts!' + orig_tweet.tweet_id)
      await Core.put({ key: 'posts!' + orig_tweet.tweet_id, value: orig_tweet })
      const orig_tweet_exists = await Core.get('posts!' + orig_tweet.tweet_id, { update: false })
      if (!orig_tweet_exists) throw new Error('ORIGINAL SAVE ERROR')

      // Post new reply
      await Core.put({
        key: 'posts!' + data.tweet_id,
        value: {
          ...data,
          likes: [],
          retweets: [],
          replies: [],
        },
      })
      const reply_exists = await Core.get(`posts!${data.tweet_id}`, { update: false })
      if (!reply_exists) throw new Error('REPLY SAVE ERROR')
      break
    }
    default:
      throw new Error('UNKNOWN OP')
  }
}
