import { rmSync } from 'fs'
import { getHomedir } from '../common'

export function cleanup() {
  rmSync(getHomedir(), { recursive: true, force: true })
}

