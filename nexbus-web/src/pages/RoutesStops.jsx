import { useState } from 'react'
import { CloseIcon } from '../icons'
import { api } from '../api'
import { useAuth } from '../auth'
import { SERVICE_TYPES, COLOMBO, haversineKm, lkr, label } from '../format'
import { StopsMap } from '../LiveMap'
import { Badge, Button, Card, ErrorBox, Field, Modal, PageHeader, Spinner, Table, useLoad, useToast } from '../ui'

function StopForm({ onClose, onSaved }) {
  const toast = useToast()
  const [form, setForm] = useState({ name: '', name_si: '', latitude: COLOMBO[0], longitude: COLOMBO[1] })
  const [busy, setBusy] = useState(false)
  const [errors, setErrors] = useState({})
  const set = (key) => (e) => setForm({ ...form, [key]: e.target.value })

  const save = async () => {
    const next = {}
    const lat = Number(form.latitude)
    const lng = Number(form.longitude)
    if (!form.name.trim()) next.name = 'Enter the stop name'
    if (!(lat >= 5.9 && lat <= 9.9)) next.latitude = 'Latitude must be within Sri Lanka (5.9 to 9.9)'
    if (!(lng >= 79.5 && lng <= 81.9)) next.longitude = 'Longitude must be within Sri Lanka (79.5 to 81.9)'
    setErrors(next)
    if (Object.keys(next).length) return

    setBusy(true)
    try {
      await api('/stops', { method: 'POST', body: { name: form.name.trim(), name_si: form.name_si.trim(), latitude: lat, longitude: lng } })
      toast('Stop added')
      onSaved()
    } catch (err) {
      toast(err.message, 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      title="Add a bus stop"
      onClose={onClose}
      footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button busy={busy} onClick={save}>Add stop</Button></>}
    >
      <div className="form-grid">
        <Field label="Name (English)" error={errors.name}><input className="input" value={form.name} onChange={set('name')} /></Field>
        <Field label="Name (Sinhala)"><input className="input" value={form.name_si} onChange={set('name_si')} /></Field>
      </div>
      <p className="muted">Click the map to place the stop, or type the coordinates.</p>
      <StopsMap
        stops={[]}
        pick={[Number(form.latitude), Number(form.longitude)]}
        onPick={([latitude, longitude]) => setForm({ ...form, latitude: latitude.toFixed(5), longitude: longitude.toFixed(5) })}
      />
      <div className="form-grid">
        <Field label="Latitude" error={errors.latitude}><input className="input" value={form.latitude} onChange={set('latitude')} /></Field>
        <Field label="Longitude" error={errors.longitude}><input className="input" value={form.longitude} onChange={set('longitude')} /></Field>
      </div>
    </Modal>
  )
}

function RouteForm({ route, stops, onClose, onSaved }) {
  const toast = useToast()
  const editing = !!route
  const [form, setForm] = useState({
    route_number: route?.route_number || '',
    route_name: route?.route_name || '',
    service_type: route?.service_type || 'normal',
    base_fare_lkr: route?.base_fare_lkr || '',
    estimated_duration_min: route?.estimated_duration_min || '',
  })
  const [stopIds, setStopIds] = useState(route ? route.stops.map((s) => s.stopId) : [])
  const [adding, setAdding] = useState('')
  const [busy, setBusy] = useState(false)
  const [errors, setErrors] = useState({})
  const set = (key) => (e) => setForm({ ...form, [key]: e.target.value })

  const byId = Object.fromEntries(stops.map((s) => [s.id, s]))
  const ordered = stopIds.map((id) => ({ stopId: id, name: byId[id]?.name, nameSi: byId[id]?.name_si, lat: byId[id]?.latitude, lng: byId[id]?.longitude }))
  const approxKm = ordered.slice(1).reduce((sum, s, i) => sum + haversineKm(ordered[i], s), 0)
  const available = stops.filter((s) => !stopIds.includes(s.id))

  const move = (index, delta) => {
    const next = [...stopIds]
    const target = index + delta
    if (target < 0 || target >= next.length) return
    ;[next[index], next[target]] = [next[target], next[index]]
    setStopIds(next)
  }

  const save = async () => {
    const next = {}
    if (!form.route_number.trim()) next.route_number = 'Enter the route number'
    if (!(Number(form.base_fare_lkr) > 0)) next.base_fare_lkr = 'Enter the fare per seat'
    if (!(Number(form.estimated_duration_min) > 0)) next.estimated_duration_min = 'Enter the planned duration'
    if (stopIds.length < 2) next.stops = 'A route needs at least 2 stops'
    setErrors(next)
    if (Object.keys(next).length) return

    setBusy(true)
    const body = {
      route_number: form.route_number.trim(),
      service_type: form.service_type,
      base_fare_lkr: Number(form.base_fare_lkr),
      estimated_duration_min: Number(form.estimated_duration_min),
      stop_ids: stopIds,
      ...(form.route_name.trim() ? { route_name: form.route_name.trim() } : {}),
    }
    try {
      await api(editing ? `/routes/${route.id}` : '/routes', { method: editing ? 'PUT' : 'POST', body })
      toast(editing ? 'Route updated' : 'Route created')
      onSaved()
    } catch (err) {
      toast(err.message, 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      title={editing ? `Edit route ${route.route_number}` : 'New route'}
      width={760}
      onClose={onClose}
      footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button busy={busy} onClick={save}>Save route</Button></>}
    >
      <div className="form-grid">
        <Field label="Route number" error={errors.route_number}><input className="input" value={form.route_number} onChange={set('route_number')} placeholder="138" /></Field>
        <Field label="Service type">
          <select className="input" value={form.service_type} onChange={set('service_type')}>
            {SERVICE_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </Field>
        <Field label="Route name" hint="Optional. Defaults to first stop - last stop"><input className="input" value={form.route_name} onChange={set('route_name')} /></Field>
        <div className="form-grid">
          <Field label="Fare per seat (LKR)" error={errors.base_fare_lkr}><input className="input" type="number" min="1" value={form.base_fare_lkr} onChange={set('base_fare_lkr')} /></Field>
          <Field label="Duration (min)" error={errors.estimated_duration_min}><input className="input" type="number" min="1" value={form.estimated_duration_min} onChange={set('estimated_duration_min')} /></Field>
        </div>
      </div>

      <Field label="Stops in order" error={errors.stops} hint={stopIds.length > 1 ? `About ${approxKm.toFixed(1)} km in a straight line. The exact distances are calculated when you save.` : undefined}>
        <div className="stop-list">
          {ordered.map((s, i) => (
            <div className="stop-item" key={s.stopId}>
              <span className="num">{i + 1}</span>
              <span className="grow">{s.name}{s.nameSi ? ` · ${s.nameSi}` : ''}</span>
              <button className="icon-btn" onClick={() => move(i, -1)} disabled={i === 0} aria-label="Move up">↑</button>
              <button className="icon-btn" onClick={() => move(i, 1)} disabled={i === ordered.length - 1} aria-label="Move down">↓</button>
              <button className="icon-btn" onClick={() => setStopIds(stopIds.filter((id) => id !== s.stopId))} aria-label="Remove stop"><CloseIcon size={14} /></button>
            </div>
          ))}
        </div>
      </Field>

      <div className="filters">
        <select className="input" value={adding} onChange={(e) => setAdding(e.target.value)} style={{ flex: 1 }}>
          <option value="">Add a stop...</option>
          {available.map((s) => <option key={s.id} value={s.id}>{s.name}{s.name_si ? ` · ${s.name_si}` : ''}</option>)}
        </select>
        <Button variant="ghost" disabled={!adding} onClick={() => { setStopIds([...stopIds, adding]); setAdding('') }}>Add</Button>
      </div>

      <StopsMap stops={ordered} />
    </Modal>
  )
}

export default function RoutesStops() {
  const { user } = useAuth()
  const toast = useToast()
  const { data, loading, error, reload } = useLoad(async () => {
    const [routes, stops] = await Promise.all([api('/routes'), api('/stops')])
    return { routes, stops }
  })
  const [routeForm, setRouteForm] = useState(null) // null | 'new' | route
  const [stopForm, setStopForm] = useState(false)

  const deactivate = async (route) => {
    if (!window.confirm(`Deactivate route ${route.route_number}? Passengers will no longer see it.`)) return
    try {
      await api(`/routes/${route.id}`, { method: 'DELETE' })
      toast('Route deactivated')
      reload()
    } catch (err) {
      toast(err.message, 'error')
    }
  }

  if (loading && !data) return <Spinner />
  const { routes = [], stops = [] } = data || {}

  return (
    <>
      <PageHeader
        title="Routes & Stops"
        subtitle="Stop order and coordinates drive arrival estimates, so keep them accurate"
        actions={<><Button variant="ghost" onClick={() => setStopForm(true)}>Add stop</Button><Button onClick={() => setRouteForm('new')} disabled={stops.length < 2}>New route</Button></>}
      />
      <ErrorBox error={error} onRetry={reload} />

      <Card title={`Routes (${routes.length})`} flush>
        <Table
          empty="No routes yet."
          rows={routes}
          columns={[
            { key: 'no', title: 'Route', render: (r) => <strong>{r.route_number}</strong> },
            { key: 'name', title: 'Name', render: (r) => <>{r.route_name}<span className="cell-sub">{(r.stops || []).map((s) => s.name).join(' › ') || 'no stops yet'}</span></> },
            { key: 'type', title: 'Type', render: (r) => <Badge tone="blue">{label(r.service_type)}</Badge> },
            { key: 'fare', title: 'Fare', render: (r) => lkr(r.base_fare_lkr) },
            { key: 'dist', title: 'Distance / time', render: (r) => r.distance_km ? `${r.distance_km} km · ${r.estimated_duration_min} min` : '-' },
            {
              key: 'act', title: '',
              render: (r) => (
                <div className="row-actions">
                  {(r.stops || []).length >= 2 && <button className="link-btn" onClick={() => setRouteForm(r)}>Edit</button>}
                  {user.role === 'admin' && <button className="link-btn" onClick={() => deactivate(r)}>Deactivate</button>}
                </div>
              ),
            },
          ]}
        />
      </Card>

      <Card title={`Bus stops (${stops.length})`} flush>
        <Table
          empty="No stops yet."
          rows={stops}
          columns={[
            { key: 'name', title: 'Stop', render: (s) => <strong>{s.name}</strong> },
            { key: 'si', title: 'Sinhala', render: (s) => s.name_si || '-' },
            { key: 'pos', title: 'Coordinates', render: (s) => `${s.latitude}, ${s.longitude}` },
          ]}
        />
      </Card>

      {routeForm && (
        <RouteForm
          route={routeForm === 'new' ? null : routeForm}
          stops={stops}
          onClose={() => setRouteForm(null)}
          onSaved={() => { setRouteForm(null); reload() }}
        />
      )}
      {stopForm && <StopForm onClose={() => setStopForm(false)} onSaved={() => { setStopForm(false); reload() }} />}
    </>
  )
}
