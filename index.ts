import User from './user'
import Core from './core'
import platform from 'platform-detect'

const Backbone = {
  User,
  Core,
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
export default Backbone
module.exports = Backbone
