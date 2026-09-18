import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  clearToken,
  createLead,
  downloadLeadsCsv,
  fetchInsights,
  fetchLead,
  fetchLeads,
  updateLeadStatus,
} from '../api';
import socket from '../socket';

const STATUSES = ['new', 'contacted', 'qualified', 'won', 'lost'];
const EMPTY_FORM = {
  name: '',
  email: '',
  phone: '',
  service: 'Web Development',
  budgetRange: '$500 - $1000',
  message: '',
};

function formatDate(value) {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

function scoreClass(score) {
  if (score >= 75) return 'score-high';
  if (score >= 50) return 'score-medium';
  return 'score-low';
}

export default function Leads() {
  const navigate = useNavigate();
  const [leads, setLeads] = useState([]);
  const [insights, setInsights] = useState(null);
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0 });
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('all');
  const [minScore, setMinScore] = useState('');
  const [maxScore, setMaxScore] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState(null);
  const [selectedLead, setSelectedLead] = useState(null);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  function handleError(err) {
    if (err.message === 'Unauthorized') {
      clearToken();
      navigate('/login', { replace: true });
      return;
    }
    setError(err.message);
  }

  async function load(page = 1, overrides = {}) {
    setError('');
    setLoading(true);
    try {
      const filters = {
        q,
        status,
        minScore,
        maxScore,
        page,
        ...overrides,
      };
      const [leadData, insightData] = await Promise.all([
        fetchLeads(filters),
        fetchInsights(),
      ]);
      setLeads(leadData.leads || []);
      setPagination(leadData.pagination || { page: 1, pages: 1, total: 0 });
      setInsights(insightData);
    } catch (err) {
      handleError(err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // Filters intentionally apply only when Search is submitted.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Real-time: listen for new leads from Socket.IO
  useEffect(() => {
    function handleNewLead(lead) {
      setLeads((current) => [lead, ...current]);
      setPagination((prev) => ({ ...prev, total: prev.total + 1 }));
      fetchInsights()
        .then((data) => setInsights(data))
        .catch(() => {});
      setNotice(`🔴 Live: New lead "${lead.name}" received!`);
    }

    socket.on('lead:created', handleNewLead);
    return () => socket.off('lead:created', handleNewLead);
  }, []);

  async function handleStatusChange(id, nextStatus) {
    setUpdatingId(id);
    setError('');
    try {
      const data = await updateLeadStatus(id, nextStatus);
      setLeads((current) => current.map((lead) => (lead.id === id ? data.lead : lead)));
      setInsights(await fetchInsights());
      setNotice('Lead status updated.');
    } catch (err) {
      handleError(err);
    } finally {
      setUpdatingId(null);
    }
  }

  async function openDetails(id) {
    setError('');
    try {
      const data = await fetchLead(id);
      setSelectedLead(data.lead);
    } catch (err) {
      handleError(err);
    }
  }

  async function handleCreate(event) {
    event.preventDefault();
    setSaving(true);
    setError('');
    try {
      await createLead(form);
      setShowCreate(false);
      setForm(EMPTY_FORM);
      setNotice('Lead created and scored successfully.');
      await load(1);
    } catch (err) {
      handleError(err);
    } finally {
      setSaving(false);
    }
  }

  async function handleExport() {
    setError('');
    try {
      await downloadLeadsCsv();
      setNotice('CSV export downloaded.');
    } catch (err) {
      handleError(err);
    }
  }

  function logout() {
    clearToken();
    navigate('/login', { replace: true });
  }

  return (
    <div className="layout-wrapper">
      {/* Sidebar Navigation (TailAdmin layout) */}
      <aside className="sidebar">
        <div className="sidebar-header">
          <div className="sidebar-logo-icon">LF</div>
          <span className="sidebar-logo-text">LeadFlow</span>
        </div>
        <div className="sidebar-menu">
          <div className="menu-group-title">MENU</div>
          <a className="menu-item active" href="/" onClick={(e) => { e.preventDefault(); navigate('/'); }}>
            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 10h16M4 14h16M4 18h16" />
            </svg>
            <span>Leads Dashboard</span>
          </a>
          <a className="menu-item" href="http://localhost:4200" target="_blank" rel="noreferrer">
            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 012-2h2a2 2 0 012 2v6eM9 19H5a2 2 0 01-2-2V5a2 2 0 012-2h4a2 2 0 012 2v12a2 2 0 01-2 2zm8 0h4a2 2 0 002-2V10a2 2 0 00-2-2h-4a2 2 0 00-2 2v7a2 2 0 002 2z" />
            </svg>
            <span>Insights (Angular)</span>
          </a>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="main-content">
        {/* Top Header Bar */}
        <header className="top-header">
          <div className="header-search">
            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="search"
              placeholder="Search..."
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  load(1);
                }
              }}
            />
          </div>

          <div className="header-user">
            <div className="user-profile">
              <div className="user-avatar">AD</div>
              <div className="user-info">
                <div className="user-name">Admin User</div>
                <div className="user-role">Manager</div>
              </div>
            </div>
            <button className="ghost" type="button" onClick={logout} style={{ padding: '8px 12px' }}>
              Sign Out
            </button>
          </div>
        </header>

        {/* Dashboard Body */}
        <main className="page-container">
          <div className="page-header">
            <div className="page-title-group">
              <p className="eyebrow">Dashboard</p>
              <h1>Lead Overview</h1>
            </div>
            <div className="page-actions">
              <button className="ghost" type="button" onClick={handleExport}>
                <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/></svg>
                Export CSV
              </button>
              <button type="button" onClick={() => setShowCreate(true)}>
                <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4"/></svg>
                Add Lead
              </button>
            </div>
          </div>

          {/* Stat Cards */}
          <section className="stats-grid" aria-label="Lead summary">
            <article className="stat-card">
              <div>
                <span className="stat-label">Total Leads</span>
                <div className="stat-value">{insights?.total ?? '—'}</div>
              </div>
              <div className="stat-icon">
                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"/></svg>
              </div>
            </article>
            {['new', 'qualified', 'won'].map((item) => (
              <article className="stat-card" key={item}>
                <div>
                  <span className="stat-label">{item} Leads</span>
                  <div className="stat-value">{insights?.countsByStatus?.[item] ?? '—'}</div>
                </div>
                <div className="stat-icon">
                  <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                </div>
              </article>
            ))}
          </section>

          {/* Filter Bar Card */}
          <div className="filters-card">
            <form
              className="filters-grid"
              onSubmit={(event) => {
                event.preventDefault();
                load(1);
              }}
            >
              <input
                type="search"
                placeholder="Search name, email, phone, service…"
                value={q}
                onChange={(event) => setQ(event.target.value)}
              />
              <select value={status} onChange={(event) => setStatus(event.target.value)}>
                <option value="all">All Statuses</option>
                {STATUSES.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
              <select value={minScore} onChange={(event) => setMinScore(event.target.value)}>
                <option value="">No Min Score</option>
                <option value="75">75+ Hot</option>
                <option value="50">50+ Warm</option>
                <option value="0">All Scores</option>
              </select>
              <select value={maxScore} onChange={(event) => setMaxScore(event.target.value)}>
                <option value="">No Max Score</option>
                <option value="49">Up to 49 (Cold)</option>
                <option value="74">Up to 74 (Warm)</option>
                <option value="100">Up to 100</option>
              </select>
              <button type="submit">Filter</button>
            </form>
          </div>

          {error ? <p className="alert error">{error}</p> : null}
          {notice ? <p className="alert success">{notice}</p> : null}

          {/* Leads Data Table */}
          <div className="table-card">
            {loading ? (
              <div style={{ padding: '32px', textAlign: 'center' }} className="muted">Loading leads…</div>
            ) : leads.length === 0 ? (
              <div className="empty-state" style={{ padding: '48px', textAlign: 'center' }}>
                <h2>No leads found</h2>
                <p className="muted">Change the filters or add a lead to get started.</p>
              </div>
            ) : (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Lead Name</th>
                      <th>Service</th>
                      <th>Budget</th>
                      <th>Score</th>
                      <th>Status</th>
                      <th>Source</th>
                      <th>Date</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {leads.map((lead) => (
                      <tr key={lead.id}>
                        <td>
                          <div className="cell-title">{lead.name}</div>
                          <div className="cell-note">{lead.email}</div>
                        </td>
                        <td>{lead.service}</td>
                        <td>{lead.budgetRange}</td>
                        <td>
                          <span className={`score ${scoreClass(lead.leadScore)}`}>
                            {lead.leadScore}
                          </span>
                        </td>
                        <td>
                          <select
                            className={`status-select status-${lead.status}`}
                            value={lead.status}
                            disabled={updatingId === lead.id}
                            onChange={(event) => handleStatusChange(lead.id, event.target.value)}
                          >
                            {STATUSES.map((item) => (
                              <option key={item} value={item}>
                                {item}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="capitalize">{lead.source}</td>
                        <td>{formatDate(lead.createdAt)}</td>
                        <td>
                          <button className="link-button" onClick={() => openDetails(lead.id)}>
                            View Details
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Pagination */}
            <div className="pagination">
              <span className="pagination-text">
                Page {pagination.page} of {pagination.pages} · {pagination.total} leads total
              </span>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  className="ghost"
                  disabled={pagination.page <= 1 || loading}
                  onClick={() => load(pagination.page - 1)}
                >
                  Previous
                </button>
                <button
                  className="ghost"
                  disabled={pagination.page >= pagination.pages || loading}
                  onClick={() => load(pagination.page + 1)}
                >
                  Next
                </button>
              </div>
            </div>
          </div>
        </main>
      </div>

      {/* Modal - Add Lead */}
      {showCreate ? (
        <div className="modal-backdrop" role="presentation" onMouseDown={() => setShowCreate(false)}>
          <form
            className="modal"
            onSubmit={handleCreate}
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="modal-header">
              <h2>Add New Lead</h2>
              <button className="ghost" type="button" onClick={() => setShowCreate(false)}>
                ✕
              </button>
            </div>
            <div className="form-grid">
              {[
                ['name', 'Full Name', 'text'],
                ['email', 'Email Address', 'email'],
                ['phone', 'Phone Number', 'tel'],
              ].map(([field, label, type]) => (
                <label key={field}>
                  {label}
                  <input
                    type={type}
                    value={form[field]}
                    onChange={(event) => setForm({ ...form, [field]: event.target.value })}
                    required
                  />
                </label>
              ))}
              <label>
                Service
                <select
                  value={form.service}
                  onChange={(event) => setForm({ ...form, service: event.target.value })}
                >
                  <option>Web Development</option>
                  <option>UI/UX Design</option>
                  <option>Digital Marketing</option>
                </select>
              </label>
              <label>
                Budget Range
                <select
                  value={form.budgetRange}
                  onChange={(event) => setForm({ ...form, budgetRange: event.target.value })}
                >
                  <option>$500 - $1000</option>
                  <option>$1000 - $5000</option>
                  <option>$5000+</option>
                </select>
              </label>
            </div>
            <label style={{ marginTop: '8px' }}>
              Message / Notes
              <textarea
                value={form.message}
                onChange={(event) => setForm({ ...form, message: event.target.value })}
                required
              />
            </label>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '20px' }}>
              <button className="ghost" type="button" onClick={() => setShowCreate(false)}>
                Cancel
              </button>
              <button disabled={saving}>{saving ? 'Saving…' : 'Create Lead'}</button>
            </div>
          </form>
        </div>
      ) : null}

      {/* Modal - Lead Details */}
      {selectedLead ? (
        <div className="modal-backdrop" role="presentation" onMouseDown={() => setSelectedLead(null)}>
          <article
            className="modal"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="modal-header">
              <div>
                <p className="eyebrow">Lead Details</p>
                <h2>{selectedLead.name}</h2>
              </div>
              <button className="ghost" onClick={() => setSelectedLead(null)}>
                ✕
              </button>
            </div>
            <div className="details-grid">
              <div className="details-item"><dt>Email</dt><dd>{selectedLead.email}</dd></div>
              <div className="details-item"><dt>Phone</dt><dd>{selectedLead.phone}</dd></div>
              <div className="details-item"><dt>Service</dt><dd>{selectedLead.service}</dd></div>
              <div className="details-item"><dt>Budget</dt><dd>{selectedLead.budgetRange}</dd></div>
              <div className="details-item"><dt>Lead Score</dt><dd>{selectedLead.leadScore}/100</dd></div>
              <div className="details-item"><dt>Source</dt><dd className="capitalize">{selectedLead.source}</dd></div>
            </div>
            <div className="message-box">
              <strong>Message</strong>
              <p>{selectedLead.message}</p>
            </div>
          </article>
        </div>
      ) : null}
    </div>
  );
}
