const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export class ApiError extends Error {
  status: number;
  errors: Record<string, string>;

  constructor(status: number, errors: Record<string, string>) {
    super(Object.values(errors).join(', '));
    this.name = 'ApiError';
    this.status = status;
    this.errors = errors;
  }
}

type RequestOptions = {
  method?: string;
  body?: unknown;
  headers?: Record<string, string>;
  token?: string;
};

export async function apiClient<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, headers = {}, token } = options;

  const response = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...headers,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  let json: { data?: T; errors?: Record<string, string> };
  try {
    json = await response.json();
  } catch {
    throw new ApiError(response.status, { message: `Request failed (${response.status})` });
  }

  if (!response.ok) throw new ApiError(response.status, json.errors || { message: 'Request failed' });

  return json.data as T;
}
