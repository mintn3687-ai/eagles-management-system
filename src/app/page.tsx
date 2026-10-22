import Link from 'next/link'
export default function HomePage() {
  return <section className="card space-y-6"><p className="text-sm font-semibold uppercase tracking-widest text-emerald-700">Welcome to the club</p><h1>Our people.<br />Our stage.</h1><p className="max-w-lg text-lg text-slate-600">Your place in Eagles Drama Club starts here. Sign in to access your membership.</p><Link className="btn-primary" href="/login">Member sign in</Link><p className="text-sm text-slate-500">Membership is by invitation. To join or get help signing in, contact the committee.</p></section>
}
