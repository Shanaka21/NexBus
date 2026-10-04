import { useState } from 'react'
import { api } from '../api'
import { LIVE, label } from '../format'
import { Badge, Button, Card, ErrorBox, Field, Modal, PageHeader, Spinner, Table, useLoad, useToast } from '../ui'

const STATUS_TONE = { active: 'green', delayed: 'amber', emergency: 'red', inactive: 'gray' }
const blank = { registration_no: '', route_id: '', seat_capacity: 54, reservable_seats: 0 }

function VehicleForm({ vehicle, routes, onClose, onSaved }) {
  const toast = useToast()
  const editing = !!vehicle
  const [form, setForm] = useState(vehicle
    ? { registration_no: vehicle.registration_no, route_id: vehicle.route_id, seat_capacity: vehicle.seat_capacity, reservable_seats: vehicle.reservable_seats }
    : { ...blank, route_id: routes[0]?.id || '' })
  const [busy, setBusy] = useState(false)
  const [errors, setErrors] = useState({})

  const set = (key) => (e) => setForm({ ...form, [key]: e.target.value })

  const validate = () => {
    const next = {}
    if (form.registration_no.trim().length < 3) next.registration_no = 'Enter the registration number'
    if (!form.route_id) next.route_id = 'Select a route'
    if (!(Number(form.seat_capacity) >= 1)) next.seat_capacity = 'At least 1 seat'
    if (Number(form.reservable_seats) < 0) next.reservable_seats = 'Cannot be negative'
    if (Number(form.reservable_seats) > Number(form.seat_capacity)) next.reservable_seats = 'Cannot exceed seat capacity'
    setErrors(next)
    return Object.keys(next).length === 0
  }

  const save = async () => {
    if (!validate()) return
    setBusy(true)
    const body = {
      registration_no: form.registration_no.trim(), route_id: form.route_id,
      seat_capacity: Number(form.seat_capacity), reservable_seats: Number(form.reservable_seats),
    }
    try {
      await api(editing ? `/vehicles/${vehicle.id}` : '/vehicles', { method: editing ? 'PUT' : 'POST', body })
      toast(editing ? 'Vehicle updated' : 'Vehicle registered')
      onSaved()
    } catch (err) {
      toast(err.message, 'error') // the API validates again and has the final say
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      title={editing ? 'Edit vehicle' : 'Register vehicle'}
      onClose={onClose}
      footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button busy={busy} onClick={save}>Save</Button></>}
    >
      <Field label="Registration number" error={errors.registration_no}>
        <input className="input" value={form.registration_no} onChange={set('registration_no')} placeholder="NB-4521" />
      </Field>
      <Field label="Route" error={errors.route_id}>
        <select className="input" value={form.route_id} onChange={set('route_id')}>
          {routes.map((r) => <option key={r.id} value={r.id}>{r.route_number} · {r.start_point} to {r.end_point}</option>)}
        </select>
      </Field>
      <div className="form-grid">
        <Field label="Seat capacity" error={errors.seat_capacity}>
          <input className="input" type="number" min="1" max="80" value={form.seat_capacity} onChange={set('seat_capacity')} />
        </Field>
        <Field label="Reservable seats" error={errors.reservable_seats} hint="0 for ordinary city buses">
          <input className="input" type="number" min="0" max="80" value={form.reservable_seats} onChange={set('reservable_seats')} />
        </Field>
      </div>
    </Modal>
  )
}

export default function Vehicles() {
  const { data, loading, error, reload } = useLoad(async () => {
    const [vehicles, routes] = await Promise.all([api('/vehicles'), api('/routes')])
    return { vehicles, routes }
  })
  const [form, setForm] = useState(null) // null | 'new' | vehicle

  if (loading && !data) return <Spinner />
  const routes = data?.routes || []

  return (
    <>
      <PageHeader title="Vehicles" subtitle="Buses of your company" actions={<Button onClick={() => setForm('new')} disabled={!routes.length}>Register vehicle</Button>} />
      <ErrorBox error={error} onRetry={reload} />
      <Card flush>
        <Table
          empty="No vehicles yet. Register your first bus."
          rows={data?.vehicles || []}
          columns={[
            { key: 'reg', title: 'Registration', render: (v) => <strong>{v.registration_no}</strong> },
            { key: 'route', title: 'Route', render: (v) => v.route_number },
            { key: 'seats', title: 'Seats', render: (v) => `${v.seat_capacity} (${v.reservable_seats} reservable)` },
            { key: 'status', title: 'Status', render: (v) => <Badge tone={STATUS_TONE[v.status] || 'gray'}>{label(v.status)}</Badge> },
            { key: 'live', title: 'Now', render: (v) => <Badge tone={LIVE[v.live_status]?.tone || 'gray'}>{LIVE[v.live_status]?.label || '-'}</Badge> },
            { key: 'act', title: '', render: (v) => <button className="link-btn" onClick={() => setForm(v)}>Edit</button> },
          ]}
        />
      </Card>
      {form && (
        <VehicleForm
          vehicle={form === 'new' ? null : form}
          routes={routes}
          onClose={() => setForm(null)}
          onSaved={() => { setForm(null); reload() }}
        />
      )}
    </>
  )
}
