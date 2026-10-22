'use client'
export default function ErrorPage({ reset }: { reset: () => void }) {
  return <section className="card space-y-5"><h1>Something went wrong</h1><p>We couldn’t load this page. Please try again in a moment.</p><button className="btn-primary" onClick={reset}>Try again</button></section>
}
