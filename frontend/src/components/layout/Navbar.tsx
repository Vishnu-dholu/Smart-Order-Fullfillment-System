import { LayoutDashboard, LogOut, Package, ShoppingCart, User as UserIcon } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { useCart } from '../../store/CartContext';

export const Navbar = () => {
  const { user, token, logout } = useAuth();
  const { cart } = useCart();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const getDashboardLink = () => {
    if (!user) return '/';
    switch (user.role) {
      case 'ADMIN':
        return '/admin';
      case 'WAREHOUSE_MANAGER':
        return '/warehouse/inventory';
      default:
        return '/app/products';
    }
  };

  // Calculate the total number of items in the cart
  const cartItemCount = cart.reduce((total, item) => total + item.cartQuantity, 0);

  return (
    <nav className="border-b border-gray-100 bg-white/80 backdrop-blur-md sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16 items-center">
          {/* Logo Section */}
          <Link to="/" className="flex items-center gap-2 group">
            <div className="bg-indigo-600 p-2 rounded-lg group-hover:bg-indigo-700 transition-colors">
              <Package className="h-6 w-6 text-white" />
            </div>
            <span className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-violet-600">
              SmartFill
            </span>
          </Link>

          {/* Right Side Actions */}
          <div className="flex items-center gap-4">
            {token && user ? (
              /* --- LOGGED IN STATE --- */
              <>
                <Link
                  to={getDashboardLink()}
                  className="flex items-center gap-1.5 text-gray-600 hover:text-indigo-600 font-medium text-sm transition-colors"
                >
                  <LayoutDashboard className="h-4 w-4" />
                  Dashboard
                </Link>

                {/* FIX: Only show the cart if the user is a CUSTOMER */}
                {user.role === 'CUSTOMER' && (
                  <Link
                    to="/app/checkout"
                    className="relative flex items-center p-2 text-slate-600 hover:text-indigo-600 transition-colors ml-2"
                  >
                    <ShoppingCart className="h-5 w-5" />
                    {cartItemCount > 0 && (
                      <span className="absolute top-0 right-0 -mt-1 -mr-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white shadow-sm ring-2 ring-white">
                        {cartItemCount}
                      </span>
                    )}
                  </Link>
                )}

                <div className="h-4 w-px bg-gray-300 hidden sm:block mx-2"></div>

                <div className="hidden sm:flex items-center gap-1.5 text-sm font-medium text-slate-700">
                  <UserIcon className="h-4 w-4 text-slate-400" />
                  {user.email.split('@')[0]}
                </div>

                <button
                  onClick={handleLogout}
                  className="flex items-center gap-1.5 bg-red-50 hover:bg-red-100 text-red-600 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ml-2"
                >
                  <LogOut className="h-4 w-4" />
                  <span className="hidden sm:inline">Logout</span>
                </button>
              </>
            ) : (
              /* --- LOGGED OUT STATE --- */
              <>
                <Link
                  to="/login"
                  className="text-gray-600 hover:text-indigo-600 font-medium text-sm transition-colors"
                >
                  Sign In
                </Link>
                <Link
                  to="/register"
                  className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-all shadow-sm hover:shadow-md"
                >
                  Get Started
                </Link>
              </>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
};
