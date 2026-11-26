export class ApiError extends Error {
 readonly status: number
 constructor(message: string, status: number) { super(message); this.status = status }
}
export async function request<T>(path: string, method = 'GET', body?: unknown): Promise<T> {
 const response = await fetch(path, { method, credentials: 'include', headers: body === undefined ? {} : { 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) })
 const result = await response.json().catch(() => ({}))
 if (!response.ok) throw new ApiError(typeof result.error === 'string' ? result.error : `Request failed (${response.status})`, response.status)
 return result as T
}
export function data<T>(result: { data?: T } & object): T { return ('data' in result ? result.data : result) as T }
