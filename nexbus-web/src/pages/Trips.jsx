import { useState } from 'react'
import { api } from '../api'
import { TRIP_TONE, clock, colomboDate, colomboLocalToIso, label } from '../format'
import { Badge, Button, Card, ErrorBox, Field, Modal, PageHeader, Spinner, Table, useLoad, useToast } from '../ui'

// next full hour in Sri Lanka time, formatted for <input type="datetime-local">
const defaultDeparture = () => {
  const t = new Date(Date.now() + 5.5 * 3600 * 1000 + 3600 * 1000)
  t.setUTCMinutes(0, 0, 0)
  return t.toISOString().slice(0, 16)
}

function TripForm({ routes, vehicles, drivers, onClose, onSaved }) {
  const toast = useToast()
  const [form, setForm] = useState({ route_id: routes[0]?.id || '', vehicle_id: '', driver_id: drivers[0]?.uid || '', departure: defaultDeparture() })
  const [busy, setBusy] = useState(false)
  const [errors, setErrors] = useState({})

  const routeVehicles = vehicles.filter((v) => v.route_id === form.route_id)
  const vehicleId = routeVehicles.some((v) => v.id === form.vehicle_id) ? form.vehicle_id : routeVehicles[0]?.id || ''
  const set = (key) => (e) => setForm({ ...form, [key]: e.target.value })

  const save = async () => {
    const next = {}
    if (!form.route_id) next.route_id = 'Select a route'
    if (!vehicleId) next.vehicle_id = 'This route has no vehicle yet. Register one first.'
    if (!form.driver_id) next.driver_id = 'Select a driver'
    if (!form.departure) next.departure = 'Choose a departure time'
    setErrors(next)
    if (Object.keys(next).length) return

    setBusy(true)
    try {
      await api('/trips', {
        method: 'POST',
        body: { route_id: form.route_id, vehicle_id: vehicleId, driver_id: form.driver_id, scheduled_departure: colomboLocalToIso(form.departure) },
      })
      toast('Trip scheduled')
      onSaved()
    } catch (err) {
      toast(err.message, 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      title="Schedule a trip"
      onClose={onClose}
      footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button busy={busy} onClick={save}>Schedule</Button></>}
    >
      <Field label="Route" error={errors.route_id}>
        <select className="input" value={form.route_id} onChange={set('route_id')}>
          {routes.map((r) => <option key={r.id} value={r.id}>{r.route_number} · {r.start_point} to {r.end_point}</option>)}
        </select>
      </Field>
      <div className="form-grid">
        <Field label="Vehicle" error={errors.vehicle_id}>
          <select className="input" value={vehicleId} onChange={set('vehicle_id')}>
            {routeVehicles.map((v) => <option key={v.id} value={v.id}>{v.registration_no}</option>)}
          </select>
        </Field>
        <Field label="Driver" error={errors.driver_id}>
          <select className="input" value={form.driver_id} onChange={set('driver_id')}>
            {drivers.map((d) => <option key={d.uid} value={d.uid}>{d.full_name}</option>)}
          </select>
        </Field>
      </div>
      <Field label="Departure (Sri Lanka time)" error={errors.departure}>
        <input className="input" type="datetime-local" value={form.departure} onChange={set('departure')} />
      </Field>
    </Modal>
  )
}

export default function Trips() {
  const toast = useToast()
  const [date, setDate] = useState(colomboDate())
  const [status, setStatus] = useState('')
  const [open, setOpen] = useState(false)

  const refs = useLoad(async () => {
    const [routes, vehicles, drivers] = await Promise.all([api('/routes'), api('/vehicles'), api('/operator/drivers')])
    return { routes, vehicles, drivers }
  })
  const trips = useLoad(() => api(`/trips?date=${date}${status ? `&status=${status}` : ''}`), [date, status])

  const cancel = async (trip) => {
    if (!window.confirm(`Cancel the ${clock(trip.scheduled_departure)} trip of route ${trip.route_number}? Booked passengers will be notified.`)) return
    try {
      await api(`/trips/${trip.id}/status`, { method: 'PATCH', body: { status: 'cancelled' } })
      toast('Trip cancelled')
      trips.reload()
    } catch (err) {
      toast(err.message, 'error')
    }
  }

  if (refs.loading && !refs.data) return <Spinner />
  const { routes = [], vehicles = [], drivers = [] } = refs.data || {}

  return (
    <>
      <PageHeader
        title="Trips"
        subtitle="Scheduled, running and finished trips"
        actions={<Button onClick={() => setOpen(true)} disabled={!routes.length || !drivers.length}>Schedule trip</Button>}
      />
      {!drivers.length && <div className="notice warn">Create a driver account first (Drivers page) before scheduling trips.</div>}
      <ErrorBox error={refs.error || trips.error} onRetry={() => { refs.reload(); trips.reload() }} />

      <Card
        title="Trips"
        actions={
          <div className="filters">
            <input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            <select className="input" value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="">All statuses</option>
              {['scheduled', 'running', 'completed', 'cancelled'].map((s) => <option key={s} value={s}>{label(s)}</option>)}
            </select>
          </div>
        }
        flush
      >
        {trips.loading && !trips.data ? <Spinner /> : (
          <Table
            empty="No trips on this day."
            rows={trips.data || []}
            columns={[
              { key: 'time', title: 'Departure', render: (t) => <strong>{clock(t.scheduled_departure)}</strong> },
              { key: 'route', title: 'Route', render: (t) => t.route_number },
              { key: 'bus', title: 'Bus / driver', render: (t) => <>{t.registration_no}<span className="cell-sub">{t.driver_name}</span></> },
              { key: 'status', title: 'Status', render: (t) => <Badge tone={TRIP_TONE[t.status]}>{label(t.status)}</Badge> },
              { key: 'seats', title: 'Seats booked', render: (t) => t.reservable_seats ? `${t.reservable_seats - t.available_seats} / ${t.reservable_seats}` : '-' },
              { key: 'delay', title: 'Delay', render: (t) => t.delay_minutes >= 10 ? <Badge tone="amber">{t.delay_minutes} min</Badge> : '-' },
              { key: 'act', title: '', render: (t) => t.status === 'scheduled' && <button className="link-btn" onClick={() => cancel(t)}>Cancel</button> },
            ]}
          />
        )}
      </Card>

      {open && (
        <TripForm
          routes={routes} vehicles={vehicles} drivers={drivers}
          onClose={() => setOpen(false)}
          onSaved={() => { setOpen(false); trips.reload() }}
        />
      )}
    </>
  )
}
