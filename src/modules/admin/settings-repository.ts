import 'server-only'
import { prisma } from '@/lib/db'

export const settingsRepository = {
  getClubSettings: () => Promise.all([
    prisma.setting.findMany({
      where: { key: { in: ['clubName', 'attendanceThreshold', 'absenceDeadlineHours', 'graceDays', 'subscriptionBillingPeriod'] } },
      select: { key: true, value: true },
    }),
    prisma.feeSetting.findFirst({
      where: { type: 'SUBSCRIPTION', effectiveFrom: { lte: new Date() } },
      orderBy: [{ effectiveFrom: 'desc' }, { id: 'desc' }],
      select: { billingPeriod: true },
    }),
  ]),
}
