import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'
import { formatNairobiDate } from '@/lib/dates'
import { formatKES } from '@/lib/money'
import type { getFestival, getFestivalPlanning } from './service'

type FestivalProposal = {
  festival: NonNullable<Awaited<ReturnType<typeof getFestival>>>
  planning: Awaited<ReturnType<typeof getFestivalPlanning>>
}

const margin = 48
const bodySize = 9
const lineHeight = 13

function pdfSafeText(value: string) {
  return value.normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\x20-\x7E]/g, ' ')
}

function dateText(value: Date | null) {
  return value ? formatNairobiDate(value, true) : 'Not set'
}

export async function createFestivalProposalPdf({ festival, planning }: FestivalProposal) {
  const document = await PDFDocument.create()
  document.setTitle(`${festival.name} festival proposal`)
  document.setAuthor('Eagles Drama Club')
  document.setSubject('Festival plan, budget, approvals, and logistics')
  const regular = await document.embedFont(StandardFonts.Helvetica)
  const bold = await document.embedFont(StandardFonts.HelveticaBold)
  let page = document.addPage()
  let y = page.getHeight() - margin
  const contentWidth = page.getWidth() - margin * 2

  function nextPage() {
    page = document.addPage()
    y = page.getHeight() - margin
  }

  function wrap(text: string, size: number, font: typeof regular) {
    const words = pdfSafeText(text).trim().split(/\s+/).filter(Boolean)
    const lines: string[] = []
    let current = ''
    for (const word of words) {
      const candidate = current ? `${current} ${word}` : word
      if (font.widthOfTextAtSize(candidate, size) <= contentWidth) {
        current = candidate
        continue
      }
      if (current) lines.push(current)
      current = ''
      let chunk = ''
      for (const character of word) {
        if (font.widthOfTextAtSize(`${chunk}${character}`, size) > contentWidth && chunk) {
          lines.push(chunk)
          chunk = character
        } else {
          chunk += character
        }
      }
      current = chunk
    }
    if (current) lines.push(current)
    return lines.length ? lines : ['']
  }

  function write(text: string, options: { size?: number; strong?: boolean; color?: ReturnType<typeof rgb>; gap?: number } = {}) {
    const size = options.size ?? bodySize
    const font = options.strong ? bold : regular
    const lines = wrap(text, size, font)
    for (const line of lines) {
      if (y - lineHeight < margin) nextPage()
      page.drawText(line, {
        x: margin,
        y: y - size,
        size,
        font,
        color: options.color ?? rgb(0.12, 0.16, 0.18),
      })
      y -= lineHeight
    }
    y -= options.gap ?? 0
  }

  function section(title: string) {
    y -= 7
    write(title, { size: 13, strong: true, color: rgb(0.02, 0.34, 0.25), gap: 3 })
  }

  function item(label: string, value: string | null | undefined) {
    write(`${label}: ${value?.trim() || 'Not provided'}`)
  }

  const generatedAt = new Intl.DateTimeFormat('en-KE', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Africa/Nairobi',
  }).format(new Date())
  write('FESTIVAL PROPOSAL', { size: 19, strong: true, color: rgb(0.02, 0.27, 0.2), gap: 2 })
  write(`${festival.name} · ${festival.year}`, { size: 15, strong: true, gap: 4 })
  item('Prepared', generatedAt)
  item('Festival status', festival.status)
  item('Organizer', festival.organizer)
  item('Venue', festival.venue)
  item('Dates', festival.startDate
    ? `${formatNairobiDate(festival.startDate)}${festival.endDate ? ` to ${formatNairobiDate(festival.endDate)}` : ''}`
    : 'Not set')
  item('Plan notes', festival.notes)

  section('Overall plan approval')
  const planApproval = planning.planApproval
  item('Status', planApproval?.status ?? 'Not submitted')
  if (planApproval) {
    item('Submitted by', planApproval.submittedByName)
    item('Submitted at', dateText(planApproval.submittedAt))
    item('Decision by', planApproval.decidedByName)
    item('Decision at', dateText(planApproval.decidedAt))
    item('Decision reason', planApproval.decisionReason)
  }

  section('Budget summary')
  item('Planned income', formatKES(planning.budgetSummary.INCOME.planned))
  item('Approved income', formatKES(planning.budgetSummary.INCOME.approved))
  item('Actual linked income', formatKES(planning.budgetSummary.INCOME.actual))
  item('Planned expenses', formatKES(planning.budgetSummary.EXPENSE.planned))
  item('Approved expenses', formatKES(planning.budgetSummary.EXPENSE.approved))
  item('Actual linked expenses', formatKES(planning.budgetSummary.EXPENSE.actual))
  if (!planning.budgetItems.length) write('No budget items recorded.')
  for (const budget of planning.budgetItems) {
    const approvalStatus = budget.approval?.status ?? 'NOT SUBMITTED'
    const approvedAmount = budget.approval?.status === 'APPROVED' && budget.approval.approvedAmount !== null
      ? formatKES(budget.approval.approvedAmount)
      : 'Not approved'
    write(`${budget.type} · ${budget.category}`, { strong: true })
    item('Planned', formatKES(budget.plannedAmount))
    item('Approved', `${approvedAmount} (${approvalStatus.toLowerCase()})`)
    item('Actual linked', formatKES(budget.actualAmount))
    item('Notes', budget.notes)
    for (const link of budget.links) {
      const entry = link.financeEntry
      if (entry) {
        write(`Linked ledger record · ${dateText(entry.occurredAt)} · ${entry.category} · ${formatKES(entry.amount)} · ${entry.description}`)
      }
    }
  }

  section('Invitations and response deadlines')
  if (!planning.invitations.length) write('No invitations recorded.')
  for (const invitation of planning.invitations) {
    write(`Invitation · received ${dateText(invitation.receivedAt)} · ${invitation.status}`, { strong: true })
    item('Response deadline', dateText(invitation.responseDeadline))
    item('Response date', dateText(invitation.respondedAt))
    item('Notes', invitation.notes)
  }

  section('Competition entries and deadlines')
  if (!planning.entries.length) write('No competition entries recorded.')
  for (const entry of planning.entries) {
    write(`${entry.itemTitle} · ${entry.categoryName}`, { strong: true })
    item('Linked production', entry.productionTitle)
    item('Status', entry.status)
    item('Deadline', dateText(entry.deadline))
    item('Submitted', dateText(entry.submittedAt))
    item('Confirmed', dateText(entry.confirmedAt))
    item('Notes', entry.notes)
  }

  section('Travel and logistics')
  if (!planning.logisticsItems.length) write('No logistics tasks recorded.')
  for (const logistics of planning.logisticsItems) {
    write(`${logistics.category.replaceAll('_', ' ')} · ${logistics.title}`, { strong: true })
    item('Status', logistics.status)
    item('Due', dateText(logistics.dueAt))
    item('Assigned member', logistics.assignedMemberName)
    item('Description', logistics.description)
    item('Completed', dateText(logistics.completedAt))
    item('Completed by', logistics.completedByName)
  }

  section('Approval history')
  if (!planning.approvalHistory.length) write('No approval requests recorded.')
  for (const approval of planning.approvalHistory) {
    write(`${approval.type} · ${approval.status}`, { strong: true })
    item('Submitted by', approval.submittedByName)
    item('Submitted at', dateText(approval.submittedAt))
    item('Decided by', approval.decidedByName)
    item('Decided at', dateText(approval.decidedAt))
    item('Requested amount', approval.requestedAmount === null ? null : formatKES(approval.requestedAmount))
    item('Approved amount', approval.approvedAmount === null ? null : formatKES(approval.approvedAmount))
    item('Decision reason', approval.decisionReason)
  }

  section('Festival document register')
  if (!planning.festivalDocuments.length) write('No documents recorded.')
  for (const file of planning.festivalDocuments) {
    write(file.originalName, { strong: true })
    item('Status', file.status)
    item('Size', `${Math.ceil(file.sizeBytes / 1024)} KB`)
    item('Uploaded', dateText(file.uploadedAt ?? file.createdAt))
  }

  const bytes = await document.save()
  return bytes
}
