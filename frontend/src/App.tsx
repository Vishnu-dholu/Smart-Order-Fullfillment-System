import { Routes, Route } from 'react-router-dom'; // No "Router" import needed here
import { Navbar } from './components/layout/Navbar';
import { LoginPage } from './features/auth/LoginPage';
import { LandingPage } from './features/public/LandingPage';
import { ProtectedRoute } from './components/layout/ProtectedRoute';

function App() {
  return (
    <div className="min-h-screen bg-slate-50 font-sans">
      {/* Navbar is inside App, so it's inside BrowserRouter from main.tsx */}
      <Navbar />

      <Routes>
        {/* Public Routes */}
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<div className="p-10 text-center">Register Page (Coming Soon)</div>} />

        {/* Protected Routes (Placeholder for future) */}
        <Route element={<ProtectedRoute allowedRoles={['CUSTOMER']} />}>
          <Route path="/app/orders" element={<div>My Orders</div>} />
        </Route>
      </Routes>
    </div>
  );
}

export default App;