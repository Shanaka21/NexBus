import { useState } from 'react'
import { api } from '../api'
import { dateTime } from '../format'
import { Badge, Card, ErrorBox, PageHeader, Spinner, Table, useLoad } from '../ui'

const SEVERITY_TONE = { info: 'gray', warning: 'amber', security: 'red' }

export default function AuditLogs() {
  const [action, setAction] = useState('')
  const [severity, setSeverity] = useState('')
  const [userId, setUserId] = useState('')
  const query = [action && `action=${encodeURIComponent(action.trim())}`, severity && `severity=${severity}`, userId && `user_id=${encodeURIComponent(userId.trim())}`]
    .filter(Boolean).concat('limit=200').join('&')
  const { data, loading, error, reload } = useLoad(() => api(`/admin/logs?${query}`), [query])

  return (
    <>
      <PageHeader title="Audit logs" subtitle="Security-relevant actions: sign-ins, bookings, payments, denied requests" />
      <ErrorBox error={error} onRetry={reload} />
      <Card
        title="Events"
        actions={
          <div className="filters">
            <input className="input" placeholder="Action, e.g. PAYMENT" value={action} onChange={(e) => setAction(e.target.value)} />
            <select className="input" value={severity} onChange={(e) => setSeverity(e.target.value)}>
              <option value="">All severities</option>
              <option value="info">Info</option>
              <option value="warning">Warning</option>
              <option value="security">Security</option>
            </select>
            <input className="input" placeholder="User id" value={userId} onChange={(e) => setUserId(e.target.value)} />
          </div>
        }
        flush
      >
        {loading && !data ? <Spinner /> : (
          <Table
            empty="No events match these filters."
            rows={data || []}
            columns={[
              { key: 'time', title: 'Time', render: (l) => <span className="nowrap">{dateTime(l.created_at)}</span> },
              { key: 'action', title: 'Action', render: (l) => <strong>{l.action}</strong> },
              { key: 'sev', title: 'Severity', render: (l) => <Badge tone={SEVERITY_TONE[l.severity] || 'gray'}>{l.severity}</Badge> },
              { key: 'entity', title: 'Entity', render: (l) => <>{l.entity || '-'}<span className="cell-sub">{l.entity_id}</span></> },
              { key: 'user', title: 'User', render: (l) => <span className="muted">{l.user_id || '-'}</span> },
              { key: 'details', title: 'Details', render: (l) => l.details ? <code>{JSON.stringify(l.details)}</code> : '' },
            ]}
          />
        )}
      </Card>
    </>
  )
}
