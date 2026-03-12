// src/store/AuthContext.tsx
import { jwtDecode } from 'jwt-decode';
import { createContext, useEffect, useState, type ReactNode } from 'react';

interface User {
  id: string;
  email: string;
  role: 'CUSTOMER' | 'ADMIN' | 'WAREHOUSE_MANAGER';
}

// Moved this interface outside so it can be used in the state initializer
interface DecodedToken {
  sub: string;
  userId: string;
  role: 'CUSTOMER' | 'ADMIN' | 'WAREHOUSE_MANAGER';
  exp: number;
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

  // FIX: Initialize user synchronously to prevent the reload redirect!
  const [user, setUser] = useState<User | null>(() => {
    const savedToken = localStorage.getItem('token');
    if (savedToken) {
      try {
        const decoded = jwtDecode<DecodedToken>(savedToken);
        const currentTime = Date.now() / 1000;

        // If the token is still valid, set the user immediately before ProtectedRoute renders
        if (decoded.exp > currentTime) {
          return {
            id: decoded.userId,
            email: decoded.sub,
            role: decoded.role,
          };
        }
      } catch (e) {
        return null;
      }
    }
    return null;
  });

  useEffect(() => {
    if (token) {
      try {
        const decoded = jwtDecode<DecodedToken>(token);
        const currentTime = Date.now() / 1000;

        if (decoded.exp < currentTime) {
          logout();
        } else {
          setUser({
            id: decoded.userId,
            email: decoded.sub,
            role: decoded.role,
          });

          localStorage.setItem('token', token);
          localStorage.setItem('userId', decoded.userId);
          localStorage.setItem('userRole', decoded.role);
        }
      } catch (e) {
        logout();
      }
    } else {
      localStorage.removeItem('token');
      localStorage.removeItem('userId');
      localStorage.removeItem('userRole');
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
    localStorage.removeItem('userRole');
    window.location.href = '/login';
  };

  return (
    <AuthContext.Provider value={{ user, token, setToken, logout }}>
      {children}
    </AuthContext.Provider>
  );
};
