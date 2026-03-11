import { AlertCircle, Calendar, Loader2, MapPin, Package } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useOrders } from './hooks/useOrders';

export const OrderHistory = () => {
  const { orders, isLoading, error } = useOrders();
  const navigate = useNavigate(); // Added to handle navigation

  const getStatusColor = (status: string) => {
    switch (status.toUpperCase()) {
      case 'CONFIRMED':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'PENDING_INVENTORY':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'SHIPPED':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      default:
        return 'bg-slate-100 text-slate-800 border-slate-200';
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-[40vh] flex flex-col items-center justify-center">
        <Loader2 className=" h-10 w-10 text-indigo-600 animate-spin mb-4" />
        <p className="text-slate-500 font-medium">Loading your orders...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-4xl mx-auto p-6 bg-red-50 border border-red-200 rounded-xl flex items-center gap-3">
        <AlertCircle className="h-6 w-6 text-red-500" />
        <p className="text-red-700 font-medium">{error}</p>
      </div>
    );
  }

  return (
    <div className="pb-8">
      {orders.length === 0 ? (
        // --- EMPTY STATE ---
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center shadow-sm">
          <div className="mx-auto h-16 w-16 bg-slate-50 rounded-full flex items-center justify-center mb-4">
            <Package className="h-8 w-8 text-slate-400" />
          </div>
          <h3 className="text-lg font-bold text-slate-900 mb-2">No orders yet</h3>
          <p className="text-slate-500 mb-6">When you place an order, it will appear here.</p>
          <button
            onClick={() => navigate('/app/products')}
            className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2.5 rounded-lg font-medium transition-colors shadow-sm"
          >
            Start Shopping
          </button>
        </div>
      ) : (
        // --- ORDER LIST ---
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {orders.map((order) => (
            <div
              key={order.orderId}
              className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm hover:shadow-md transition-shadow"
            >
              <div className="flex justify-between items-start mb-4">
                <div className="flex items-center gap-2 text-sm text-slate-500 font-medium">
                  <Package className="h-4 w-4" />
                  <span>#{order.orderId.substring(0, 8)}...</span>
                </div>
                <span
                  className={`px-2.5 py-1 text-xs font-bold rounded-full border ${getStatusColor(order.status)}`}
                >
                  {order.status.replace('_', ' ')}
                </span>
              </div>

              <div className="space-y-3 mb-6">
                <div className="flex items-center gap-3 text-slate-600 text-sm">
                  <Calendar className="h-4 w-4 shrink-0 text-slate-400" />
                  <span>
                    {new Date(order.createdAt).toLocaleDateString('en-IN', {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric',
                    })}
                  </span>
                </div>
                <div className="flex items-start gap-3 text-slate-600 text-sm">
                  <MapPin className="h-4 w-4 shrink-0 text-slate-400 mt-0.5" />
                  <span className="line-clamp-2">{order.shippingAddress}</span>
                </div>
              </div>

              <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
                <span className="text-sm font-medium text-slate-500">Total Amount</span>
                <span className="text-lg font-bold text-slate-900">
                  ₹{Number(order.totalAmount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
