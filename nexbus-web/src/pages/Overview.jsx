import { Link } from 'react-router-dom'
import { api } from '../api'
import { useAuth } from '../auth'
import { useFleet, POLL_MS } from '../useFleet'
import { FleetMap } from '../LiveMap'
import { LIVE, ago } from '../format'
import { Badge, Card, ErrorBox, PageHeader, Spinner, Table, useLoad } from '../ui'

const Stat = ({ label, value, sub, tone }) => (
  <div className={`stat ${tone ? `tone-${tone}` : ''}`}>
    <div className="stat-label">{label}</div>
    <div className="stat-value">{value}</div>
    {sub && <div className="stat-sub">{sub}</div>}
  </div>
)

export default function Overview() {
  const { user } = useAuth()
  const { data: stats, error, reload } = useLoad(() => api('/stats'))
  const { fleet, live } = useFleet(user)
  const running = fleet.filter((f) => f.running)

  if (!stats && !error) return <Spinner />

  return (
    <>
      <PageHeader
        title="Overview"
        subtitle={user.role === 'admin' ? 'All operators' : 'Your fleet today'}
        actions={<span className="live-pill"><span className={`live-dot${live ? '' : ' off'}`} />{live ? 'Live' : `Updating every ${POLL_MS / 1000} s`}</span>}
      />
      <ErrorBox error={error} onRetry={reload} />

      {stats && (
        <div className="stat-grid">
          <Stat label="Buses" value={stats.buses.total} sub={`${stats.buses.active} active`} />
          <Stat label="Running trips" value={stats.trips.running} tone="green" sub={`${stats.trips.scheduled_today} more scheduled today`} />
          <Stat label="Delayed" value={stats.trips.delayed} tone={stats.trips.delayed ? 'amber' : undefined} sub="trips 10+ min late" />
          <Stat label="Emergency / inactive" value={stats.buses.emergency + stats.buses.inactive} tone={stats.buses.emergency ? 'red' : undefined} />
          <Stat label="Bookings today" value={stats.bookings.today} sub={`${stats.bookings.total} in total`} />
          <Stat label="Awaiting payment" value={stats.bookings.pending_payment} tone={stats.bookings.pending_payment ? 'amber' : undefined} />
          <Stat label="Confirmed" value={stats.bookings.confirmed} tone="green" />
          <Stat label="Completed / cancelled" value={`${stats.bookings.completed} / ${stats.bookings.cancelled}`} />
        </div>
      )}

      <div className="two-col">
        <Card title="Live map" actions={<Link className="link-btn" to="/fleet">Open Fleet Monitor</Link>}>
          <FleetMap buses={fleet.filter((f) => f.running)} />
        </Card>

        <Card title={`Running now (${running.length})`} flush>
          <Table
            empty="No buses are running right now."
            rows={running}
            columns={[
              { key: 'bus', title: 'Bus', render: (b) => <><strong>{b.registration_no}</strong><span className="cell-sub">Route {b.route_number}</span></> },
              { key: 'status', title: 'Status', render: (b) => <Badge tone={LIVE[b.live].tone}>{LIVE[b.live].label}{b.delay_minutes >= 10 ? ` · ${b.delay_minutes}m` : ''}</Badge> },
              { key: 'up', title: 'Updated', render: (b) => <span className="muted">{ago(b.last_update_at)}</span> },
            ]}
          />
        </Card>
      </div>
    </>
  )
}
