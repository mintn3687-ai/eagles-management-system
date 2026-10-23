import 'server-only'
import { productionsRepository } from './repository'

export async function listProductions() {
  return productionsRepository.listProductions()
}

export async function getProductionDetail(productionId: string) {
  return productionsRepository.productionDetail(productionId)
}

export async function listCurrentActiveMembers() {
  return productionsRepository.activeMembers()
}

export async function listAssets() {
  return productionsRepository.listAssets()
}

export async function listAvailableRehearsals() {
  return productionsRepository.availableRehearsals()
}

export async function listMemberCallSheets(memberId: string) {
  return productionsRepository.memberCallSheets(memberId)
}
