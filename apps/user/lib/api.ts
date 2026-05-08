export const API_URL = process.env.API_URL ?? "http://localhost:4000";

export class ApiClientError extends Error {
  readonly status: number;
  readonly code?: string;

  constructor(status: number, message: string, code?: string) {
    super(message);
    this.name = "ApiClientError";
    this.status = status;
    this.code = code;
  }
}

export async function apiRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    cache: "no-store",
    headers: {
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });

  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    throw new ApiClientError(
      response.status,
      payload?.error?.message ?? `API request failed with status ${response.status}`,
      payload?.error?.code,
    );
  }

  return payload.data as T;
}

export function authHeader(token: string) {
  return { Authorization: `Bearer ${token}` };
}
