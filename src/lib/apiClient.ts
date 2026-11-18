const API_BASE = '';

async function request(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const res = await fetch(`${API_BASE}${input}`, {
    credentials: 'include',
    ...init,
  });
  return res;
}

export async function getJSON(input: string, init?: RequestInit): Promise<any> {
  const res = await request(input, init);
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || res.statusText);
  }
  return res.json();
}

export async function postJSON(input: string, body: any, init?: RequestInit): Promise<any> {
  const res = await request(input, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(init?.headers || {}) },
    body: JSON.stringify(body),
    ...init,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || res.statusText);
  }
  return res.json();
}

export async function postForm(input: string, form: FormData, init?: RequestInit): Promise<any> {
  const res = await request(input, { method: 'POST', body: form, ...init });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || res.statusText);
  }
  return res.json();
}

export async function del(input: string, init?: RequestInit): Promise<any> {
  const res = await request(input, { method: 'DELETE', ...init });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || res.statusText);
  }
  return res.json();
}

export { request };
