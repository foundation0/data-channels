import { Array } from './base'
import om from 'objectmodel'
const { Any } = om
import { createHash } from '@foundation0/crypto'
import b4a from 'b4a'

const AppendOnly = function (model) {
  let size = 0
  let hash
  return Array(model)
    .assert((data) => {
      if (!data) return true
      const new_size = data.length
      if (new_size >= size) {
        size = new_size
        return true
      } else return false
    }, 'array smaller than previously')
    .assert((data) => {
      if (!data) return true
      if (!hash) {
        // if hash doesn't exist, this should be "initialization"
        hash = createHash(data)
        return true
      }
      const d = [...data.values()]
      const s = d.slice(0, size - 1)
      const history_hash = createHash(s)
      if (s.length === 0 || b4a.equals(hash, history_hash)) {
        hash = createHash(data)
        return true
      } else return false
    })
}
export default AppendOnly
