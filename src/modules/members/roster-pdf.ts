import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'
import { formatNairobiDate } from '@/lib/dates'

export type MemberRosterEntry = {
  fullName: string
  phone: string
  email: string
  studentRegNo: string | null
  status: string
  joinedAt: Date
}

const margin = 48
const lineHeight = 14

function pdfSafeText(value: string) {
  return value.normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\x20-\x7E]/g, ' ')
}

export async function createMemberRosterPdf(members: MemberRosterEntry[]) {
  const document = await PDFDocument.create()
  document.setTitle('Eagles Drama Club member roster')
  document.setAuthor('Eagles Drama Club')
  document.setSubject('Member contact details and registration status')
  const regular = await document.embedFont(StandardFonts.Helvetica)
  const bold = await document.embedFont(StandardFonts.HelveticaBold)
  let page = document.addPage()
  let y = page.getHeight() - margin
  const contentWidth = page.getWidth() - margin * 2

  function nextPage() {
    page = document.addPage()
    y = page.getHeight() - margin
  }

  function write(text: string, strong = false, size = 10) {
    const font = strong ? bold : regular
    const words = pdfSafeText(text).trim().split(/\s+/).filter(Boolean)
    let line = ''
    const lines: string[] = []
    for (const word of words) {
      const candidate = line ? `${line} ${word}` : word
      if (font.widthOfTextAtSize(candidate, size) <= contentWidth) {
        line = candidate
      } else {
        if (line) lines.push(line)
        line = ''
        let chunk = ''
        for (const character of word) {
          if (font.widthOfTextAtSize(`${chunk}${character}`, size) > contentWidth && chunk) {
            lines.push(chunk)
            chunk = character
          } else {
            chunk += character
          }
        }
        line = chunk
      }
    }
    if (line) lines.push(line)

    for (const textLine of lines.length ? lines : ['']) {
      if (y - lineHeight < margin) nextPage()
      page.drawText(textLine, {
        x: margin,
        y: y - size,
        size,
        font,
        color: strong ? rgb(0.02, 0.27, 0.2) : rgb(0.12, 0.16, 0.18),
      })
      y -= lineHeight
    }
  }

  const generatedAt = new Intl.DateTimeFormat('en-KE', {
    dateStyle: 'medium',
    timeZone: 'Africa/Nairobi',
  }).format(new Date())
  write('EAGLES DRAMA CLUB — MEMBER ROSTER', true, 16)
  write(`Generated ${generatedAt} · ${members.length} ${members.length === 1 ? 'member' : 'members'}`)
  y -= 10

  for (const [index, member] of members.entries()) {
    if (y - lineHeight * 4 < margin) nextPage()
    write(`${index + 1}. ${member.fullName}`, true, 12)
    write(`Status: ${member.status.replaceAll('_', ' ')} · Joined: ${formatNairobiDate(member.joinedAt)}`)
    write(`Phone: ${member.phone} · Email: ${member.email}`)
    if (member.studentRegNo) write(`Student registration number: ${member.studentRegNo}`)
    y -= 7
  }

  if (!members.length) write('No members found.')

  return document.save()
}
