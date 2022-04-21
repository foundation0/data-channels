import { Buffer } from 'buffer/'
//@ts-ignore
window['Buffer'] = Buffer
import Core from './core'
import Apps from './apps'

window['Core'] = Core
window['Apps'] = Apps
console.log('Backbone initiated')
export default Core