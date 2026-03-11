
import { AlertCircle, Loader2, PackageSearch, ShoppingCart, Plus, Minus } from 'lucide-react';
import { useCart } from '../../store/CartContext';
import { useProducts } from './hooks/useProducts';

export const ProductCatalog = () => {
  const { products, isLoading, error } = useProducts();
  // Extract cart array and removeFromCart function
  const { cart, addToCart, removeFromCart } = useCart();

  if (isLoading) {
    return (
      <div className="min-h-[40vh] flex flex-col items-center justify-center">
        <Loader2 className="h-10 w-10 text-indigo-600 animate-spin mb-4" />
        <p className="text-slate-500 font-medium">Loading catalog...</p>
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

  if (products.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center shadow-sm">
        <div className="mx-auto h-16 w-16 bg-slate-50 rounded-full flex items-center justify-center mb-4">
          <PackageSearch className="h-8 w-8 text-slate-400" />
        </div>
        <h3 className="text-lg font-bold text-slate-900 mb-2">No products found</h3>
        <p className="text-slate-500">The inventory is currently empty.</p>
      </div>
    );
  }

  return (
    <div className="pb-8">
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {products.map((product) => {
          const availableStock = (product.totalStock || 0) - (product.reservedStock || 0);
          const isOutOfStock = availableStock <= 0;
          const uniqueId = product.id || product.productId;

          // Check if this specific product is currently in the cart
          const cartItem = cart.find(item => (item.id || item.productId) === uniqueId);
          const cartQuantity = cartItem ? cartItem.cartQuantity : 0;

          return (
            <div
              key={uniqueId}
              className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm hover:shadow-md transition-shadow flex flex-col"
            >
              <div className="aspect-square bg-slate-50 rounded-xl mb-4 flex items-center justify-center border border-slate-100">
                <PackageSearch className="h-12 w-12 text-slate-300" />
              </div>

              <div className="flex-grow space-y-2">
                <div className="flex justify-between items-start gap-2">
                  <h3 className="font-bold text-slate-900 leading-tight">{product.name}</h3>
                  <span className="text-lg font-extrabold text-indigo-600 shrink-0">
                    ₹{Number(product.price).toLocaleString('en-IN')}
                  </span>
                </div>
                <p className="text-sm text-slate-500 line-clamp-2">{product.description}</p>
              </div>

              <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between">
                <span
                  className={`text-xs font-bold px-2.5 py-1 rounded-full border ${
                    isOutOfStock
                      ? 'bg-red-50 text-red-600 border-red-100'
                      : 'bg-green-50 text-green-600 border-green-100'
                  }`}
                >
                  {isOutOfStock ? 'Out of Stock' : `${availableStock} in stock`}
                </span>

                {/* DYNAMIC BUTTON RENDER */}
                {cartQuantity > 0 ? (
                  <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-1 border border-slate-200">
                    <button
                      onClick={() => removeFromCart(uniqueId)}
                      className="p-1.5 hover:bg-white rounded-md text-slate-700 shadow-sm transition-all active:scale-95"
                    >
                      <Minus className="h-4 w-4" />
                    </button>
                    
                    <span className="text-sm font-bold text-slate-900 w-6 text-center">
                      {cartQuantity}
                    </span>
                    
                    <button
                      disabled={cartQuantity >= availableStock}
                      onClick={() => addToCart(product)}
                      className="p-1.5 hover:bg-white rounded-md text-slate-700 shadow-sm transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                      title={cartQuantity >= availableStock ? "Max stock reached" : ""}
                    >
                      <Plus className="h-4 w-4" />
                    </button>
                  </div>
                ) : (
                  <button
                    disabled={isOutOfStock}
                    onClick={() => addToCart(product)}
                    className="flex items-center gap-1.5 bg-slate-900 hover:bg-slate-800 disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed text-white px-3 py-2 rounded-lg text-sm font-medium transition-colors active:scale-95"
                  >
                    <ShoppingCart className="h-4 w-4" />
                    Add
                  </button>
                )}

              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

