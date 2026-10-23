'use client'
import { useActionState } from 'react'
import { acceptConsentAction } from '@/modules/consent/actions'
import { SubmitButton } from './submit-button'

export function ConsentForm() {
  const [state, action] = useActionState(acceptConsentAction, {})
  return <form action={action} className="space-y-5">
    <label className="flex min-h-12 cursor-pointer items-start gap-3 rounded-lg border border-slate-300 p-4">
      <input className="mt-1 h-5 w-5 shrink-0 accent-emerald-800" type="checkbox" name="consent" required />
      <span>I consent to Eagles Drama Club storing and using my membership details, emergency contacts, attendance, and payment records to administer the club. I understand the committee can access these records, and I can contact them about my data or consent.</span>
    </label>
    {state.error && <p className="error" role="alert">{state.error}</p>}
    <SubmitButton>Agree and continue</SubmitButton>
  </form>
}
