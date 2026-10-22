import Link from 'next/link'
export default function NotFound() {
  return <section className="card space-y-5"><h1>Page not found</h1><p>The page or member record you requested could not be found.</p><Link className="btn-primary" href="/">Return home</Link></section>
}
