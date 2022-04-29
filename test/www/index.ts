//@ts-ignore
import Core from '../../core'
import Apps from '../../apps'
import User from '../../user'

const Backbone = { Core, User, Apps }
window['Backbone'] = Backbone
console.log('Backbone initiated')
export default Backbone