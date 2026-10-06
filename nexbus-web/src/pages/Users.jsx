import { useState } from 'react'
import { api } from '../api'
import { useAuth } from '../auth'
import { dateTime, label } from '../format'
import { Badge, Button, Card, ErrorBox, Field, Modal, PageHeader, SearchInput, Spinner, Table, matches, useLoad, useToast } from '../ui'

function UserForm({ operators, onClose, onSaved }) {
  const toast = useToast()
  const [form, setForm] = useState({ full_name: '', email: '', phone: '', password: '', role: 'operator', operator_id: operators[0]?.id || '' })
  const [busy, setBusy] = useState(false)
  const [errors, setErrors] = useState({})
  const set = (key) => (e) => setForm({ ...form, [key]: e.target.value })

  const save = async () => {
    const next = {}
    if (form.full_name.trim().length < 2) next.full_name = 'Enter the full name'
    if (!/^\S+@\S+\.\S+$/.test(form.email)) next.email = 'Enter a valid email'
    if (form.password.length < 6) next.password = 'At least 6 characters'
    if (form.role === 'operator' && !form.operator_id) next.operator_id = 'Register an operator company first'
    setErrors(next)
    if (Object.keys(next).length) return

    setBusy(true)
    const body = { full_name: form.full_name.trim(), email: form.email.trim(), password: form.password, role: form.role, phone: form.phone }
    if (form.role === 'operator') body.operator_id = form.operator_id
    try {
      await api('/admin/users', { method: 'POST', body })
      toast('Account created')
      onSaved()
    } catch (err) {
      toast(err.message, 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      title="New staff account"
      onClose={onClose}
      footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button busy={busy} onClick={save}>Create account</Button></>}
    >
      <div className="form-grid">
        <Field label="Full name" error={errors.full_name}><input className="input" value={form.full_name} onChange={set('full_name')} /></Field>
        <Field label="Role">
          <select className="input" value={form.role} onChange={set('role')}>
            <option value="operator">Operator</option>
            <option value="admin">Administrator</option>
          </select>
        </Field>
        <Field label="Email" error={errors.email}><input className="input" type="email" value={form.email} onChange={set('email')} /></Field>
        <Field label="Phone"><input className="input" value={form.phone} onChange={set('phone')} /></Field>
        {form.role === 'operator' && (
          <Field label="Company" error={errors.operator_id}>
            <select className="input" value={form.operator_id} onChange={set('operator_id')}>
              {operators.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
            </select>
          </Field>
        )}
        <Field label="Initial password" error={errors.password}>
          <input className="input" type="password" value={form.password} onChange={set('password')} autoComplete="new-password" />
        </Field>
      </div>
    </Modal>
  )
}

export default function Users() {
  const { user } = useAuth()
  const toast = useToast()
  const [role, setRole] = useState('')
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [busyId, setBusyId] = useState(null)

  const operators = useLoad(() => api('/admin/operators'))
  const users = useLoad(() => api(`/admin/users${role ? `?role=${role}` : ''}`), [role])
  const companyName = Object.fromEntries((operators.data || []).map((o) => [o.id, o.name]))

  const visible = (users.data || []).filter((u) => matches(query, u.full_name, u.email, u.phone, companyName[u.operator_id]))

  const toggle = async (u) => {
    const disabling = u.status !== 'disabled'
    if (disabling && !window.confirm(`Disable ${u.full_name}? They will be signed out and cannot sign in again.`)) return
    setBusyId(u.uid)
    try {
      await api(`/admin/users/${u.uid}/status`, { method: 'PATCH', body: { status: disabling ? 'disabled' : 'active' } })
      toast(disabling ? 'Account disabled' : 'Account enabled')
      users.reload()
    } catch (err) {
      toast(err.message, 'error')
    } finally {
      setBusyId(null)
    }
  }

  return (
    <>
      <PageHeader title="Users" subtitle="Control who can access NexBus" actions={<Button onClick={() => setOpen(true)}>New staff account</Button>} />
      <ErrorBox error={users.error} onRetry={users.reload} />
      <Card
        title={`Accounts (${visible.length})`}
        actions={
          <>
            <SearchInput value={query} onChange={setQuery} placeholder="Search name or email" />
            <select className="input" value={role} onChange={(e) => setRole(e.target.value)} style={{ width: 'auto' }}>
            <option value="">All roles</option>
            {['passenger', 'driver', 'operator', 'admin'].map((r) => <option key={r} value={r}>{label(r)}</option>)}
          </select>
          </>
        }
        flush
      >
        {users.loading && !users.data ? <Spinner /> : (
          <Table
            empty="No accounts."
            rows={visible}
            rowKey="uid"
            columns={[
              { key: 'name', title: 'Name', render: (u) => <span className="person"><span className="avatar avatar-sm">{u.full_name.split(/s+/).filter(Boolean).slice(0, 2).map((p) => p[0].toUpperCase()).join('')}</span><strong>{u.full_name}</strong></span> },
              { key: 'email', title: 'Email', render: (u) => <>{u.email}<span className="cell-sub">{u.phone}</span></> },
              { key: 'role', title: 'Role', render: (u) => <Badge tone={u.role === 'admin' ? 'red' : u.role === 'operator' ? 'blue' : 'gray'}>{u.role}</Badge> },
              { key: 'company', title: 'Company', render: (u) => companyName[u.operator_id] || '-' },
              { key: 'status', title: 'Status', render: (u) => <Badge tone={u.status === 'disabled' ? 'red' : 'green'}>{u.status}</Badge> },
              { key: 'created', title: 'Created', render: (u) => dateTime(u.created_at) },
              {
                key: 'act', title: '',
                render: (u) => u.uid !== user.uid && (
                  <Button variant="ghost" className="btn-sm" busy={busyId === u.uid} onClick={() => toggle(u)}>
                    {u.status === 'disabled' ? 'Enable' : 'Disable'}
                  </Button>
                ),
              },
            ]}
          />
        )}
      </Card>
      {open && <UserForm operators={operators.data || []} onClose={() => setOpen(false)} onSaved={() => { setOpen(false); users.reload() }} />}
    </>
  )
}
