const API_BASE = '';
async function request(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  return fetch(`${API_BASE}${input}`, { credentials: 'include', ...init });
}
async function readResponse(res: Response): Promise<any> {
  if (!res.ok) { const error = await res.json().catch(() => ({ error: res.statusText })); throw new Error(error.error || res.statusText); }
  return res.json();
}
export async function getJSON(input: string, init?: RequestInit): Promise<any> { return readResponse(await request(input, init)); }
export async function postJSON(input: string, body: any, init?: RequestInit): Promise<any> {
  return readResponse(await request(input, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(init?.headers || {}) }, body: JSON.stringify(body), ...init }));
}
export async function putJSON(input: string, body: any, init?: RequestInit): Promise<any> {
  return readResponse(await request(input, { method: 'PUT', headers: { 'Content-Type': 'application/json', ...(init?.headers || {}) }, body: JSON.stringify(body), ...init }));
}
export async function postForm(input: string, form: FormData, init?: RequestInit): Promise<any> { return readResponse(await request(input, { method: 'POST', body: form, ...init })); }
export async function del(input: string, init?: RequestInit): Promise<any> { return readResponse(await request(input, { method: 'DELETE', ...init })); }
export { request };
