// src/store/AuthContext.tsx
import { jwtDecode } from 'jwt-decode';
import { createContext, useEffect, useState, type ReactNode } from 'react';

interface User {
  id: string;
  email: string;
  role: 'CUSTOMER' | 'ADMIN' | 'WAREHOUSE_MANAGER';
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  setToken: (token: string) => void;
  logout: () => void;
}

export const AuthContext = createContext<AuthContextType | null>(null);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [token, setTokenState] = useState<string | null>(localStorage.getItem('token'));
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    if (token) {
      try {
        // Define the structure of your Spring Boot JWT payload
        interface DecodedToken {
          sub: string; // Usually the email
          userId: string;
          role: 'CUSTOMER' | 'ADMIN' | 'WAREHOUSE_MANAGER';
          exp: number;
        }

        const decoded = jwtDecode<DecodedToken>(token);
        const currentTime = Date.now() / 1000;

        if (decoded.exp < currentTime) {
          logout();
        } else {
          // Set User State
          setUser({
            id: decoded.userId, // Map the ID
            email: decoded.sub,
            role: decoded.role,
          });

          // Save to LocalStorage for Axios Interceptors
          localStorage.setItem('token', token);
          localStorage.setItem('userId', decoded.userId);
        }
      } catch (e) {
        logout();
      }
    } else {
      // Clean up if no token
      localStorage.removeItem('token');
      localStorage.removeItem('userId');
      setUser(null);
    }
  }, [token]);

  const setToken = (newToken: string) => {
    setTokenState(newToken);
  };

  const logout = () => {
    setTokenState(null);
    localStorage.removeItem('token');
    localStorage.removeItem('userId');
    window.location.href = '/login'; // Or use React Router navigate if passed down
  };

  return (
    <AuthContext.Provider value={{ user, token, setToken, logout }}>
      {children}
    </AuthContext.Provider>
  );
};
