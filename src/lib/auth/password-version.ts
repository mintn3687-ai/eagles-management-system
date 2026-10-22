import { createHash } from 'node:crypto'
export const passwordVersion = (hash: string) => createHash('sha256').update(hash).digest('hex')
