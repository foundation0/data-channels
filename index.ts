import b4a from "b4a"
if(globalThis) globalThis.Buffer = b4a
import User from './user'
import Core from './core'
import * as Crypto from '@backbonedao/crypto'
import Models from './models'
const Backbone = {
  User,
  Core,
  Crypto,
  Models
}

// module.exports = { User, Core, Crypto, Models }
export default Backbone
