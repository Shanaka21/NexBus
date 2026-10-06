import { Link } from 'react-router-dom'
import { api } from '../api'
import { useAuth } from '../auth'
import { useFleet, POLL_MS } from '../useFleet'
import { FleetMap } from '../LiveMap'
import { LIVE, ago } from '../format'
import { AlertIcon, BusIcon, CalendarIcon, CheckIcon, ClockIcon, TicketIcon, WalletIcon } from '../icons'
import { Badge, Card, ErrorBox, PageHeader, Spinner, Table, useLoad } from '../ui'

const Stat = ({ label, value, sub, tone, Icon }) => (
  <div className={`stat ${tone ? `tone-${tone}` : ''}`}>
    <div className="stat-top">
      <div className="stat-label">{label}</div>
      {Icon && <span className="stat-icon"><Icon size={18} /></span>}
    </div>
    <div className="stat-value">{value}</div>
    {sub && <div className="stat-sub">{sub}</div>}
  </div>
)

const greeting = () => {
  const h = Number(new Date().toLocaleString('en-GB', { hour: 'numeric', hour12: false, timeZone: 'Asia/Colombo' }))
  return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening'
}

const today = () => new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Asia/Colombo' })

const StatusSummary = ({ buses }) => {
  const count = (key) => buses.filter((b) => b.live === key).length
  return (
    <div className="status-summary">
      <Badge tone="green">{count('on_time')} on time</Badge>
      <Badge tone="amber">{count('delayed')} delayed</Badge>
    </div>
  )
}

export default function Overview() {
  const { user } = useAuth()
  const { data: stats, error, reload } = useLoad(() => api('/stats'))
  const { fleet, live } = useFleet(user)
  const running = fleet.filter((f) => f.running)

  if (!stats && !error) return <Spinner />

  return (
    <>
      <PageHeader
        title={`${greeting()}, ${user.name.split(' ')[0]}`}
        subtitle={`${today()} · ${user.role === 'admin' ? 'All operators' : 'Your fleet today'}`}
        actions={<span className="live-pill"><span className={`live-dot${live ? '' : ' off'}`} />{live ? 'Live' : `Updating every ${POLL_MS / 1000} s`}</span>}
      />
      <ErrorBox error={error} onRetry={reload} />

      {stats && (
        <div className="stat-grid">
          <Stat Icon={BusIcon} label="Buses" value={stats.buses.total} sub={`${stats.buses.active} active`} />
          <Stat Icon={CalendarIcon} label="Running trips" value={stats.trips.running} tone="green" sub={`${stats.trips.scheduled_today} more scheduled today`} />
          <Stat Icon={ClockIcon} label="Delayed" value={stats.trips.delayed} tone={stats.trips.delayed ? 'amber' : undefined} sub="trips 10+ min late" />
          <Stat Icon={AlertIcon} label="Emergency / inactive" value={stats.buses.emergency + stats.buses.inactive} tone={stats.buses.emergency ? 'red' : undefined} />
          <Stat Icon={TicketIcon} label="Bookings today" value={stats.bookings.today} sub={`${stats.bookings.total} in total`} />
          <Stat Icon={WalletIcon} label="Awaiting payment" value={stats.bookings.pending_payment} tone={stats.bookings.pending_payment ? 'amber' : undefined} />
          <Stat Icon={CheckIcon} label="Confirmed" value={stats.bookings.confirmed} tone="green" />
          <Stat Icon={CheckIcon} label="Completed / cancelled" value={`${stats.bookings.completed} / ${stats.bookings.cancelled}`} />
        </div>
      )}

      <div className="two-col">
        <Card title="Live map" actions={<Link className="link-btn" to="/fleet">Open Fleet Monitor</Link>}>
          <FleetMap buses={fleet.filter((f) => f.running)} />
        </Card>

        <Card title={`Running now (${running.length})`} actions={<StatusSummary buses={running} />} flush>
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
