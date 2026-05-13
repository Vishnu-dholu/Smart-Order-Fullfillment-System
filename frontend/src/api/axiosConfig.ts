import axios, { type AxiosInstance, type InternalAxiosRequestConfig } from 'axios';

/**
 * Strip Authorization so the gateway JWT filter does not run on public routes.
 * Axios 1.x may use AxiosHeaders where `delete headers['Authorization']` is not enough.
 */
function stripAuthorizationHeader(config: InternalAxiosRequestConfig): void {
  const h = config.headers;
  if (!h || typeof h !== 'object') return;
  delete (h as Record<string, unknown>).Authorization;
  delete (h as Record<string, unknown>).authorization;
  const ax = h as { delete?: (name: string) => void };
  if (typeof ax.delete === 'function') {
    ax.delete('Authorization');
    ax.delete('authorization');
  }
}

/**
 * Returns true when the request is to a public auth endpoint that must NOT carry
 * a Bearer token — even if one exists in localStorage.  A stale / invalid token
 * sent to the gateway's oauth2ResourceServer filter will produce a 403 before
 * Spring Security's permitAll() rule for /api/auth/** has a chance to apply.
 */
function isPublicAuthRequest(config: InternalAxiosRequestConfig): boolean {
  // Build the full path by combining baseURL + url and stripping query string
  const base = (config.baseURL ?? '').replace(/\/$/, '');
  const rel  = (config.url   ?? '').split('?')[0];
  const full = rel.startsWith('http') ? rel : `${base}${rel.startsWith('/') ? rel : `/${rel}`}`;

  // Extract just the pathname so absolute URLs work too
  let pathname: string;
  try {
    pathname = new URL(full, 'http://localhost').pathname;
  } catch {
    pathname = full;
  }

  if (pathname.startsWith('/api/auth/')) {
    return true;
  }

  const publicPaths = ['/auth/login', '/auth/register',
                       '/api/auth/login', '/api/auth/register'];
  return publicPaths.some((p) => pathname === p || pathname.endsWith(p));
}

// Factory function to create configured Axios clients
const createApiClient = (baseURL: string | undefined, defaultURL: string): AxiosInstance => {
  const client = axios.create({
    baseURL: baseURL || defaultURL,
    headers: { 'Content-Type': 'application/json' },
    withCredentials: true,
  });

  // Intercept every request BEFORE it leaves the browser
  client.interceptors.request.use(
    (config) => {
      const token = localStorage.getItem('token');

      if (isPublicAuthRequest(config)) {
        stripAuthorizationHeader(config);
      } else if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }

      return config;
    },
    (error) => {
      return Promise.reject(error);
    },
  );
  return client;
};

const gatewayBaseUrl = import.meta.env.VITE_API_GATEWAY_URL || '';

export const authApi = createApiClient(`${gatewayBaseUrl}/api`, '/api');
export const inventoryApi = createApiClient(`${gatewayBaseUrl}/api`, '/api');
export const orderApi = createApiClient(`${gatewayBaseUrl}/api`, '/api');
export const warehouseApi = createApiClient(`${gatewayBaseUrl}/api/warehouse`, '/api/warehouse');
