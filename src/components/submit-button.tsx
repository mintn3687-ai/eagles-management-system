'use client'
import { useFormStatus } from 'react-dom'
export function SubmitButton({ children, pendingText = 'Please wait…' }: { children: React.ReactNode; pendingText?: string }) {
  const { pending } = useFormStatus()
  return <button type="submit" className="btn-primary w-full" disabled={pending}>{pending ? pendingText : children}</button>
}
