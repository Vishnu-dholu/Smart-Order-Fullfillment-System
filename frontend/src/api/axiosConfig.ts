import axios, { type AxiosInstance, type InternalAxiosRequestConfig } from 'axios';

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
    pathname = new URL(full).pathname;
  } catch {
    pathname = full; // already a path
  }

  const publicPaths = ['/auth/login', '/auth/register', '/auth/google',
                       '/api/auth/login', '/api/auth/register', '/api/auth/google'];
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
        // Explicitly remove any Authorization header for public auth endpoints.
        // A stale or wrong-environment Bearer token triggers the gateway's
        // oauth2ResourceServer JWT filter BEFORE permitAll() applies → 403.
        delete config.headers['Authorization'];
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
