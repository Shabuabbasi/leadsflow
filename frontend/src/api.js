const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';
const TOKEN_KEY = 'leadflow_token';

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token) {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
}

async function request(path, { method = 'GET', body, auth = false } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (auth) {
    const token = getToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(`${API_URL}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || `Request failed (${response.status})`);
  }
  return data;
}

export function login(email, password) {
  return request('/api/auth/login', { method: 'POST', body: { email, password } });
}

export function fetchLeads({
  q = '',
  status = 'all',
  minScore = '',
  maxScore = '',
  page = 1,
  limit = 10,
} = {}) {
  const params = new URLSearchParams();
  if (q) params.set('q', q);
  if (status && status !== 'all') params.set('status', status);
  if (minScore !== '') params.set('minScore', minScore);
  if (maxScore !== '') params.set('maxScore', maxScore);
  params.set('page', page);
  params.set('limit', limit);
  const query = params.toString();
  return request(`/api/leads${query ? `?${query}` : ''}`, { auth: true });
}

export function fetchLead(id) {
  return request(`/api/leads/${id}`, { auth: true });
}

export function createLead(lead) {
  return request('/api/leads', { method: 'POST', auth: true, body: lead });
}

export function updateLeadStatus(id, status) {
  return request(`/api/leads/${id}`, {
    method: 'PATCH',
    auth: true,
    body: { status },
  });
}

export function fetchInsights() {
  return request('/api/analytics/insights', { auth: true });
}

export async function downloadLeadsCsv() {
  const response = await fetch(`${API_URL}/api/leads/export.csv`, {
    headers: { Authorization: `Bearer ${getToken()}` },
  });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error || 'Could not export leads');
  }

  const url = URL.createObjectURL(await response.blob());
  const link = document.createElement('a');
  link.href = url;
  link.download = 'leadflow-leads.csv';
  link.click();
  URL.revokeObjectURL(url);
}
