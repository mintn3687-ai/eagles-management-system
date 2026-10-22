'use client'
import Link from 'next/link'

export default function AdminError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <section className="card space-y-4" role="alert">
    <h1>We could not load this committee page</h1>
    <p className="text-slate-600">Please try again. Your saved club records are unchanged.</p>
    <div className="flex flex-wrap gap-3"><button className="btn-primary" onClick={reset}>Try again</button><Link className="btn-secondary" href="/admin">Return to dashboard</Link></div>
  </section>
}
