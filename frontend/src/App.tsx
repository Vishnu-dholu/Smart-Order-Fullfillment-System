import { Navigate, Route, Routes } from 'react-router-dom';
import { Navbar } from './components/layout/Navbar';
import { ProtectedRoute } from './components/layout/ProtectedRoute';
import { LoginPage } from './features/auth/LoginPage';
import { RegisterPage } from './features/auth/RegisterPage';
import { CustomerLayout } from './features/customer/CustomerLayout';
import { ProductCatalog } from './features/inventory/ProductCatalog';
import { OrderHistory } from './features/orders/OrderHistory';
import { LandingPage } from './features/public/LandingPage';
import { CheckoutScreen } from './features/orders/CheckoutScreen';

function App() {
  return (
    <div className="min-h-screen bg-slate-50 font-sans">
      <Navbar />

      <Routes>
        {/* Public Routes */}
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route
          path="/unauthorized"
          element={
            <div className="p-10 text-center text-red-600 font-bold">403 - Unauthorized Access</div>
          }
        />

        {/* Protected Customer Routes */}
        <Route element={<ProtectedRoute allowedRoles={['CUSTOMER']} />}>
          <Route element={<CustomerLayout />}>
            {/* Default redirect: when they hit /app, send them to products */}
            <Route path="/app" element={<Navigate to="/app/products" replace />} />

            <Route path="/app/checkout" element={<CheckoutScreen />} />
            
            {/* The actual tab contents */}
            <Route path="/app/products" element={<ProductCatalog />} />
            <Route path="/app/orders" element={<OrderHistory />} />
          </Route>
        </Route>
      </Routes>
    </div>
  );
}

export default App;
