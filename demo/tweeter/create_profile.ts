import Core from '../../core'
import { CoreConfig } from '../../common/interfaces'
import default_config from '../../bbconfig'
import { createId, sha256, sign } from '../../common/crypto'
import fs from 'fs'
;(async () => {
  let seeds = ['jensen', 'aa', 'bb']
  seeds.forEach(async (seed) => {
    // open core with seed
    const id = await createId(sha256(seed))
    // open/create profile Core
    const config: CoreConfig = {
      address: id.publicKey,
      encryption_key: default_config.keys.index,
      writers: [],
      indexes: [],
      private: false,
      storage: 'raf',
      protocol: 'keyvalue',
      storage_prefix: id.publicKey,
    }
    const profile_core = await Core(config)

    let profile = {
      username: '',
      display_name: '',
      avatar: Buffer.alloc(0),
      bio: '',
      followers: [],
      following: [],
      location: '',
      created_at: 0,
      tweets: [],
      likes: [],
      retweets: [],
    }
    // add mockup data
    switch (seed) {
      case 'jensen':
        profile = {
          username: 'jensenhertz',
          display_name: 'Jensen',
          avatar: fs.readFileSync('./profiles/jensen.jpg'),
          bio: 'Building self-sovereign metaverse',
          followers: [],
          following: [],
          location: '0.0.0.0',
          created_at: new Date().getDate(),
          tweets: [],
          likes: [],
          retweets: [],
        }
        break
      case 'bb':
        profile = {
          username: 'nicholasbartlett',
          display_name: 'Nicholas Bartlett',
          avatar: fs.readFileSync('./profiles/a.jpg'),
          bio: 'Compounding gains every day | #web3',
          followers: [],
          following: [],
          location: 'New York, NY',
          created_at: new Date().getDate(),
          tweets: [],
          likes: [],
          retweets: [],
        }
        break
      case 'aa':
        profile = {
          username: 'ashleighjam',
          display_name: 'Ash',
          avatar: fs.readFileSync('./profiles/b.jpg'),
          bio: 'Investor at FooBarCap, formerly not an investor. Not a financial advice.',
          followers: [],
          following: [],
          location: 'Dubai',
          created_at: new Date().getDate(),
          tweets: [],
          likes: [],
          retweets: [],
        }
        break

      default:
        break
    }
    console.log(profile)
    await profile_core.set({ key: 'username', value: profile.username })
    await profile_core.set({ key: 'display_name', value: profile.display_name })
    await profile_core.set({ key: 'avatar', value: profile.avatar })
    await profile_core.set({ key: 'bio', value: profile.bio })
    await profile_core.set({ key: 'followers', value: profile.followers })
    await profile_core.set({ key: 'following', value: profile.following })
    await profile_core.set({ key: 'location', value: profile.location })
    await profile_core.set({ key: 'created_at', value: profile.created_at })
    await profile_core.set({ key: 'tweets', value: profile.tweets })
    await profile_core.set({ key: 'likes', value: profile.likes })
    await profile_core.set({ key: 'retweets', value: profile.retweets })
    console.log(seed, await profile_core.get('username'))
  })
})()