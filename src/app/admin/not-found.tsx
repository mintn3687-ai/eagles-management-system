import Link from 'next/link'

export default function AdminNotFound() {
  return <section className="card space-y-4"><h1>Committee page not found</h1><p className="text-slate-600">That page or record is not available.</p><Link className="btn-primary" href="/admin">Return to dashboard</Link></section>
}
