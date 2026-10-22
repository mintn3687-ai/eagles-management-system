'use client'
import { useEffect, useState } from 'react'

export function InviteShare({ path, name, phone }: { path: string; name: string; phone: string }) {
  const [link, setLink] = useState(path)
  const [copied, setCopied] = useState('')
  useEffect(() => setLink(new URL(path, window.location.origin).href), [path])
  const message = `Hello ${name}, here is your Eagles Drama Club invitation/password reset link: ${link} . Set your password within 7 days. If you did not expect this, contact the committee.`
  async function copy(value: string, kind: string) {
    try { await navigator.clipboard.writeText(value); setCopied(`${kind} copied.`) }
    catch { setCopied('Copy the text below manually.') }
  }
  return <div className="space-y-4 rounded-xl border border-emerald-200 bg-emerald-50 p-5">
    <p className="font-medium">Share privately with the member. Valid for 7 days.</p>
    <label className="label" htmlFor="inviteLink">Invitation link</label><input id="inviteLink" className="input" readOnly value={link} onFocus={(e) => e.target.select()} />
    <button type="button" className="btn-secondary" onClick={() => copy(link, 'Link')}>Copy link</button>
    <label className="label" htmlFor="whatsappMessage">Ready-to-send WhatsApp message</label><textarea id="whatsappMessage" className="input min-h-32" readOnly value={message} />
    <div className="flex flex-wrap gap-3"><button type="button" className="btn-secondary" onClick={() => copy(message, 'Message')}>Copy message</button><a className="btn-secondary" target="_blank" rel="noreferrer" href={`https://wa.me/${phone}?text=${encodeURIComponent(message)}`}>Open WhatsApp</a></div>
    <p role="status" className="text-sm">{copied}</p>
  </div>
}
