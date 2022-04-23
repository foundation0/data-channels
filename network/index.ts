// import net from 'net'
import { createCache, emit, log, shuffle, sleep, unique } from '../common'
import default_config from '../bbconfig'
import { ethers } from 'ethers'
import Swarm from '@backbonedao/network-node'

let network

export async function getSwarm(network_config) {
  if (!network) network = Swarm(network_config)
  return network
}



// export async function getExternalIP(){
//   return new Promise((resolve, reject) => {
//     const client = net.connect({port: 80, host:"backbonedao.com"}, () => {
//       const ip: string = client.localAddress || ''
//       resolve(ip)
//     });
//   });
// }