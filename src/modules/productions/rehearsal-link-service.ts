import 'server-only'
import { writeAuditLog } from '@/lib/audit'
import { lockRow } from '@/lib/row-lock'
import { productionsRepository } from './repository'
import { ProductionServiceError } from './service'

export async function linkRehearsal(input: { productionId: string; rehearsalId: string }, actorId: string) {
  return productionsRepository.transaction(async (tx) => {
    await lockRow(tx, 'Rehearsal', input.rehearsalId)
    const rehearsal = await productionsRepository.findRehearsal(tx, input.rehearsalId)
    if (!rehearsal) throw new ProductionServiceError('Rehearsal not found.')
    if (rehearsal.status === 'CLOSED' || rehearsal.status === 'CANCELLED') {
      throw new ProductionServiceError('Closed or cancelled rehearsals cannot be linked to a production.')
    }
    const productionId = input.productionId || null
    if (productionId) {
      const production = await productionsRepository.findProduction(tx, productionId)
      if (!production) throw new ProductionServiceError('Production not found.')
      if (production.status === 'COMPLETED' || production.status === 'CANCELLED') {
        throw new ProductionServiceError('This production is closed to changes.')
      }
    }
    if (rehearsal.productionId && rehearsal.productionId !== productionId) {
      const production = await productionsRepository.findProduction(tx, rehearsal.productionId)
      if (!production || production.status === 'COMPLETED' || production.status === 'CANCELLED') {
        throw new ProductionServiceError('This production is closed to changes.')
      }
    }
    await productionsRepository.linkRehearsal(tx, input.rehearsalId, productionId)
    await writeAuditLog(tx, {
      actorId, action: 'REHEARSAL_PRODUCTION_LINK_CHANGED', entity: 'Rehearsal', entityId: input.rehearsalId,
      details: { fromProductionId: rehearsal.productionId, toProductionId: productionId },
    })
    return { productionId }
  })
}
