import Link from 'next/link'
import { z } from 'zod'
import { pageUser } from '@/lib/page-access'
import { prisma } from '@/lib/db'
import { RolloverForm } from '@/components/admin/rollover-form'

const pageSchema = z.coerce.number().int().min(1).max(10000).catch(1)
const PAGE_SIZE = 50

export default async function SeasonRolloverPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  await pageUser('SUPER_ADMIN')
  const requestedPage = pageSchema.parse((await searchParams).page ?? '1')
  const total = await prisma.member.count({ where: { status: 'ACTIVE' } })
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const page = Math.min(requestedPage, pageCount)
  const members = await prisma.member.findMany({
      where: { status: 'ACTIVE' }, orderBy: [{ fullName: 'asc' }, { id: 'asc' }],
      skip: (page - 1) * PAGE_SIZE, take: PAGE_SIZE,
      select: { id: true, fullName: true, status: true, user: { select: { role: true } } },
    })
  return <div className="space-y-6">
    <div><p className="mb-2 text-sm font-semibold uppercase tracking-widest text-emerald-700">Super Admin</p><h1>Season rollover</h1><p className="text-slate-600">Select up to 50 active members on this page, then mark them inactive or alumni.</p></div>
    <RolloverForm members={members.map((member) => ({ ...member, isSuperAdmin: member.user?.role === 'SUPER_ADMIN' }))} />
    <p className="text-sm text-slate-500">Page {page} of {pageCount} · {total} active members</p>
    <nav className="flex gap-3" aria-label="Season rollover pages">{page > 1 && <Link className="btn-secondary" href={`/admin/rollover?page=${page - 1}`}>Previous</Link>}{page * PAGE_SIZE < total && <Link className="btn-secondary" href={`/admin/rollover?page=${page + 1}`}>Next</Link>}</nav>
  </div>
}
