export const API_BASE = "http://127.0.0.1:8000/api/v1";

export async function postForm(endpoint, formData) {
  const res = await fetch(`${API_BASE}${endpoint}`, { method: "POST", body: formData });
  const contentType = res.headers.get("content-type") || "";
  const payload = contentType.includes("application/json") ? await res.json() : await res.text();
  if (!res.ok) throw new Error(payload?.error || payload?.detail || "Request failed");
  return payload;
}

export async function postJSON(endpoint, data) {
  const res = await fetch(`${API_BASE}${endpoint}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data)
  });
  const payload = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(payload?.error || payload?.detail || "Request failed");
  return payload;
}