import User from './user'
import Core from './core'
import platform from 'platform-detect'
import * as Crypto from '@backbonedao/crypto'
const Backbone = {
  User,
  Core,
  Crypto
}

if (platform.browser) {
  window['bb'] = Backbone
  window.onerror = function (errMsg, url, line, column, error) {
    var result = !column ? '' : '\ncolumn: ' + column
    result += !error
    document.write('Error= ' + errMsg + '\nurl= ' + url + '\nline= ' + line + result)
    var suppressErrorAlert = true
    return suppressErrorAlert
  }
}

module.exports = { User, Core, Crypto }
export default Backbone
