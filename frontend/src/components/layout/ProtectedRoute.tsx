import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';

// Define the allowed roles prop
interface ProtectedRouteProps {
    allowedRoles: ('CUSTOMER' | 'ADMIN' | 'WAREHOUSE_MANAGER')[];
}

export const ProtectedRoute = ({ allowedRoles }: ProtectedRouteProps) => {
    const { user, token } = useAuth(); // Custom hook to get auth state

    // 1. Check if logged in
    if (!token || !user) {
        return <Navigate to="/login" replace />;
    }

    // 2. Check if role matches
    if (!allowedRoles.includes(user.role)) {
        // Redirect to their appropriate home based on their actual role
        return <Navigate to="/unauthorized" replace />;
    }

    // 3. Render the child route
    return <Outlet />;
};