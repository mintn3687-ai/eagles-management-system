import Link from 'next/link'
export default function ForbiddenPage() {
  return <section className="card space-y-6"><h1>Access unavailable</h1><p>This area is for the committee. Contact the committee if you need help with your access.</p><Link href="/member" className="btn-primary">Return to member home</Link></section>
}
