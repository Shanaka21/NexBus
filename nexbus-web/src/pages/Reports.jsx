import { useState } from 'react'
import { api } from '../api'
import { colomboDate, lkr } from '../format'
import { Button, Card, ErrorBox, PageHeader, Spinner, useLoad } from '../ui'

const Stat = ({ label, value, tone }) => (
  <div className={`stat ${tone ? `tone-${tone}` : ''}`}>
    <div className="stat-label">{label}</div>
    <div className="stat-value">{value}</div>
  </div>
)

export default function Reports() {
  const [date, setDate] = useState(colomboDate())
  const { data, loading, error, reload } = useLoad(() => api(`/operator/reports?date=${date}`), [date])

  return (
    <>
      <PageHeader
        title="Daily report"
        subtitle="Trips, delays, bookings and revenue received"
        actions={
          <>
            <input className="input" type="date" value={date} onChange={(e) => e.target.value && setDate(e.target.value)} />
            <Button variant="ghost" onClick={() => window.print()}>Print</Button>
          </>
        }
      />
      <ErrorBox error={error} onRetry={reload} />
      {loading && !data ? <Spinner /> : data && (
        <>
          <h2 style={{ margin: '4px 0 12px' }}>Revenue</h2>
          <div className="stat-grid">
            <Stat label="Revenue received" value={lkr(data.revenue_lkr)} tone="green" />
            <Stat label="Payments received" value={data.payments_received} />
          </div>

          <h2 style={{ margin: '4px 0 12px' }}>Trips on {data.date}</h2>
          <div className="stat-grid">
            <Stat label="Total" value={data.trips.total} />
            <Stat label="Completed" value={data.trips.completed} />
            <Stat label="Running" value={data.trips.running} tone="green" />
            <Stat label="Scheduled" value={data.trips.scheduled} />
            <Stat label="Cancelled" value={data.trips.cancelled} tone={data.trips.cancelled ? 'red' : undefined} />
            <Stat label="Delayed (10+ min)" value={data.trips.delayed} tone={data.trips.delayed ? 'amber' : undefined} />
          </div>

          <Card title="Bookings made on this day">
            <div className="stat-grid" style={{ marginBottom: 0 }}>
              <Stat label="Total" value={data.bookings.total} />
              <Stat label="Confirmed" value={data.bookings.confirmed} tone="green" />
              <Stat label="Completed" value={data.bookings.completed} />
              <Stat label="Awaiting payment" value={data.bookings.pending_payment} tone={data.bookings.pending_payment ? 'amber' : undefined} />
              <Stat label="Expired" value={data.bookings.expired} />
              <Stat label="Cancelled" value={data.bookings.cancelled} />
              <Stat label="Refunds to process" value={data.bookings.refunds_required} tone={data.bookings.refunds_required ? 'amber' : undefined} />
            </div>
          </Card>
        </>
      )}
    </>
  )
}
