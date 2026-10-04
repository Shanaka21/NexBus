import { useState } from 'react'
import { api } from '../api'
import { useAuth } from '../auth'
import { useFleet, POLL_MS } from '../useFleet'
import { FleetMap } from '../LiveMap'
import { LIVE, ago, label } from '../format'
import { Badge, Button, Card, ErrorBox, PageHeader, Spinner, Table, useToast } from '../ui'

const VEHICLE_STATUS = ['active', 'emergency', 'inactive']

export default function FleetMonitor() {
  const { user } = useAuth()
  const toast = useToast()
  const { fleet, loading, live, error } = useFleet(user)
  const [selectedId, setSelectedId] = useState(null)
  const [runningOnly, setRunningOnly] = useState(false)
  const [busy, setBusy] = useState(false)

  const rows = runningOnly ? fleet.filter((f) => f.running) : fleet
  const selected = fleet.find((f) => f.id === selectedId)

  const setStatus = async (status) => {
    setBusy(true)
    try {
      await api(`/buses/${selected.id}/status`, { method: 'PUT', body: { status } })
      toast(`${selected.registration_no} marked ${status}`)
    } catch (err) {
      toast(err.message, 'error')
    } finally {
      setBusy(false)
    }
  }

  if (loading) return <Spinner />

  return (
    <>
      <PageHeader
        title="Fleet Monitor"
        subtitle={`${fleet.filter((f) => f.running).length} of ${fleet.length} buses running`}
        actions={
          <>
            <label className="muted"><input type="checkbox" checked={runningOnly} onChange={(e) => setRunningOnly(e.target.checked)} /> Running only</label>
            <span className="live-pill"><span className={`live-dot${live ? '' : ' off'}`} />{live ? 'Live' : `Updating every ${POLL_MS / 1000} s`}</span>
          </>
        }
      />
      <ErrorBox error={error} />

      <div className="two-col">
        <Card flush>
          <FleetMap buses={rows} selectedId={selectedId} onSelect={setSelectedId} className="map-box tall" />
        </Card>

        <div>
          {selected && (
            <Card
              title={`${selected.registration_no} · Route ${selected.route_number}`}
              actions={<button className="icon-btn" onClick={() => setSelectedId(null)} aria-label="Close">✕</button>}
            >
              <p><Badge tone={LIVE[selected.live].tone}>{LIVE[selected.live].label}</Badge></p>
              <p className="muted" style={{ marginTop: 10 }}>
                Driver: {selected.driver_name || '-'}<br />
                {selected.reservable > 0 && <>Seats booked: {selected.booked} of {selected.reservable}<br /></>}
                Last update: {ago(selected.last_update_at)}<br />
                Vehicle status: {label(selected.status)}
              </p>
              {user.role === 'operator' && (
                <div className="row-actions" style={{ marginTop: 14, flexWrap: 'wrap' }}>
                  {VEHICLE_STATUS.filter((s) => s !== selected.status).map((s) => (
                    <Button key={s} variant={s === 'emergency' ? 'danger' : 'ghost'} busy={busy} onClick={() => setStatus(s)}>
                      Mark {s}
                    </Button>
                  ))}
                </div>
              )}
            </Card>
          )}

          <Card flush>
            <Table
              empty="No vehicles registered."
              rows={rows}
              onRowClick={(row) => setSelectedId(row.id)}
              columns={[
                { key: 'bus', title: 'Bus', render: (b) => <><strong>{b.registration_no}</strong><span className="cell-sub">Route {b.route_number}{b.driver_name ? ` · ${b.driver_name}` : ''}</span></> },
                { key: 'status', title: 'Status', render: (b) => <Badge tone={LIVE[b.live].tone}>{LIVE[b.live].label}{b.delay_minutes >= 10 ? ` · ${b.delay_minutes}m` : ''}</Badge> },
                { key: 'seats', title: 'Seats', render: (b) => b.reservable ? `${b.booked}/${b.reservable}` : '-' },
                { key: 'up', title: 'Updated', render: (b) => <span className="muted nowrap">{b.running ? ago(b.last_update_at) : '-'}</span> },
              ]}
            />
          </Card>
        </div>
      </div>
    </>
  )
}
