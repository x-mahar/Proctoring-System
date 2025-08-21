export const API_BASE = "http://127.0.0.1:8000/api/v1";

// Fetch with timeout to avoid hanging UI when backend is down
async function fetchWithTimeout(url, options = {}, timeoutMs = 6000) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    return res;
  } catch (e) {
    if (e.name === 'AbortError') {
      throw new Error(`Request timed out. Cannot reach backend at ${API_BASE}. Please start the server.`);
    }
    // Network or CORS failure
    throw new Error(`Cannot reach backend at ${API_BASE}. Please start the server.`);
  } finally {
    clearTimeout(id);
  }
}

export async function postForm(endpoint, formData) {
  const res = await fetchWithTimeout(`${API_BASE}${endpoint}`, { method: "POST", body: formData });
  const contentType = res.headers.get("content-type") || "";
  const payload = contentType.includes("application/json") ? await res.json().catch(() => ({})) : await res.text();
  if (!res.ok) throw new Error(payload?.error || payload?.detail || (typeof payload === 'string' && payload) || "Request failed");
  return payload;
}

export async function postJSON(endpoint, data) {
  const res = await fetchWithTimeout(`${API_BASE}${endpoint}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  });
  const payload = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(payload?.detail || payload?.error || "Request failed");
  }
  return payload;
}

export async function getJSON(endpoint) {
  const res = await fetchWithTimeout(`${API_BASE}${endpoint}`, { method: "GET" });
  const contentType = res.headers.get("content-type") || "";
  const payload = contentType.includes("application/json") ? await res.json().catch(() => ({})) : await res.text();
  if (!res.ok) throw new Error(payload?.error || payload?.detail || (typeof payload === 'string' && payload) || "Request failed");
  return payload;
}