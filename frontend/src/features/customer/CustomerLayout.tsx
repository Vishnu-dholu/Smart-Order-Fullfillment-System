import { Package, ShoppingBag } from 'lucide-react';
import { NavLink, Outlet } from 'react-router-dom';

export const CustomerLayout = () => {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-extrabold text-slate-900">Welcome to SmartFill</h1>
        <p className="text-slate-600 mt-2">Discover products and manage your purchases.</p>
      </div>

      {/* Navigation Tabs */}
      <div className="border-b border-slate-200 mb-8">
        <nav className="-mb-px flex space-x-8">
          <NavLink
            to="/app/products"
            className={({ isActive }) =>
              `flex items-center gap-2 py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                isActive
                  ? 'border-indigo-600 text-indigo-600'
                  : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
              }`
            }
          >
            <ShoppingBag className="h-5 w-5" />
            Product Catalog
          </NavLink>

          <NavLink
            to="/app/orders"
            className={({ isActive }) =>
              `flex items-center gap-2 py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                isActive
                  ? 'border-indigo-600 text-indigo-600'
                  : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
              }`
            }
          >
            <Package className="h-5 w-5" />
            My Orders
          </NavLink>
        </nav>
      </div>

      {/* This Outlet renders either ProductCatalog or CustomerDashboard (Orders) */}
      <Outlet />
    </div>
  );
};
