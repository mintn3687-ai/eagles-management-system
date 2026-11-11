export type SelfAttendanceStatus = 'PRESENT' | 'ABSENT' | 'NO_RESPONSE' | null

export function attendancePercent(present: number, missed: number): number {
  const denominator = present + missed
  return denominator === 0 ? 0 : Math.round((present / denominator) * 1000) / 10
}

export function evaluateCheckInAttempt(input: {
  submittedCode: string
  correctCode: string | null
  wrongCodeTries: number
  status: SelfAttendanceStatus
}): 'ALREADY_PRESENT' | 'ATTEMPTS_EXHAUSTED' | 'WRONG_CODE' | 'PRESENT' {
  if (input.status === 'PRESENT') return 'ALREADY_PRESENT'
  if (input.wrongCodeTries >= 5) return 'ATTEMPTS_EXHAUSTED'
  return input.submittedCode === input.correctCode ? 'PRESENT' : 'WRONG_CODE'
}

export function attendanceWindowClosed(end: Date, now = new Date()) {
  return now.getTime() >= end.getTime()
}

export function absenceDeadlinePassed(end: Date, deadlineHours: number, now = new Date()) {
  return now.getTime() > end.getTime() + deadlineHours * 60 * 60 * 1000
}
