import type { ProductionStatus, ProductionTaskStatus } from '@prisma/client'

export class ProductionRuleError extends Error {}

const taskTransitions: Record<ProductionTaskStatus, readonly ProductionTaskStatus[]> = {
  OPEN: ['IN_PROGRESS', 'COMPLETED', 'CANCELLED'],
  IN_PROGRESS: ['COMPLETED', 'CANCELLED'],
  COMPLETED: [],
  CANCELLED: [],
}

export function validateTaskTransition(from: ProductionTaskStatus, to: ProductionTaskStatus) {
  if (!taskTransitions[from].includes(to)) {
    throw new ProductionRuleError(from === to ? 'Task already has this status.' : 'A completed or cancelled task cannot be reopened.')
  }
}

export function validateAssetCheckout(status: 'AVAILABLE' | 'CHECKED_OUT' | 'RETIRED') {
  if (status !== 'AVAILABLE') throw new ProductionRuleError(status === 'RETIRED' ? 'A retired asset cannot be checked out.' : 'This asset is already checked out.')
}

export function validateAssetCheckin(status: 'AVAILABLE' | 'CHECKED_OUT' | 'RETIRED') {
  if (status !== 'CHECKED_OUT') throw new ProductionRuleError('Only a checked-out asset can be checked in.')
}

export function validateProductionTransition(from: ProductionStatus, to: ProductionStatus) {
  const allowed: Record<ProductionStatus, readonly ProductionStatus[]> = {
    PLANNING: ['ACTIVE', 'CANCELLED'],
    ACTIVE: ['COMPLETED', 'CANCELLED'],
    COMPLETED: [],
    CANCELLED: [],
  }
  if (!allowed[from].includes(to)) throw new ProductionRuleError('Production status can only move forward.')
}
