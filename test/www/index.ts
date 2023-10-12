//@ts-ignore
import Core from '../../core'
import Apps from '../../apps'
import User from '../../user'

const DataChannels = { Core, User, Apps }
window['DataChannels'] = DataChannels
console.log('DataChannels initiated')
export default DataChannels