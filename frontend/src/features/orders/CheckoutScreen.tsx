import { AlertCircle, Loader2, MapPin, Navigation, Package, ShoppingBag } from 'lucide-react';
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { orderApi } from '../../api/axiosConfig';
import { useCart } from '../../store/CartContext';

export const CheckoutScreen = () => {
  const { cart, cartTotal, clearCart } = useCart();
  const navigate = useNavigate();

  // Form State
  const [address, setAddress] = useState('');
  const [latitude, setLatitude] = useState<string>('');
  const [longitude, setLongitude] = useState<string>('');

  // Submission State
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // HTML5 Geolocation helper for the Haversine Routing Engine test
  const handleGetLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setLatitude(position.coords.latitude.toString());
          setLongitude(position.coords.longitude.toString());
        },
        (err) => {
          console.error("Geolocation error:", err);
          alert("Could not get location. Please enter manually.");
        }
      );
    } else {
      alert("Geolocation is not supported by this browser.");
    }
  };

  const handleCheckout = async (e: React.FormEvent) => {
    e.preventDefault();
    if (cart.length === 0) return;

    setIsSubmitting(true);
    setError(null);

    try {
      // 1. Format the payload to match the Java OrderRequest DTO
      const orderPayload = {
        shippingAddress: address,
        shippingLatitude: parseFloat(latitude),
        shippingLongitude: parseFloat(longitude),
        items: cart.map(item => ({
          productId: item.id || item.productId,
          quantity: item.cartQuantity
        }))
      };

      // 2. Send to Spring Boot (OrderController @PostMapping)
      await orderApi.post('/orders', orderPayload);

      // 3. On success, clear the cart and redirect to Order History
      clearCart();
      navigate('/app/orders');

    } catch (err: any) {
      console.error("Checkout failed:", err);
      setError(err.response?.data?.message || "Failed to place order. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // --- EMPTY CART STATE ---
  if (cart.length === 0) {
    return (
      <div className="max-w-3xl mx-auto p-12 text-center bg-white rounded-2xl border border-slate-200 shadow-sm mt-8">
        <div className="mx-auto h-16 w-16 bg-slate-50 rounded-full flex items-center justify-center mb-4">
          <ShoppingBag className="h-8 w-8 text-slate-400" />
        </div>
        <h2 className="text-2xl font-bold text-slate-900 mb-2">Your cart is empty</h2>
        <p className="text-slate-500 mb-8">Looks like you haven't added anything to your cart yet.</p>
        <button
          onClick={() => navigate('/app/products')}
          className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2.5 rounded-lg font-medium transition-colors"
        >
          Continue Shopping
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <h1 className="text-3xl font-extrabold text-slate-900 mb-8">Checkout</h1>

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl flex items-center gap-3">
          <AlertCircle className="h-6 w-6 text-red-500" />
          <p className="text-red-700 font-medium">{error}</p>
        </div>
      )}

      <div className="grid lg:grid-cols-12 gap-8">
        {/* LEFT COLUMN: Shipping Form */}
        <div className="lg:col-span-7 space-y-6">
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
            <h2 className="text-xl font-bold text-slate-900 mb-6 flex items-center gap-2">
              <MapPin className="h-5 w-5 text-indigo-600" />
              Shipping Details
            </h2>

            <form id="checkout-form" onSubmit={handleCheckout} className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Full Delivery Address
                </label>
                <textarea
                  required
                  rows={3}
                  className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-600 focus:border-indigo-600 transition-colors resize-none"
                  placeholder="123 Main St, Apartment 4B, City, State, ZIP"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                />
              </div>

              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
                <div className="flex justify-between items-center mb-4">
                  <label className="block text-sm font-bold text-slate-700">
                    Smart Routing Coordinates
                  </label>
                  <button
                    type="button"
                    onClick={handleGetLocation}
                    className="flex items-center gap-1.5 text-xs font-bold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 px-3 py-1.5 rounded-md transition-colors"
                  >
                    <Navigation className="h-3 w-3" />
                    Auto-Detect
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-500 mb-1">Latitude</label>
                    <input
                      required
                      type="number"
                      step="any"
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-600 sm:text-sm"
                      placeholder="e.g. 12.9716"
                      value={latitude}
                      onChange={(e) => setLatitude(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-500 mb-1">Longitude</label>
                    <input
                      required
                      type="number"
                      step="any"
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-600 sm:text-sm"
                      placeholder="e.g. 77.5946"
                      value={longitude}
                      onChange={(e) => setLongitude(e.target.value)}
                    />
                  </div>
                </div>
                <p className="text-xs text-slate-500 mt-3">
                  * Coordinates are required to route your order to the closest warehouse.
                </p>
              </div>
            </form>
          </div>
        </div>

        {/* RIGHT COLUMN: Order Summary */}
        <div className="lg:col-span-5">
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm sticky top-24">
            <h2 className="text-xl font-bold text-slate-900 mb-6 flex items-center gap-2">
              <Package className="h-5 w-5 text-indigo-600" />
              Order Summary
            </h2>

            <div className="space-y-4 mb-6 max-h-[40vh] overflow-y-auto pr-2">
              {cart.map((item) => (
                <div key={item.id || item.productId} className="flex justify-between items-start pb-4 border-b border-slate-100 last:border-0 last:pb-0">
                  <div className="pr-4">
                    <h4 className="text-sm font-bold text-slate-900 line-clamp-1">{item.name}</h4>
                    <p className="text-sm text-slate-500 mt-0.5">Qty: {item.cartQuantity}</p>
                  </div>
                  <div className="text-sm font-bold text-slate-900 shrink-0">
                    ₹{(item.price * item.cartQuantity).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </div>
                </div>
              ))}
            </div>

            <div className="border-t border-slate-200 pt-4 space-y-3 mb-6">
              <div className="flex justify-between text-sm text-slate-600">
                <span>Subtotal</span>
                <span>₹{cartTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
              </div>
              <div className="flex justify-between text-sm text-slate-600">
                <span>Shipping</span>
                <span className="text-green-600 font-medium">Free</span>
              </div>
              <div className="flex justify-between text-lg font-extrabold text-slate-900 pt-2 border-t border-slate-100">
                <span>Total</span>
                <span>₹{cartTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
              </div>
            </div>

            <button
              form="checkout-form"
              type="submit"
              disabled={isSubmitting}
              className="w-full flex justify-center items-center gap-2 bg-slate-900 hover:bg-slate-800 text-white py-3.5 px-4 rounded-xl font-bold transition-all disabled:opacity-70 disabled:cursor-not-allowed shadow-md hover:shadow-lg"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="animate-spin h-5 w-5" />
                  Processing...
                </>
              ) : (
                'Place Order'
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
