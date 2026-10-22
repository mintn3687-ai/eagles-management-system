import 'server-only'
import { adminRepository } from './repository'

export const adminReadService = {
  listInvitableUsers: (where: Parameters<typeof adminRepository.invitableUsers>[0], page: number, pageSize: number) =>
    adminRepository.invitableUsers(where, (page - 1) * pageSize, pageSize + 1),
  auditCount: adminRepository.auditCount,
  auditPage: (where: Parameters<typeof adminRepository.auditPage>[0], page: number, pageSize: number) =>
    adminRepository.auditPage(where, (page - 1) * pageSize, pageSize),
  feeHistoryCount: adminRepository.feeHistoryCount,
  feeHistoryPage: (page: number, pageSize: number) => adminRepository.feeHistoryPage((page - 1) * pageSize, pageSize),
  teamCount: adminRepository.teamCount,
  teamPage: (page: number, pageSize: number) => adminRepository.teamPage((page - 1) * pageSize, pageSize),
  memberList: (where: Parameters<typeof adminRepository.memberList>[0], orderBy: Parameters<typeof adminRepository.memberList>[1], page: number, pageSize: number) =>
    adminRepository.memberList(where, orderBy, (page - 1) * pageSize, pageSize),
  paymentMemberOptions: (page: number, pageSize: number) => adminRepository.paymentMemberOptions((page - 1) * pageSize, pageSize),
  paymentLedger: (where: Parameters<typeof adminRepository.paymentLedger>[0], page: number, pageSize: number) =>
    adminRepository.paymentLedger(where, (page - 1) * pageSize, pageSize),
  paymentReceipt: adminRepository.paymentReceipt,
  analyticsMember: adminRepository.analyticsMember,
  rehearsal: adminRepository.rehearsal,
  activeMemberCount: adminRepository.activeMemberCount,
  activeMembersForRehearsal: (rehearsalId: string, page: number, pageSize: number) =>
    adminRepository.activeMembersForRehearsal(rehearsalId, (page - 1) * pageSize, pageSize),
  memberSubscriptionPayment: adminRepository.memberSubscriptionPayment,
}
