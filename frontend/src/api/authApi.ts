// import type { AuthResponse } from "../types";
// import { authClient } from "./axiosConfig";

// // 1. Create an Axios instance specific to the Auth Microservice
// export const authApi = {
//   login: async (credentials: {username: string; password: string}): Promise<AuthResponse> => {
//     const response = await authClient.post<AuthResponse>('/api/auth/login', credentials)
//     return response.data
//   }
// }

// // 2. Request Interceptor: Attaches the JWT Token to every request
// // authApi.interceptors.request.use(
// //   (config) => {
// //     const token = localStorage.getItem("token");
// //     if (token) {
// //       config.headers.Authorization = `Bearer ${token}`;
// //     }
// //     return config;
// //   },
// //   (error) => {
// //     return Promise.reject(error);
// //   },
// // );

// // // 3. Response Interceptor: Optional global error handling
// // authApi.interceptors.response.use(
// //   (response) => response,
// //   (error) => {
// //     // If the token is invalid (403 Forbidden), we might want to log the user out automatically
// //     if (error.response?.status === 403) {
// //       // Optional: localStorage.removeItem('token');
// //       // Optional: window.location.href = '/login';
// //     }
// //     return Promise.reject(error);
// //   },
// // );
