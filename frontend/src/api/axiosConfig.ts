import axios from 'axios';

export const authApi = axios.create({
  baseURL: import.meta.env.VITE_AUTH_SERVICE_URL,
});

// Interceptor to add auth tokens to requests from other services

authApi.interceptors.request.use((config) => {
    const token = localStorage.getItem('authToken');

    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
        return config;
    }
})
