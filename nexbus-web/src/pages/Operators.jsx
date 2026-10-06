import { useState } from 'react'
import { api } from '../api'
import { dateTime } from '../format'
import { Badge, Button, Card, ErrorBox, Field, Modal, PageHeader, SearchInput, Spinner, Table, matches, useLoad, useToast } from '../ui'

function OperatorForm({ onClose, onSaved }) {
  const toast = useToast()
  const [form, setForm] = useState({ name: '', registration_no: '', contact_phone: '', email: '' })
  const [busy, setBusy] = useState(false)
  const [errors, setErrors] = useState({})
  const set = (key) => (e) => setForm({ ...form, [key]: e.target.value })

  const save = async () => {
    const next = {}
    if (form.name.trim().length < 2) next.name = 'Enter the company name'
    if (form.registration_no.trim().length < 2) next.registration_no = 'Enter the registration number'
    if (form.email && !/^\S+@\S+\.\S+$/.test(form.email)) next.email = 'Enter a valid email'
    setErrors(next)
    if (Object.keys(next).length) return

    setBusy(true)
    const body = Object.fromEntries(Object.entries(form).filter(([, v]) => v.trim() !== '').map(([k, v]) => [k, v.trim()]))
    try {
      await api('/admin/operators', { method: 'POST', body })
      toast('Operator registered')
      onSaved()
    } catch (err) {
      toast(err.message, 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      title="Register operator company"
      onClose={onClose}
      footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button busy={busy} onClick={save}>Register</Button></>}
    >
      <Field label="Company name" error={errors.name}><input className="input" value={form.name} onChange={set('name')} /></Field>
      <Field label="Registration number" error={errors.registration_no}><input className="input" value={form.registration_no} onChange={set('registration_no')} /></Field>
      <div className="form-grid">
        <Field label="Contact phone"><input className="input" value={form.contact_phone} onChange={set('contact_phone')} /></Field>
        <Field label="Contact email" error={errors.email}><input className="input" type="email" value={form.email} onChange={set('email')} /></Field>
      </div>
    </Modal>
  )
}

export default function Operators() {
  const { data, loading, error, reload } = useLoad(() => api('/admin/operators'))
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const rows = (data || []).filter((o) => matches(query, o.name, o.registration_no, o.contact_phone, o.email))

  if (loading && !data) return <Spinner />
  return (
    <>
      <PageHeader title="Operators" subtitle="Bus operating companies" actions={<Button onClick={() => setOpen(true)}>Register operator</Button>} />
      <ErrorBox error={error} onRetry={reload} />
      <Card title={`Companies (${rows.length})`} actions={<SearchInput value={query} onChange={setQuery} placeholder="Search companies" />} flush>
        <Table
          empty="No operators yet."
          rows={rows}
          columns={[
            { key: 'name', title: 'Company', render: (o) => <strong>{o.name}</strong> },
            { key: 'reg', title: 'Registration', render: (o) => o.registration_no },
            { key: 'contact', title: 'Contact', render: (o) => <>{o.contact_phone || '-'}<span className="cell-sub">{o.email}</span></> },
            { key: 'status', title: 'Status', render: (o) => <Badge tone={o.status === 'active' ? 'green' : 'gray'}>{o.status}</Badge> },
            { key: 'created', title: 'Registered', render: (o) => dateTime(o.created_at) },
          ]}
        />
      </Card>
      {open && <OperatorForm onClose={() => setOpen(false)} onSaved={() => { setOpen(false); reload() }} />}
    </>
  )
}
