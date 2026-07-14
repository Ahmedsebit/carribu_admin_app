// Trip timeliness classification, shared by the Trips page UI.
//
// A trip's scheduled start is scheduledDate + scheduledTime (interpreted in the
// viewer's local timezone, matching how the time is entered/displayed). From
// that we derive whether a trip:
//   - was never started even though its start time has passed ("not_started")
//   - started later than scheduled ("delayed")
//   - started on time ("on_time")
//   - is still upcoming ("upcoming")
// Trips without a scheduledTime can't be assessed and return null.

export function tripStartDate(trip) {
  if (!trip || !trip.scheduledDate || !trip.scheduledTime) return null;
  const time = trip.scheduledTime.length === 5 ? `${trip.scheduledTime}:00` : trip.scheduledTime;
  const d = new Date(`${trip.scheduledDate}T${time}`);
  return isNaN(d.getTime()) ? null : d;
}

// graceMinutes: how long after the scheduled start a trip is still considered
// "on time" before it counts as not started / delayed.
export function classifyTimeliness(trip, now = new Date(), graceMinutes = 5) {
  const start = tripStartDate(trip);
  if (!start) return null;
  const graceMs = graceMinutes * 60000;
  const startMs = start.getTime();
  const nowMs = now instanceof Date ? now.getTime() : new Date(now).getTime();

  if (trip.status === 'scheduled') {
    if (nowMs > startMs + graceMs) {
      const lateMinutes = Math.round((nowMs - startMs) / 60000);
      return { key: 'not_started', label: 'Not started', cls: 'badge-cancelled', icon: '⚠️', lateMinutes };
    }
    return { key: 'upcoming', label: 'Upcoming', cls: 'badge-scheduled', icon: '🕒', lateMinutes: 0 };
  }

  if (trip.status === 'cancelled') return null;

  // in_progress or completed: judge by when it actually started.
  if (trip.startedAt) {
    const lateMs = new Date(trip.startedAt).getTime() - startMs;
    if (lateMs > graceMs) {
      const lateMinutes = Math.round(lateMs / 60000);
      return { key: 'delayed', label: `Delayed ${lateMinutes}m`, cls: 'badge-maintenance', icon: '⏱️', lateMinutes };
    }
    return { key: 'on_time', label: 'On time', cls: 'badge-completed', icon: '✅', lateMinutes: 0 };
  }
  return null;
}
