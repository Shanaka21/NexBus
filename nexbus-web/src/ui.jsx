import { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react'

export function Modal({ title, onClose, children, footer, width = 520 }) {
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="overlay" onMouseDown={onClose}>
      <div className="modal" style={{ maxWidth: width }} role="dialog" aria-modal="true" aria-label={title} onMouseDown={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h3>{title}</h3>
          <button className="icon-btn" onClick={onClose} aria-label="Close">✕</button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-foot">{footer}</div>}
      </div>
    </div>
  )
}

export function Field({ label, hint, error, children }) {
  return (
    <label className="field">
      <span className="field-label">{label}</span>
      {children}
      {hint && !error && <span className="field-hint">{hint}</span>}
      {error && <span className="field-error">{error}</span>}
    </label>
  )
}

export function Badge({ tone = 'gray', children }) {
  return <span className={`badge badge-${tone}`}>{children}</span>
}

export function Button({ variant = 'primary', busy, className = '', children, ...props }) {
  return (
    <button {...props} className={`btn btn-${variant} ${className}`.trim()} disabled={busy || props.disabled}>
      {busy && <span className="spinner spinner-sm" />}
      {children}
    </button>
  )
}

export function Spinner() {
  return <div className="center-pad"><span className="spinner" /></div>
}

export function Empty({ children }) {
  return <div className="empty">{children}</div>
}

export function PageHeader({ title, subtitle, actions }) {
  return (
    <div className="page-head">
      <div>
        <h1>{title}</h1>
        {subtitle && <p className="muted">{subtitle}</p>}
      </div>
      {actions && <div className="page-actions">{actions}</div>}
    </div>
  )
}

export const Card = ({ title, actions, children, flush }) => (
  <section className="card">
    {(title || actions) && (
      <div className="card-head">
        <h2>{title}</h2>
        <div className="page-actions">{actions}</div>
      </div>
    )}
    <div className={flush ? '' : 'card-body'}>{children}</div>
  </section>
)

export const ErrorBox = ({ error, onRetry }) => error ? (
  <div className="error-box">
    <span>{error}</span>
    {onRetry && <button className="btn btn-ghost btn-sm" onClick={onRetry}>Retry</button>}
  </div>
) : null

// --- toasts -----------------------------------------------------------------
const ToastContext = createContext(() => {})

export function ToastProvider({ children }) {
  const [items, setItems] = useState([])
  const counter = useRef(0)

  const push = useCallback((message, tone = 'success') => {
    const id = ++counter.current
    setItems((list) => [...list, { id, message, tone }])
    setTimeout(() => setItems((list) => list.filter((t) => t.id !== id)), 4500)
  }, [])

  return (
    <ToastContext.Provider value={push}>
      {children}
      <div className="toasts" aria-live="polite">
        {items.map((t) => <div key={t.id} className={`toast toast-${t.tone}`}>{t.message}</div>)}
      </div>
    </ToastContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export const useToast = () => useContext(ToastContext)

// --- data loading -----------------------------------------------------------
// useLoad(fn, deps): runs fn on mount and whenever deps change; reload() runs it again.
// While a new request is running the previous data stays available (loading is true).
// eslint-disable-next-line react-refresh/only-export-components
export function useLoad(fn, deps = []) {
  const [version, setVersion] = useState(0)
  const [result, setResult] = useState({ key: null, data: null, error: null })
  const key = JSON.stringify([...deps, version])

  useEffect(() => {
    let cancelled = false
    fn()
      .then((data) => { if (!cancelled) setResult({ key, data, error: null }) })
      .catch((err) => { if (!cancelled) setResult((r) => ({ key, data: r.data, error: err.message })) })
    return () => { cancelled = true }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  const reload = useCallback(() => setVersion((v) => v + 1), [])
  return { data: result.data, error: result.key === key ? result.error : null, loading: result.key !== key, reload }
}

export function Table({ columns, rows, empty = 'Nothing to show yet.', rowKey = 'id', onRowClick }) {
  if (!rows?.length) return <Empty>{empty}</Empty>
  return (
    <div className="table-wrap">
      <table className="table">
        <thead>
          <tr>{columns.map((c) => <th key={c.key} style={c.width ? { width: c.width } : undefined}>{c.title}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row[rowKey]} className={onRowClick ? 'clickable' : undefined} onClick={onRowClick ? () => onRowClick(row) : undefined}>
              {columns.map((c) => <td key={c.key}>{c.render ? c.render(row) : row[c.key]}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
