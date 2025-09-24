const API_BASE = import.meta.env.VITE_API_URL;

export async function apiFetch(path, options = {}) {
  const url = `${API_BASE}${path}`;
  const opts = {
    credentials: 'include', // 🔑 include cookies
    headers: { 'Content-Type': 'application/json' },
    ...options,
  };

  // Convert body to JSON string if it's a plain object
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
export default { apiFetch, API_BASE };
