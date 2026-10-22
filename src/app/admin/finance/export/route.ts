import { AccessError, requirePermission } from '@/lib/permissions'
import { getFinancialReport } from '@/modules/finance/operations-service'
import { financeReportSchema } from '@/modules/finance/operations-schema'

function csv(value: string | number) {
  let text = String(value)
  if (/^[\s]*[=+\-@]/.test(text)) text = `'${text}`
  return `"${text.replaceAll('"', '""')}"`
}

export async function GET(request: Request) {
  try {
    await requirePermission('finance:manage')
  } catch (error) {
    if (!(error instanceof AccessError)) throw error
    return new Response('Finance access is required.', {
      status: error.status, headers: { 'Cache-Control': 'no-store' },
    })
  }
  const params = new URL(request.url).searchParams
  const filters = financeReportSchema.safeParse({
    seasonId: params.get('seasonId') ?? '',
    productionId: params.get('productionId') ?? '',
  })
  if (!filters.success) return new Response('Invalid report filters.', { status: 400 })
  const rows = await getFinancialReport(filters.data.seasonId, filters.data.productionId)
  const body = [
    ['Date (UTC)', 'Direction', 'Category', 'Amount (KES)', 'Description', 'Reference'].map(csv).join(','),
    ...rows.map((row) => [
      row.date.toISOString(), row.direction, row.category, row.amount, row.description, row.reference,
    ].map(csv).join(',')),
  ].join('\r\n')
  return new Response(`\uFEFF${body}`, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="eagles-finance-report.csv"',
      'Cache-Control': 'no-store',
    },
  })
}
