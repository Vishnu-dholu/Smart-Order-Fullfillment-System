import { jwtDecode } from 'jwt-decode';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { authApi } from '../../../api/axiosConfig';
import { useAuth } from '../../../hooks/useAuth';

interface AuthResponse {
  token: string;
}

interface DecodedToken {
  sub: string;
  userId: string;
  role: 'CUSTOMER' | 'ADMIN' | 'WAREHOUSE_MANAGER';
  exp: number;
}

export const useRegister = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();
  const { setToken } = useAuth();

  const register = async (username: string, email: string, pass: string) => {
    setIsLoading(true);
    setError(null);
    try {
      // Hits the Java Spring Boot AuthController
      const response = await authApi.post<AuthResponse>('/auth/register', {
        username,
        email,
        password: pass,
      });

      const token = response.data.token;
      const decoded: DecodedToken = jwtDecode(token);

      // Update global context & local storage
      setToken(token);

      // Redirect based on role
      if (decoded.role === 'ADMIN') navigate('/admin');
      else if (decoded.role === 'WAREHOUSE_MANAGER') navigate('/warehouse/inventory');
      else navigate('/app/orders');
    } catch (err: any) {
      // Handle the "Email already registered" exception from Java
      if (err.response?.data?.message) {
        setError(err.response.data.message);
      } else {
        setError('Registration failed. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return { register, isLoading, error };
};
