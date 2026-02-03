import { createContext, useState, useEffect, type ReactNode } from 'react';
import { jwtDecode } from 'jwt-decode';

interface User {
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
                const decoded: any = jwtDecode(token);
                // Check expiration
                const currentTime = Date.now() / 1000;
                if (decoded.exp < currentTime) {
                    logout();
                } else {
                    setUser({ email: decoded.sub, role: decoded.role });
                    localStorage.setItem('token', token);
                }
            } catch (e) {
                logout();
            }
        } else {
            localStorage.removeItem('token');
            setUser(null);
        }
    }, [token]);

    const setToken = (newToken: string) => {
        setTokenState(newToken);
    };

    const logout = () => {
        setTokenState(null);
        localStorage.removeItem('token');
        window.location.href = '/login';
    };

    return (
        <AuthContext.Provider value={{ user, token, setToken, logout }}>
            {children}
        </AuthContext.Provider>
    );
};