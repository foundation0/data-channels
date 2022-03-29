export interface Operation {
  type: 'post' | 'like' | 'retweet' | 'reply'
  data: any // can we do options here?
}

export interface Post {
  tweet_id: string
  timestamp: number
  tweet: string
  username: string
}

export interface Like {
  tweet_id: string
  username: string
}

export interface Retweet extends Post {
  retweet_id: string
}

export interface Reply extends Post {
  reply_to: string
}

export interface Meta {
  signature: string
  pubkey: string
}
