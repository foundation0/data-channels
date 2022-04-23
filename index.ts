import Core from './core'
import platform from 'platform-detect'

if(platform.browser) window['Core'] = Core
export default Core
module.exports = Core