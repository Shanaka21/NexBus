import { useState } from 'react'
import { api } from '../api'
import { Badge, Button, Card, ErrorBox, Field, Modal, PageHeader, Spinner, Table, useLoad, useToast } from '../ui'

function DriverForm({ onClose, onSaved }) {
  const toast = useToast()
  const [form, setForm] = useState({ full_name: '', email: '', phone: '', password: '' })
  const [busy, setBusy] = useState(false)
  const [errors, setErrors] = useState({})
  const set = (key) => (e) => setForm({ ...form, [key]: e.target.value })

  const save = async () => {
    const next = {}
    if (form.full_name.trim().length < 2) next.full_name = 'Enter the driver name'
    if (!/^\S+@\S+\.\S+$/.test(form.email)) next.email = 'Enter a valid email'
    if (form.password.length < 6) next.password = 'At least 6 characters'
    setErrors(next)
    if (Object.keys(next).length) return

    setBusy(true)
    try {
      await api('/operator/drivers', { method: 'POST', body: { ...form, full_name: form.full_name.trim(), email: form.email.trim() } })
      toast('Driver account created')
      onSaved()
    } catch (err) {
      toast(err.message, 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      title="New driver account"
      onClose={onClose}
      footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button busy={busy} onClick={save}>Create account</Button></>}
    >
      <Field label="Full name" error={errors.full_name}><input className="input" value={form.full_name} onChange={set('full_name')} /></Field>
      <Field label="Email" error={errors.email}><input className="input" type="email" value={form.email} onChange={set('email')} /></Field>
      <div className="form-grid">
        <Field label="Phone"><input className="input" value={form.phone} onChange={set('phone')} placeholder="07X XXX XXXX" /></Field>
        <Field label="Initial password" error={errors.password} hint="The driver signs in to the mobile app with it">
          <input className="input" type="password" value={form.password} onChange={set('password')} autoComplete="new-password" />
        </Field>
      </div>
    </Modal>
  )
}

export default function Drivers() {
  const { data, loading, error, reload } = useLoad(() => api('/operator/drivers'))
  const [open, setOpen] = useState(false)

  if (loading && !data) return <Spinner />
  return (
    <>
      <PageHeader title="Drivers" subtitle="Driver accounts of your company" actions={<Button onClick={() => setOpen(true)}>New driver</Button>} />
      <ErrorBox error={error} onRetry={reload} />
      <Card flush>
        <Table
          empty="No drivers yet. Create an account for each driver or conductor."
          rows={data || []}
          rowKey="uid"
          columns={[
            { key: 'name', title: 'Name', render: (d) => <strong>{d.full_name}</strong> },
            { key: 'email', title: 'Email', render: (d) => d.email },
            { key: 'phone', title: 'Phone', render: (d) => d.phone || '-' },
            { key: 'status', title: 'Status', render: (d) => <Badge tone={d.status === 'disabled' ? 'red' : 'green'}>{d.status || 'active'}</Badge> },
          ]}
        />
      </Card>
      {open && <DriverForm onClose={() => setOpen(false)} onSaved={() => { setOpen(false); reload() }} />}
    </>
  )
}
