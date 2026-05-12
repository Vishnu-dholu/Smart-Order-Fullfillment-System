import axios, { type AxiosInstance, type InternalAxiosRequestConfig } from 'axios';

/** Under /api: do not send Bearer (gateway JWT filter runs before permitAll for invalid tokens). */
function isPublicAuthRequest(config: InternalAxiosRequestConfig): boolean {
  const raw = (config.url ?? '').split('?')[0];
  const path = raw.startsWith('/') ? raw : `/${raw}`;
  const publicPaths = ['/auth/login', '/auth/register', '/auth/google'];
  return publicPaths.some((p) => path === p || path.endsWith(p));
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

      // Gateway validates JWT on any Authorization: Bearer header (oauth2ResourceServer).
      // A stale or wrong-environment token would block login unless we omit it here.
      if (token && !isPublicAuthRequest(config)) {
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
