'use client'

import { useState } from 'react'

const categories = [
  ['REHEARSALS', 'Rehearsals'],
  ['MEETINGS', 'Meetings'],
  ['PRODUCTIONS_AND_SHOWS', 'Productions and shows'],
  ['ELECTIONS', 'Elections'],
  ['GENERAL_ANNOUNCEMENTS', 'General announcements'],
] as const

export function PushAnnouncementForm() {
  const [category, setCategory] = useState<(typeof categories)[number][0]>('GENERAL_ANNOUNCEMENTS')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)

  async function sendAnnouncement(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setBusy(true)
    setMessage('')
    try {
      const response = await fetch('/api/admin/push', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requestId: crypto.randomUUID(), category }),
        cache: 'no-store',
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error ?? 'Could not send the announcement.')
      setMessage(`Sent to ${result.sent} device${result.sent === 1 ? '' : 's'}. ${result.failed} delivery${result.failed === 1 ? '' : 'ies'} failed.`)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not send the announcement.')
    } finally {
      setBusy(false)
    }
  }

  return <section className="card space-y-3">
    <div>
      <h2>Send a club notification</h2>
      <p className="text-sm text-slate-600">Sends a general update to all active accounts that enabled notifications. The device message won’t include private details.</p>
    </div>
    <form className="space-y-3" onSubmit={sendAnnouncement}>
      <label className="block text-sm font-medium" htmlFor="push-category">Update category</label>
      <select id="push-category" className="input" value={category} onChange={(event) => setCategory(event.target.value as typeof category)}>
        {categories.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
      </select>
      <button className="btn-primary" type="submit" disabled={busy}>{busy ? 'Sending…' : 'Send notification'}</button>
    </form>
    {message && <p className="text-sm text-slate-600" role="status">{message}</p>}
  </section>
}
