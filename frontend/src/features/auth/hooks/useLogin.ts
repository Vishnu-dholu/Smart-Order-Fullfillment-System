import { jwtDecode } from 'jwt-decode';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { authApi } from '../../../api/axiosConfig';
import { useAuth } from '../../../hooks/useAuth';

interface LoginResponse {
  token: string;
}

interface DecodedToken {
  sub: string;
  role: 'CUSTOMER' | 'ADMIN' | 'WAREHOUSE_MANAGER';
  exp: number;
}

export const useLogin = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();
  const { setToken } = useAuth();

  const handleSuccess = (token: string) => {
    const decoded: DecodedToken = jwtDecode(token);
    setToken(token);

    if (decoded.role === 'ADMIN') navigate('/admin');
    else if (decoded.role === 'WAREHOUSE_MANAGER') navigate('/warehouse/inventory');
    else navigate('/app/orders');
  };

  const login = async (email: string, pass: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await authApi.post<LoginResponse>('/auth/login', {
        email,
        password: pass,
      });
      handleSuccess(response.data.token);
    } catch (err: any) {
      if (err.response?.status === 403) setError('Invalid email or password.');
      else setError('Login failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return { login, isLoading, error };
};
