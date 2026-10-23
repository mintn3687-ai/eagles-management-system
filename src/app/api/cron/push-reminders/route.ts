import { NextResponse } from 'next/server'
import { sendUpcomingRehearsalReminders } from '@/modules/push/service'

export const runtime = 'nodejs'
export const maxDuration = 60

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET
  if (!secret) {
    console.error('CRON_SECRET is not configured.')
    return NextResponse.json({ error: 'Reminder job is not configured.' }, { status: 500, headers: { 'Cache-Control': 'no-store' } })
  }
  if (request.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401, headers: { 'Cache-Control': 'no-store' } })
  }

  try {
    const result = await sendUpcomingRehearsalReminders()
    return NextResponse.json(result, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    console.error('Daily rehearsal reminder job failed.', error)
    return NextResponse.json({ error: 'Could not send rehearsal reminders.' }, { status: 500, headers: { 'Cache-Control': 'no-store' } })
  }
}
