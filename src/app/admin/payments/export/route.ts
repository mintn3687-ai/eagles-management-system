import { formatNairobiDate } from '@/lib/dates'
import { paymentWhere } from '@/lib/payments-query'
import { requireRole } from '@/lib/permissions'
import { paymentListSchema } from '@/lib/validation/fees'
import { adminExportRepository } from '@/modules/admin/export-repository'

const columns = ['Receipt number', 'Member', 'Type', 'Event', 'Status', 'Method', 'Source', 'Amount (KES)', 'Date', 'Reference', 'M-Pesa receipt']
const encoder = new TextEncoder()

function csvCell(value: string | number) {
  let text = String(value)
  if (/^[\t\r ]*[=+\-@]/.test(text)) text = `'${text}`
  return `"${text.replaceAll('"', '""')}"`
}

export async function GET(request: Request) {
  await requireRole('COMMITTEE')
  const params = Object.fromEntries(new URL(request.url).searchParams)
  const parsed = paymentListSchema.safeParse(params)
  if (!parsed.success) return new Response('Invalid export filters.', { status: 400 })
  const where = paymentWhere(parsed.data)

  const body = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        controller.enqueue(encoder.encode(`${columns.map(csvCell).join(',')}\r\n`))
        let skip = 0
        const take = 250
        while (true) {
          const payments = await adminExportRepository.paymentCsvPage(where, skip, take)
          for (const payment of payments) {
            const row = [
              payment.id,
              payment.member.fullName,
              payment.type,
              payment.paymentEvent?.title ?? '',
              payment.status,
              payment.method,
              payment.source,
              payment.amount,
              formatNairobiDate(payment.paidAt ?? payment.createdAt),
              payment.reference ?? '',
              payment.mpesaReceipt ?? '',
            ]
            controller.enqueue(encoder.encode(`${row.map(csvCell).join(',')}\r\n`))
          }
          if (payments.length < take) break
          skip += take
        }
        controller.close()
      } catch (error) {
        controller.error(error)
      }
    },
  })

  return new Response(body, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="eagles-drama-payments.csv"',
      'Cache-Control': 'no-store',
    },
  })
}
