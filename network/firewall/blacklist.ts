const blacklisted_addresses: string[] = []
export default function(pub, remotePayload, addr: string) {
  return blacklisted_addresses.indexOf(addr) !== -1
}