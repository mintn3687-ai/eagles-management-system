import type { ReactNode } from 'react'

export type DataColumn<Row> = {
  key: string
  header: string
  render: (row: Row) => ReactNode
}

export function DataTable<Row extends { id: string }>({
  rows,
  columns,
  emptyMessage,
}: {
  rows: readonly Row[]
  columns: readonly DataColumn<Row>[]
  emptyMessage: string
}) {
  if (rows.length === 0) {
    return <p className="rounded-lg bg-stone-50 p-4 text-sm text-slate-600">{emptyMessage}</p>
  }

  return <div className="overflow-x-auto">
    <table className="w-full border-collapse text-left text-sm">
      <thead>
        <tr className="border-b border-slate-200">
          {columns.map((column) => <th className="px-3 py-3 font-semibold text-slate-700" key={column.key} scope="col">{column.header}</th>)}
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => <tr className="border-b border-slate-100 last:border-0" key={row.id}>
          {columns.map((column) => <td className="px-3 py-3 align-top" key={column.key}>{column.render(row)}</td>)}
        </tr>)}
      </tbody>
    </table>
  </div>
}
