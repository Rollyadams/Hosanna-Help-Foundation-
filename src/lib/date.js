// Shared local-date formatting helper.
//
// DO NOT use `date.toISOString().split('T')[0]` anywhere in this app to get
// "today" or a local calendar date as a string. It converts to UTC first,
// and for any timezone ahead of UTC (e.g. Nigeria, WAT = UTC+1), that rolls
// the date back by one day for part of the day/night — either right after
// local midnight (current moment case) or always, if the time was first
// zeroed out locally (the week_start case that broke chat routing and the
// duty badge). Every place in this codebase that needs "today" or a
// specific local date as 'YYYY-MM-DD' should import localDateStr from here
// instead of reimplementing it, so this bug can't quietly reappear in a
// new file the way it did independently in four different places already.
export function localDateStr(date = new Date()) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}
