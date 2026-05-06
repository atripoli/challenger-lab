const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';
const TOKEN_KEY = 'challenger_lab_token';

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}
export function setToken(token) {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

async function request(path, { method = 'GET', body, headers = {} } = {}) {
  const token = getToken();
  const res = await fetch(`${API_URL}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const text = await res.text();
  const data = text ? JSON.parse(text) : null;

  if (!res.ok) {
    const err = new Error(data?.error || `HTTP ${res.status}`);
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

async function uploadFile(path, file, fieldName = 'image') {
  const token = getToken();
  const form = new FormData();
  form.append(fieldName, file);
  const res = await fetch(`${API_URL}${path}`, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: form,
  });
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) {
    const err = new Error(data?.error || `HTTP ${res.status}`);
    err.status = res.status;
    throw err;
  }
  return data;
}

// Descarga binaria con auth → dispara el "Save as..." del browser usando
// un blob URL. Toma el filename del header Content-Disposition si está,
// si no usa el fallback que le pases.
async function downloadFile(path, fallbackName = 'download.bin') {
  const token = getToken();
  const res = await fetch(`${API_URL}${path}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    let msg = `HTTP ${res.status}`;
    try { msg = JSON.parse(text)?.error || msg; } catch (_) {}
    const err = new Error(msg);
    err.status = res.status;
    throw err;
  }
  const cd = res.headers.get('content-disposition') || '';
  const m = /filename="?([^"]+)"?/i.exec(cd);
  const name = m?.[1] || fallbackName;
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export const api = {
  get:    (p)    => request(p),
  post:   (p, b) => request(p, { method: 'POST',  body: b }),
  put:    (p, b) => request(p, { method: 'PUT',   body: b }),
  patch:  (p, b) => request(p, { method: 'PATCH', body: b }),
  del:    (p)    => request(p, { method: 'DELETE' }),
  upload: uploadFile,
  download: downloadFile,
};
