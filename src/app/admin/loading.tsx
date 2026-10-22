export default function AdminLoading() {
  return <div className="space-y-4" aria-label="Loading committee workspace">
    <div className="h-40 animate-pulse rounded-2xl bg-stone-200" />
    <div className="grid gap-4 sm:grid-cols-2"><div className="h-32 animate-pulse rounded-2xl bg-stone-200" /><div className="h-32 animate-pulse rounded-2xl bg-stone-200" /></div>
    <div className="h-64 animate-pulse rounded-2xl bg-stone-200" />
  </div>
}
