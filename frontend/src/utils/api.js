const API_BASE = import.meta.env.VITE_API_URL;

export async function apiFetch(path, options = {}) {
  const url = `${API_BASE}${path}`;
  const opts = {
    credentials: 'include', // 🔑 include cookies
    ...options,
  };

  // Don't set Content-Type for FormData, browser will set it with boundary
  if (!options.isFormData) {
    opts.headers = { 'Content-Type': 'application/json', ...options.headers };
  }

  // Convert body to JSON string if it's a plain object (not FormData)
  if (opts.body && typeof opts.body === 'object' && !(opts.body instanceof FormData)) {
    opts.body = JSON.stringify(opts.body);
  }

  const res = await fetch(url, opts);
  const text = await res.text();

  let data;
  try {
    data = JSON.parse(text);
  } catch {
    data = text;
  }

  return { ok: res.ok, status: res.status, data };
}

// Example usage
// const response = await apiFetch('/api/auth/me');
export async function updateProfile(data) {
  return apiFetch('/api/auth/profile', { method: 'PUT', body: data });
}

export default { apiFetch, API_BASE, updateProfile };