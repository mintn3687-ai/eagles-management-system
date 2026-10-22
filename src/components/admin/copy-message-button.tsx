'use client'
import { useState } from 'react'

export function CopyMessageButton({ message, label = 'Copy WhatsApp message' }: { message: string; label?: string }) {
  const [status, setStatus] = useState('')
  return <div className="space-y-1">
    <button type="button" className="btn-secondary" onClick={async () => {
      try { await navigator.clipboard.writeText(message); setStatus('Message copied. Paste it into WhatsApp.') }
      catch { setStatus('Clipboard access is unavailable in this browser.') }
    }}>{label}</button>
    {status && <p className="text-sm text-slate-600" role="status">{status}</p>}
  </div>
}

export function CopyFeeReminder({ members }: { members: { id: string; fullName: string }[] }) {
  const [selected, setSelected] = useState<string[]>([])
  const [status, setStatus] = useState('')
  const recipients = members.filter((member) => selected.includes(member.id))
  async function copy() {
    if (!recipients.length) { setStatus('Select at least one member.'); return }
    const greeting = recipients.length === 1 ? `Hi ${recipients[0].fullName},` : `Hello ${recipients.map((member) => member.fullName).join(', ')},`
    const message = `${greeting} this is a reminder that your club subscription is overdue. Please arrange payment or contact the committee if you have already paid. Thank you, Eagles Drama Club.`
    try { await navigator.clipboard.writeText(message); setStatus('Message copied. Paste it into WhatsApp.') }
    catch { setStatus('Clipboard access is unavailable in this browser.') }
  }
  return <div className="space-y-3">
    <fieldset className="space-y-2"><legend className="label">Choose reminder recipients</legend>
      {members.map((member) => <label key={member.id} className="flex min-h-11 items-center gap-3"><input type="checkbox" className="h-5 w-5 accent-emerald-800" checked={selected.includes(member.id)} onChange={(event) => setSelected((current) => event.target.checked ? [...current, member.id] : current.filter((id) => id !== member.id))} /><span>{member.fullName}</span></label>)}
    </fieldset>
    <button className="btn-secondary" type="button" onClick={copy}>Copy reminder for {recipients.length || 'selected'} member{recipients.length === 1 ? '' : 's'}</button>
    {status && <p className="text-sm text-slate-600" role="status">{status}</p>}
  </div>
}
