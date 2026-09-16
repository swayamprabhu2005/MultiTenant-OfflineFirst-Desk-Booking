const API_BASE = '/api';

export function getAuthHeader(): Record<string, string> {
  const token = localStorage.getItem('token');
  const activeTenant = localStorage.getItem('activeTenantSubdomain');

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  if (activeTenant) {
    headers['x-tenant-subdomain'] = activeTenant;
  }

  return headers;
}

export async function fetchApi<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const headers = {
    ...getAuthHeader(),
    ...(options.headers || {}),
  };

  if (options.body instanceof FormData) {
    delete (headers as Record<string, string>)['Content-Type'];
  }

  const maxRetries = 5;
  let attempt = 0;

  while (true) {
    attempt++;
    try {
      const response = await fetch(`${API_BASE}${endpoint}`, {
        ...options,
        headers,
      });

      // If backend is still initializing during cold startup (HTTP 503), retry with backoff
      if (response.status === 503 && attempt <= maxRetries) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
        continue;
      }

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.error || data.message || `Request failed with status ${response.status}`);
      }

      return data as T;
    } catch (err: any) {
      // If network connection failed (backend starting up) and retries remain, retry
      const isNetworkError = err?.message?.includes('Failed to fetch') || err?.message?.includes('NetworkError');
      if (isNetworkError && attempt <= maxRetries) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
        continue;
      }
      throw err;
    }
  }
}
