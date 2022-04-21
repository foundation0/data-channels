#!/usr/bin/env node

const DHT = require('../common/network/dht')
const { Command, InvalidArgumentError } = require('commander')
const path = require('path')
const program = new Command()
const child_process = require('child_process')
const fs = require('fs')
const pkg = require('../package.json')
const { homedir } = require('os')

const getBootstrap = ({ address, port }) => ({ host: address, port })

async function bootstrap(ports) {
  if (!ports?.length) {
    ports = [50000, 50001, 50002] // [3480, 5228, 16400];
  }
  let [ephemeralPort, ...nonEphemeralPorts] = ports
  // bootstrap should be empty in order to have a fully private dht
  const bootstrapper1 = DHT.bootstrapper(ephemeralPort, { ephemeral: true, bootstrap: [] })

  await bootstrapper1.ready()

  const bootstraps = [getBootstrap(bootstrapper1.address())]

  for (const port of nonEphemeralPorts) {
    const bootstrapper = DHT.bootstrapper(port, {
      bootstrap: bootstraps,
      ephemeral: false,
    })
    await bootstrapper.ready()
    bootstraps.push(getBootstrap(bootstrapper.address()))
  }

  return bootstraps
}

const dirPath = `${homedir()}/.backbone`
if (!fs.existsSync(dirPath)) fs.mkdirSync(dirPath)
const statusPath = path.resolve(path.join(dirPath, './dht.json'))

const isActive = (pid) => {
  try {
    return process.kill(pid, 0)
  } catch (error) {
    return error.code === 'EPERM'
  }
}

const child = (exe, args, env) => {
  const child = child_process.spawn(exe, args, {
    detached: true,
    stdio: ['ignore', 'ignore', 'ignore'],
    env,
  })
  child.unref()
  return child
}

const daemon = () => {
  if (process.env.__daemon) {
    return process.pid
  }

  if (status.env.PID) {
    // kill previous daemon before starting a new one
    child('kill', ['-9', status.env.PID], process.env)
  }
  const args = [].concat(process.argv)
  const node = args.shift()
  const env = { __daemon: true, ...process.env }
  const { pid } = child(node, args, env)
  status.env.PID = pid
  status.env.active = true
  fs.writeFileSync(statusPath, JSON.stringify(status, undefined, 2))
}

function processPorts(port, ports) {
  if (!port.match(/^[0-9]+$/))
    throw new InvalidArgumentError('Some port(s) seem to contain non-numbers.')
  port = parseInt(port)
  if (isNaN(port)) throw new InvalidArgumentError('Some port(s) are not numbers.')

  return ports.concat([port])
}

program
  .version(pkg.version)
  .description(pkg.description)
  .addHelpText(
    'after',
    `
  Examples:
    $ node bootstrap.js  # for default ports
    $ node bootstrap.js --ports 49737 49738
    $ node bootstrap.js --ports 10001 10002 12234`
  )
  .option('-p, --ports [port...]', 'ports to listen on', processPorts, [])
  .option('-s, --status', 'displays status')
  .option('-k, --kill', 'kills currently active bootstrap node')
program.parse()

const options = program.opts()

let status = {
  ports: options.ports,
  env: { PID: null, active: false },
}

if (!fs.existsSync(statusPath)) {
  fs.writeFileSync(statusPath, JSON.stringify(status, undefined, 2))
} else {
  status = JSON.parse(fs.readFileSync(statusPath, { encoding: 'utf-8' }))
  status.env.active = isActive(status.env.PID)
}

if (options.kill) {
  if (status.env.active) {
    child('kill', ['-9', status.env.PID], process.env)
    console.log('Bootstrap nodes shutdown...')
  } // else console.log('Process not active');
}

if (options.status) {
  console.log(status)
}

if (options.ports.length & (options.ports.length < 2)) {
  throw new InvalidArgumentError('Please pass in at least 2 ports')
}

if (options.ports.length) {
  status.ports = options.ports
  fs.writeFileSync(statusPath, JSON.stringify(status, undefined, 2))
}

daemon() //starts the daemon
;(async () => {
  const bootstraps = await bootstrap(status.ports)

  status.ports = bootstraps.map((bootstrap) => bootstrap.port)
  fs.writeFileSync(statusPath, JSON.stringify(status, undefined, 2))

  console.log(
    `Bootstrap nodes listening on: ${bootstraps.map((b) => `${b.host}:${b.port}`).join(', ')}`
  )
  // for (const bootstrap of bootstraps) {
  //   console.log(`${bootstrap.host}:${bootstrap.port}`);
  // }
  // if we are in daemon mode don't kill process
  if (!process.env.__daemon) process.exit()
})()
