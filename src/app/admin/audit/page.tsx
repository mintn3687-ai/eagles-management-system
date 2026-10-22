import Link from 'next/link'
import { prisma } from '@/lib/db'
import { requireRole } from '@/lib/permissions'
import { auditFilterSchema } from '@/lib/validation/admin'
import { formatNairobiDate, parseNairobiDate } from '@/lib/dates'

const PAGE_SIZE = 25
type Params = Record<string, string | string[] | undefined>

export default async function AuditPage({ searchParams }: { searchParams: Promise<Params> }) {
  await requireRole('COMMITTEE')
  const parsed = auditFilterSchema.safeParse(await searchParams)
  if (!parsed.success) return <section className="card space-y-3"><h1>Check the audit filters</h1><p className="text-slate-600">Use valid dates and try again.</p><Link className="btn-primary" href="/admin/audit">Reset filters</Link></section>
  const filters = parsed.data
  const actionPrefix = filters.q.toUpperCase().replaceAll(' ', '_')
  const createdAt = filters.from || filters.to ? {
    ...(filters.from ? { gte: parseNairobiDate(filters.from) } : {}),
    ...(filters.to ? { lt: new Date(parseNairobiDate(filters.to).getTime() + 86400000) } : {}),
  } : undefined
  const where = {
    ...(createdAt ? { createdAt } : {}),
    ...(filters.q ? { OR: [
      { action: { startsWith: actionPrefix } },
      { entity: { startsWith: filters.q } },
      { entityId: { startsWith: filters.q } },
      { actor: { is: { name: { startsWith: filters.q } } } },
      { actor: { is: { email: { startsWith: filters.q } } } },
    ] } : {}),
  }
  const total = await prisma.auditLog.count({ where })
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const page = Math.min(filters.page, pageCount)
  const records = await prisma.auditLog.findMany({ where, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], skip: (page - 1) * PAGE_SIZE, take: PAGE_SIZE,
    select: { id: true, action: true, entity: true, entityId: true, details: true, createdAt: true, actor: { select: { name: true, email: true } } } })
  const href = (nextPage: number) => `/admin/audit?${new URLSearchParams({ q: filters.q, from: filters.from, to: filters.to, page: String(nextPage) })}`
  return <div className="space-y-6">
    <div><h1>Audit log</h1><p className="text-slate-600">Review who changed club records, what changed, and when.</p></div>
    <form method="GET" className="card grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <div className="sm:col-span-2"><label className="label" htmlFor="q">Search a name, email, action, or record ID prefix</label><input className="input" id="q" name="q" maxLength={100} defaultValue={filters.q} /></div>
      <div><label className="label" htmlFor="from">From date</label><input className="input" id="from" name="from" type="date" defaultValue={filters.from} /></div>
      <div><label className="label" htmlFor="to">To date</label><input className="input" id="to" name="to" type="date" defaultValue={filters.to} /></div>
      <div className="flex gap-2 sm:col-span-2 lg:col-span-4"><button className="btn-primary" type="submit">Search log</button><Link className="btn-secondary" href="/admin/audit">Reset</Link></div>
    </form>
    <section className="space-y-3">
      {records.map((record) => <article className="card space-y-2" key={record.id}>
        <div className="flex flex-wrap items-start justify-between gap-2"><div><h2 className="text-lg">{record.action.replaceAll('_', ' ')}</h2><p className="text-sm text-slate-600">{record.actor.name} · {record.actor.email}</p></div><time className="text-sm text-slate-600" dateTime={record.createdAt.toISOString()}>{formatNairobiDate(record.createdAt, true)}</time></div>
        <p className="text-sm">{record.entity} · {record.entityId}</p><details><summary className="min-h-11 cursor-pointer font-medium">Change details</summary><pre className="overflow-x-auto whitespace-pre-wrap break-words rounded-lg bg-stone-50 p-3 text-xs">{JSON.stringify(record.details, null, 2)}</pre></details>
      </article>)}
      {!records.length && <div className="card"><p className="text-slate-600">No audit entries match these filters.</p></div>}
    </section>
    <p className="text-sm text-slate-500">{total} entries · Page {page} of {pageCount}</p>
    <nav className="flex gap-3" aria-label="Audit pages">{page > 1 && <Link className="btn-secondary" href={href(page - 1)}>Previous</Link>}{page * PAGE_SIZE < total && <Link className="btn-secondary" href={href(page + 1)}>Next</Link>}</nav>
  </div>
}
