import type { ReactNode } from 'react'

export function FormField({
  label,
  htmlFor,
  children,
  hint,
}: {
  label: string
  htmlFor: string
  children: ReactNode
  hint?: string
}) {
  return <div className="space-y-1">
    <label className="label" htmlFor={htmlFor}>{label}</label>
    {children}
    {hint && <p className="text-sm text-slate-600">{hint}</p>}
  </div>
}
