import { useEffect, useState } from 'react'
import { isStaffOnDuty } from '../../lib/roster'

// RECHECK_MS controls how often the badge re-evaluates "on duty" against
// the wall clock. It has to poll rather than compute once, because the
// answer can flip on its own the moment the current time crosses a saved
// start_time/end_time boundary — nothing else in the app would otherwise
// trigger a re-render at that exact minute.
const RECHECK_MS = 60 * 1000

/**
 * Read-only status pill shown for staff/admin: 🟢 On Duty / ⚪ Off Duty.
 * Derived entirely from today's saved roster row + current time — this is
 * NOT a toggle. It reflects the schedule set on the Roster/Availability
 * page; to change it, staff edit their hours there, not here.
 */
export default function DutyStatusBadge({ staffId }) {
  const [onDuty, setOnDuty] = useState(null) // null = still loading

  useEffect(() => {
    if (!staffId) return
    let cancelled = false

    async function check() {
      const result = await isStaffOnDuty(staffId)
      if (!cancelled) setOnDuty(result)
    }

    check()
    const interval = setInterval(check, RECHECK_MS)
    return () => { cancelled = true; clearInterval(interval) }
  }, [staffId])

  if (onDuty === null) return null

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold flex-shrink-0 ${
        onDuty ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-500'
      }`}
      title={onDuty ? "Within today's scheduled working hours" : "Outside today's scheduled working hours"}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${onDuty ? 'bg-green-500' : 'bg-gray-400'}`} />
      {onDuty ? 'On Duty' : 'Off Duty'}
    </span>
  )
}
