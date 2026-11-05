import 'server-only'
import { getGraceDays } from '@/lib/fees'
import { nairobiDateKey, nairobiMonthBounds, parseNairobiDate } from '@/lib/dates'
import { dashboardRepository } from './dashboard-repository'

const OVERDUE_PAGE_SIZE = 12

export async function getDashboardData(requestedOverduePage = 1) {
  const todayStart = parseNairobiDate(nairobiDateKey())
  const { start, end } = nairobiMonthBounds()
  const [stats, graceDays] = await Promise.all([
    dashboardRepository.stats(todayStart, start, end),
    getGraceDays(),
  ])
  const [membersByStatus, nextRehearsal, pendingAbsences, paymentTotals] = stats
  const cutoff = new Date(Date.now() - graceDays * 86400000)
  const [{ count }] = await dashboardRepository.overdueCount(cutoff)
  const overduePageCount = Math.max(1, Math.ceil(count / OVERDUE_PAGE_SIZE))
  const overduePage = Math.min(requestedOverduePage, overduePageCount)
  const overdueSubscriptions = await dashboardRepository.overduePage(cutoff, (overduePage - 1) * OVERDUE_PAGE_SIZE)
  const totals = {
    REGISTRATION: { amount: 0, count: 0 },
    SUBSCRIPTION: { amount: 0, count: 0 },
    RETREAT_BONDING: { amount: 0, count: 0 },
  }
  for (const row of paymentTotals) {
    totals[row.type] = { amount: row._sum.amount ?? 0, count: row._count._all }
  }
  return { membersByStatus, nextRehearsal, pendingAbsences, totals, overdueSubscriptions, overdueTotal: count, overduePage, overduePageCount }
}
