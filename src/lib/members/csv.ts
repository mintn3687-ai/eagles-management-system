import { csvMemberSchema } from '../validation/members'

export const CSV_MAX_BYTES = 512000
export const CSV_MAX_ROWS = 500
export const CSV_COLUMNS = ['fullName', 'phone', 'email', 'studentRegNo'] as const
export type CsvValues = Record<typeof CSV_COLUMNS[number], string>
export type CsvPreviewRow = { row: number; values: CsvValues; errors: string[] }
export class CsvError extends Error {}

export function parseCsv(source: string): string[][] {
  if (new TextEncoder().encode(source).length > CSV_MAX_BYTES) throw new CsvError('The CSV file must be 500 KB or smaller.')
  const input = source.replace(/^\uFEFF/, '')
  const rows: string[][] = []
  let row: string[] = [], field = '', quoted = false, closed = false
  const finishField = () => { row.push(field); field = ''; closed = false }
  const finishRow = () => {
    finishField()
    if (row.some((v) => v.trim())) rows.push(row)
    row = []
    if (rows.length > CSV_MAX_ROWS + 1) throw new CsvError('Import at most 500 members at a time.')
  }
  for (let i = 0; i < input.length; i++) {
    const char = input[i]
    if (quoted) {
      if (char === '"' && input[i + 1] === '"') { field += '"'; i++ }
      else if (char === '"') { quoted = false; closed = true }
      else field += char
    } else if (char === ',') finishField()
    else if (char === '\n' || char === '\r') {
      if (char === '\r' && input[i + 1] === '\n') i++
      finishRow()
    } else if (char === '"' && !field && !closed) quoted = true
    else if (closed || char === '"') throw new CsvError('The CSV contains an incorrectly quoted value.')
    else field += char
  }
  if (quoted) throw new CsvError('The CSV contains an unclosed quotation mark.')
  if (field || row.length || closed) finishRow()
  return rows
}

export function previewCsv(source: string): CsvPreviewRow[] {
  const [rawHeaders, ...rows] = parseCsv(source)
  const headers = rawHeaders?.map((v) => v.trim())
  if (!headers || headers.length !== 4 || new Set(headers).size !== 4 || CSV_COLUMNS.some((h) => !headers.includes(h))) {
    throw new CsvError('Use exactly these CSV columns: fullName, phone, email, studentRegNo.')
  }
  if (!rows.length) throw new CsvError('Add at least one member row to the CSV.')
  const seenPhone = new Map<string, number>(), seenEmail = new Map<string, number>()
  return rows.map((cells, index) => {
    const row = index + 2
    const raw = Object.fromEntries(CSV_COLUMNS.map((key) => [key, cells[headers.indexOf(key)] ?? ''])) as CsvValues
    const parsed = csvMemberSchema.safeParse(raw)
    const errors = cells.length !== 4 ? ['Expected 4 columns.'] : []
    if (!parsed.success) errors.push(...parsed.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`))
    const values = parsed.success ? parsed.data : raw
    if (parsed.success) {
      for (const [key, seen] of [['phone', seenPhone], ['email', seenEmail]] as const) {
        if (seen.has(values[key])) errors.push(`Duplicate ${key} within this file (row ${seen.get(values[key])}).`)
        else seen.set(values[key], row)
      }
    }
    return { row, values, errors }
  })
}

export function csvCell(value: string): string {
  // Prevent exported member data being evaluated as spreadsheet formulas.
  const safe = /^[\s]*[=+@\-\t\r]/.test(value) ? `'${value}` : value
  return `"${safe.replaceAll('"', '""')}"`
}
export const csvLine = (values: string[]) => values.map(csvCell).join(',') + '\r\n'
