import Link from 'next/link'
import { pageUser } from '@/lib/page-access'
import { prisma } from '@/lib/db'
import { memberListSchema, memberStatuses } from '@/lib/validation/members'
import { memberWhere, memberOrder, memberQueryString } from '@/lib/members/query'
import { formatNairobiDate } from '@/lib/dates'

export default async function MembersPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await pageUser('COMMITTEE')
  const parsed = memberListSchema.safeParse(await searchParams)
  if (!parsed.success) return <section className="card"><h1>Invalid filters</h1><Link className="btn-primary" href="/admin/members">Reset member list</Link></section>
  const filters = parsed.data
  const where = memberWhere(filters)
  const [members, total] = await prisma.$transaction([
    prisma.member.findMany({ where, orderBy: memberOrder(filters), skip: (filters.page - 1) * 20, take: 20,
      select: { id: true, fullName: true, phone: true, email: true, status: true, joinedAt: true } }),
    prisma.member.count({ where }),
  ])
  return <div className="space-y-6"><div><h1>Member register</h1><div className="flex flex-wrap gap-3"><Link className="btn-primary" href="/admin/members/new">Add member</Link><Link className="btn-secondary" href="/admin/members/import">Import CSV</Link><a className="btn-secondary" href={`/admin/members/export?${memberQueryString(filters)}`}>Export filtered CSV</a></div></div>
    <form className="card grid gap-4 sm:grid-cols-2" method="GET"><div className="sm:col-span-2"><label className="label" htmlFor="q">Search name, phone or email</label><input className="input" id="q" name="q" maxLength={100} defaultValue={filters.q} /></div><div><label className="label" htmlFor="status">Status</label><select className="input" name="status" id="status" defaultValue={filters.status}><option value="">All statuses</option>{memberStatuses.map((s) => <option key={s} value={s}>{s.replaceAll('_', ' ')}</option>)}</select></div><div><label className="label" htmlFor="sort">Sort by</label><select className="input" name="sort" id="sort" defaultValue={filters.sort}><option value="name">Name</option><option value="joined">Join date</option></select></div><div><label className="label" htmlFor="direction">Order</label><select className="input" name="direction" id="direction" defaultValue={filters.direction}><option value="asc">Ascending</option><option value="desc">Descending</option></select></div><button className="btn-primary self-end" type="submit">Apply filters</button></form>
    <p>{total} {total === 1 ? 'member' : 'members'} found · Page {filters.page} of {Math.max(1, Math.ceil(total / 20))}</p>
    <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white"><table className="w-full min-w-[680px] text-left text-sm"><caption className="sr-only">Club members, 20 per page</caption><thead className="bg-stone-100"><tr>{['Member', 'Contact', 'Status', 'Joined'].map((h) => <th className="p-4" key={h}>{h}</th>)}</tr></thead><tbody>{members.map((m) => <tr className="border-t border-slate-200" key={m.id}><td className="p-4"><Link className="inline-flex min-h-12 items-center font-semibold text-emerald-900 underline" href={`/admin/members/${m.id}`}>{m.fullName}</Link></td><td className="p-4"><span className="block">{m.phone}</span><span>{m.email}</span></td><td className="p-4">{m.status.replaceAll('_', ' ')}</td><td className="whitespace-nowrap p-4">{formatNairobiDate(m.joinedAt)}</td></tr>)}{!members.length && <tr><td className="p-6" colSpan={4}>No members match these filters.</td></tr>}</tbody></table></div>
    <nav className="flex gap-3" aria-label="Member pages">{filters.page > 1 && <Link className="btn-secondary" href={`/admin/members?${memberQueryString(filters, filters.page - 1)}`}>Previous</Link>}{filters.page * 20 < total && <Link className="btn-secondary" href={`/admin/members?${memberQueryString(filters, filters.page + 1)}`}>Next</Link>}</nav>
  </div>
}
