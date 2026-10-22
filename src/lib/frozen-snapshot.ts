import { createHash } from 'node:crypto'

export type FrozenSnapshotRow = {
  id: string
  status: string
  roleInSeason: string
}

export function createFrozenSnapshot(rows: readonly FrozenSnapshotRow[]) {
  const canonical = [...rows]
    .sort((left, right) => left.id.localeCompare(right.id))
    .map(({ id, status, roleInSeason }) => [id, status, roleInSeason])
  return {
    count: canonical.length,
    hash: createHash('sha256').update(JSON.stringify(canonical)).digest('hex'),
  }
}
