import axios, { type AxiosInstance } from 'axios';

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

      // Gateway validates JWT and injects trusted identity headers downstream.
      if (token) {
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
