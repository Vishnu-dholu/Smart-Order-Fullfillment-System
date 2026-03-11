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
      const userId = localStorage.getItem('userId');

      // Attach JWT for Spring Security / Go Auth
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }

      // Attach User ID for your Java Order Service routing
      if (userId) {
        config.headers['X-User-Id'] = userId;
      }

      return config;
    },
    (error) => {
      return Promise.reject(error);
    },
  );
  return client;
};

export const authApi = createApiClient(
  import.meta.env.VITE_AUTH_SERVICE_URL,
  'http://localhost:8081',
);
export const inventoryApi = createApiClient(
  import.meta.env.VITE_INVENTORY_SERVICE_URL,
  'http://localhost:8082',
);
export const orderApi = createApiClient(
  import.meta.env.VITE_ORDER_SERVICE_URL,
  'http://localhost:8083',
);
export const warehouseApi = createApiClient(
  import.meta.env.VITE_WAREHOUSE_SERVICE_URL,
  'http://localhost:8084',
);
