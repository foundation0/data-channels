import Core from '../../core'
import { CoreConfig } from '../../common/interfaces'
import default_config from '../../bbconfig'
import express from 'express'
import bodyParser from 'body-parser'
import cors from 'cors'
import { createId, sha256, sign } from '../../common/crypto'

const app = express()
app.use(cors())
app.use(bodyParser.json())

async function openProfileCore(opts: {
  pubkey: string
  storage_prefix?: string
  connect?: boolean
  writer_key?: string,
  storage?: 'ram' | 'ram'
}) {
  const config: CoreConfig = {
    address: opts.pubkey,
    encryption_key: default_config.keys.index,
    writers: [],
    indexes: [],
    private: false,
    storage: opts.storage || 'raf',
    protocol: 'keyvalue',
    storage_prefix: opts.storage_prefix || '' + opts.pubkey,
  }
  const profile_core = await Core(config)
  if (opts.writer_key) await profile_core.addWriter({ key: opts.writer_key })
  await profile_core.connect(true)
  // collect profile data from Core
  const profile = {
    pubkey: opts.pubkey,
    username: (await profile_core.get('username')) || '',
    display_name: (await profile_core.get('display_name')) || '',
    avatar: (await profile_core.get('avatar')) || '',
    bio: (await profile_core.get('bio')) || '',
    followers: (await profile_core.get('followers')) || [],
    following: (await profile_core.get('following')) || [],
    location: (await profile_core.get('location')) || '',
    created_at: (await profile_core.get('created_at')) || '',
    tweets: (await profile_core.get('tweets')) || [],
    likes: (await profile_core.get('likes')) || [],
    retweets: (await profile_core.get('retweets')) || [],
  }

  if (Buffer.isBuffer(profile.avatar))
    profile.avatar = `data:image/jpg;base64,${profile.avatar.toString('base64')}`
  return { profile, profile_core }
}

export async function main(conf?: any) {
  const [writers, indexes] = process.argv[3]
    ? [[process.argv[3].split('/')[0]], [process.argv[3].split('/')[1]]]
    : [[], []]

  const config: CoreConfig = {
    address: 'backbone-demo-chat',
    encryption_key: default_config.keys.index,
    writers,
    indexes,
    private: false,
    storage: 'ram',
    protocol: 'tweeterdemo',
    storage_prefix: 'backbone-demo-chat',
    ...conf,
  }
  const core = await Core(config)
  await core.connect()
  console.log(`LOG=1 ts-node demo/tweeter/B.ts 9001`) //${core.getWriterKey()}/${core.getIndexKey()} 900`)

  Object.keys(core).forEach((method) => {
    app.post(`/${method}`, async (req, res) => {
      console.log('REQ:', method, req.body || null)

      const r = await core[method](req.body && Object.keys(req.body).length > 0 ? req.body : null)
      res.send(r || {}).end()
    })
  })
  app.post('/auth', async (req, res) => {
    console.log('REQ: auth', req.body)
    const id = await createId(sha256(req.body.seed))
    const { profile } = await openProfileCore({ pubkey: id.publicKey, connect: true })
    res.json(profile)
  })
  app.post('/sign', async (req, res) => {
    console.log('REQ: sign', req.body)
    const id = await createId(sha256(req.body.seed))
    // send back profile and pubkey
    const signature = await sign({ id, data: req.body.packet })
    req.body.packet.signature = signature
    req.body.packet.public_key = id.publicKey
  })
  app.post('/open-profile', async (req, res) => {
    console.log('REQ: open', req.body)
    // connect to backbone://req.body.pubkey
    const { profile } = await openProfileCore({
      pubkey: req.body.pubkey,
      storage_prefix: 'demo-',
      connect: true,
      storage: 'ram',
      // writer_key: req.body.wk,
    })
    res.json(profile)
  })
  app.listen(process.argv[2] || 9000)
}
