import { useState } from 'react'
import { api } from '../api'
import { BOOKING_TONE, PAYMENT_TONE, label, lkr } from '../format'
import { Badge, Card, ErrorBox, PageHeader, Spinner, Table, useLoad } from '../ui'

export default function Bookings() {
  const [date, setDate] = useState('')
  const [status, setStatus] = useState('')
  const query = [date && `date=${date}`, status && `status=${status}`].filter(Boolean).join('&')
  const { data, loading, error, reload } = useLoad(() => api(`/operator/bookings${query ? `?${query}` : ''}`), [query])

  const rows = data || []
  const received = rows.filter((b) => b.payment?.status === 'success').reduce((sum, b) => sum + (b.fare_amount_lkr || 0), 0)
  const refunds = rows.filter((b) => b.refund_required).length

  return (
    <>
      <PageHeader title="Bookings & Payments" subtitle="Reservations on your trips and their PayHere payments" />
      <ErrorBox error={error} onRetry={reload} />

      <div className="stat-grid">
        <div className="stat"><div className="stat-label">Bookings shown</div><div className="stat-value">{rows.length}</div></div>
        <div className="stat tone-green"><div className="stat-label">Payments received</div><div className="stat-value">{lkr(received)}</div></div>
        <div className={`stat ${refunds ? 'tone-amber' : ''}`}><div className="stat-label">Refunds to process</div><div className="stat-value">{refunds}</div><div className="stat-sub">paid bookings that were cancelled</div></div>
      </div>

      <Card
        title="Bookings"
        actions={
          <div className="filters">
            <input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} aria-label="Booked on" />
            <select className="input" value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="">All statuses</option>
              {['pending_payment', 'confirmed', 'completed', 'cancelled', 'expired'].map((s) => <option key={s} value={s}>{label(s)}</option>)}
            </select>
          </div>
        }
        flush
      >
        {loading && !data ? <Spinner /> : (
          <Table
            empty="No bookings match these filters."
            rows={rows}
            columns={[
              { key: 'ref', title: 'Reference', render: (b) => <strong>{b.booking_reference || b.id.slice(0, 8)}</strong> },
              { key: 'trip', title: 'Trip', render: (b) => <>Route {b.route_number}<span className="cell-sub">{b.from} to {b.to} · {b.date} {b.time}</span></> },
              { key: 'seats', title: 'Seats', render: (b) => b.seat_numbers?.length ? b.seat_numbers.join(', ') : b.seats },
              { key: 'amount', title: 'Amount', render: (b) => <span className="nowrap">{b.fare}</span> },
              { key: 'status', title: 'Booking', render: (b) => <Badge tone={BOOKING_TONE[b.booking_status] || 'gray'}>{label(b.booking_status)}</Badge> },
              {
                key: 'pay', title: 'Payment',
                render: (b) => b.payment
                  ? <><Badge tone={PAYMENT_TONE[b.payment.status] || 'gray'}>{label(b.payment.status)}</Badge><span className="cell-sub">{b.payment.gateway_payment_id ? `PayHere ${b.payment.gateway_payment_id}` : b.payment.order_id}{b.payment.method ? ` · ${b.payment.method}` : ''}</span></>
                  : <Badge tone="gray">Unpaid</Badge>,
              },
              { key: 'refund', title: '', render: (b) => b.refund_required && <Badge tone="amber">Refund due</Badge> },
            ]}
          />
        )}
      </Card>
    </>
  )
}
