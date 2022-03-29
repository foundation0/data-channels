import net from 'net'
import { createCache, emit, log, shuffle, sleep, unique } from '../common'
import default_config from '../bbconfig'
import { ethers } from 'ethers'
import Swarm from '../common/network/swarm'

const NodesRegistry = require('./abis/NodesRegistry.json')
let ContractCache

let network

export async function getSwarm(network_config) {
  if (!network) network = new Swarm(network_config)
  return network
}

async function _getProvider() {
  return new ethers.providers.AlchemyProvider(
    default_config.contracts.blockchain_id,
    default_config.contracts.alchemy_api_key
  )
}

export async function subscribeToPeerUpdates(params: { type: string; cb: Function }) {
  const provider = await _getProvider()
  const contract = new ethers.Contract(
    default_config.contracts.nodes_registry,
    NodesRegistry.abi,
    provider
  )

  contract.on('Set', (node_type: string, peer: string) => {
    emit({ ch: 'network', msg: `received Set event: ${node_type} ${peer}`, verbose: true })
    if (node_type === params.type) {
      const [status, cid, writer, index] = peer.split('|')
      params.cb({ op: 'add', status, cid, writer, index })
    }
  })

  contract.on('Remove', (node_type: string, peer: string) => {
    emit({ ch: 'network', msg: `received Remove event: ${node_type} ${peer}`, verbose: true })
    if (node_type === params.type) {
      const [status, cid, writer, index] = peer.split('|')
      params.cb({ op: 'remove', status, cid, writer, index })
    }
  })
}

export async function fetchPeersFromContract(type: string) {
  if (!ContractCache) ContractCache = createCache({ ttlsec: 60, capacity: 1000 })
  const provider = await _getProvider()
  const contract = new ethers.Contract(
    default_config.contracts.nodes_registry,
    NodesRegistry.abi,
    provider
  )
  async function query() {
    if (ContractCache.get('wait')) await sleep(1000)
    else ContractCache.put('wait', 1)
    if (ContractCache.get('nodes')) return ContractCache.get('nodes')
    try {
      emit({
        ch: 'network',
        msg: `querying nodes registry for writer peers (${default_config.contracts.nodes_registry})...`,
      })
      const nodes = await contract.getNodes(type)
      ContractCache.put('nodes', nodes)
      return nodes
    } catch (error) {
      console.log(error)
      emit({ ch: 'error', msg: 'blockchain query failed, trying again...' })
      await sleep(2000)
      return await query()
    }
  }
  const nodes = await query()
  const results: [{ cid: string; writer: string; index: string }] = nodes.map((n) => {
    const s = n.split('|')
    if (s.length !== 4) throw new Error(`invalid node data: ${n}`)
    return { status: s[0], cid: s[1], writer: s[2], index: s[3] }
  })
  return results
}

export async function fetchPeersFromETH(type: string) {
  const results: string[] = []
  return results
}

export async function fetchPeersFromCOM(type: string) {
  let results: string[] = []
  return results
}

export async function updateNetwork() {
  log('Refreshing network servers to connect...')
  // query network.backbonedao.eth TXT
  let network = default_config.network.bootstrap_servers.concat(await fetchPeersFromETH('network'))
  // query network.backbonedao.com TXT
  network = network.concat(await fetchPeersFromCOM('network'))
  // deduplicate, shuffle, randomly pick max 10
  network = unique(network)
  network = shuffle(network)
  return network.slice(0, 10)
}


export async function getExternalIP(){
  return new Promise((resolve, reject) => {
    const client = net.connect({port: 80, host:"backbonedao.com"}, () => {
      const ip: string = client.localAddress || ''
      resolve(ip)
    });
  });
}