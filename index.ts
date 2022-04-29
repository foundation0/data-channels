import User from './user'
import Core from './core'
import platform from 'platform-detect'

const Backbone = {
  User,
  Core,
}

if (platform.browser) window['bb'] = Backbone
export default Backbone
module.exports = Backbone
