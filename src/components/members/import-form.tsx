'use client'
import Link from 'next/link'
import { useActionState } from 'react'
import { previewImportAction, confirmImportAction } from '@/app/admin/members/actions'
import { SubmitButton } from '../submit-button'

function ConfirmImport({ source }: { source: string }) {
  const [state, action] = useActionState(confirmImportAction, {})
  if (state.imported !== undefined) return <div className="space-y-4 rounded-xl bg-emerald-50 p-5" role="status"><p>Imported {state.imported} members successfully. Open each member record to complete emergency contacts and generate their invitation.</p><Link className="btn-primary" href="/admin/members">View members</Link></div>
  return <form action={action} className="space-y-4"><input type="hidden" name="source" value={source} />{state.error && <p className="error" role="alert">{state.error}</p>}<SubmitButton pendingText="Importing members…">Confirm and import this batch</SubmitButton></form>
}
export function ImportForm() {
  const [state, action] = useActionState(previewImportAction, {})
  const errors = state.rows?.filter((row) => row.errors.length).length ?? 0
  return <div className="space-y-6"><form action={action} className="space-y-4"><label htmlFor="file" className="label">Choose CSV (maximum 500 rows, 500 KB)</label><input className="input" type="file" id="file" name="file" accept=".csv,text/csv" required /><SubmitButton pendingText="Checking CSV…">Preview import</SubmitButton></form>
    {state.error && <p className="error" role="alert">{state.error}</p>}
    {state.rows && <><p role="status">{state.rows.length} rows · {errors} rows with errors. {errors ? 'Fix the CSV and preview it again. Nothing has been imported.' : 'Check the preview, then confirm below.'}</p><div className="max-h-[32rem] overflow-auto rounded-lg border border-slate-200"><table className="w-full min-w-[640px] text-left text-sm"><caption className="sr-only">CSV import preview</caption><thead className="sticky top-0 bg-stone-100"><tr>{['Row', 'Name', 'Phone', 'Email', 'Student no.', 'Checks'].map((label) => <th key={label} className="p-3">{label}</th>)}</tr></thead><tbody>{state.rows.map((row) => <tr className="border-t" key={row.row}><td className="p-3">{row.row}</td><td className="p-3">{row.values.fullName}</td><td className="p-3">{row.values.phone}</td><td className="p-3">{row.values.email}</td><td className="p-3">{row.values.studentRegNo}</td><td className={`p-3 ${row.errors.length ? 'text-red-800' : 'text-emerald-800'}`}>{row.errors.length ? row.errors.join(' ') : 'Ready'}</td></tr>)}</tbody></table></div>{!errors && state.source && <ConfirmImport key={state.source} source={state.source} />}</>}
  </div>
}
