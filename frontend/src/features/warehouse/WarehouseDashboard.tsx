import {
  AlertTriangle,
  ArrowDownToLine,
  Box,
  Building2,
  CheckCircle,
  Loader2,
  PackageSearch,
  Plus,
  X,
} from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { inventoryApi, warehouseApi } from '../../api/axiosConfig';

// Interfaces based on your backend structures
interface StockItem {
  warehouse_id: string;
  warehouse_name: string;
  location: string;
  product_id: string;
  quantity: number;
  latitude: number;
  longitude: number;
}

interface Product {
  id: string;
  sku: string;
  name: string;
}

interface Warehouse {
  warehouse_id: string;
  name: string;
}

export const WarehouseDashboard = () => {
  // --- Data State ---
  const [inventory, setInventory] = useState<StockItem[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // --- Modal & Form State ---
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [stockForm, setStockForm] = useState({
    warehouseId: '',
    productId: '',
    quantity: '',
  });

  // --- Data Fetching ---
  const fetchDashboardData = async () => {
    setIsLoading(true);
    try {
      // 1. Fetch current stock distribution
      const stockRes = await warehouseApi.get('/stock');
      setInventory(stockRes.data || []);

      // 2. Fetch products for the dropdown (from Java)
      const productsRes = await inventoryApi.get('/products');
      setProducts(productsRes.data.content || productsRes.data || []);

      // 3. Fetch warehouses for the dropdown (from Go)
      // Note: If this endpoint doesn't exist yet, see the note below!
      try {
        const warehouseRes = await warehouseApi.get('/warehouses');
        setWarehouses(warehouseRes.data || []);
      } catch (wErr) {
        console.warn('Could not fetch warehouses list. You may need to add GET /warehouses to Go.');
      }
    } catch (error) {
      console.error('Error fetching warehouse data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  // --- Handlers ---
  const handleReceiveStock = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const payload = {
        product_id: stockForm.productId,
        quantity: parseInt(stockForm.quantity, 10),
      };

      // Hit the Go endpoint to receive stock
      await warehouseApi.post(`/warehouses/${stockForm.warehouseId}/stock`, payload);

      setSuccessMsg(`Successfully received ${payload.quantity} units into inventory!`);
      setStockForm({ warehouseId: '', productId: '', quantity: '' });
      setIsModalOpen(false); // Close modal on success

      // Refresh the table to show the new stock!
      fetchDashboardData();
    } catch (err: any) {
      setErrorMsg(err.response?.data?.error || 'Failed to receive stock.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // --- KPI Calculations ---
  const totalItems = inventory.reduce((sum, item) => sum + item.quantity, 0);
  const lowStockCount = inventory.filter((item) => item.quantity > 0 && item.quantity < 50).length;
  const outOfStockCount = inventory.filter((item) => item.quantity === 0).length;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header & Actions */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900 flex items-center gap-3">
            <Building2 className="h-8 w-8 text-indigo-600" />
            Warehouse Operations
          </h1>
          <p className="text-slate-600 mt-2">Manage physical inventory and incoming shipments.</p>
        </div>
        <button
          onClick={() => {
            setIsModalOpen(true);
            setSuccessMsg(null);
            setErrorMsg(null);
          }}
          className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-xl font-bold transition-all shadow-sm"
        >
          <ArrowDownToLine className="h-5 w-5" /> Receive Stock
        </button>
      </div>

      {/* Global Status Alerts */}
      {successMsg && (
        <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-xl flex items-center justify-between animate-in fade-in slide-in-from-top-4">
          <div className="flex items-center gap-3">
            <CheckCircle className="h-6 w-6 text-green-500" />
            <p className="text-green-700 font-medium">{successMsg}</p>
          </div>
          <button onClick={() => setSuccessMsg(null)}>
            <X className="h-5 w-5 text-green-600 hover:text-green-800" />
          </button>
        </div>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
          <div className="p-4 bg-indigo-50 rounded-xl">
            <Box className="h-8 w-8 text-indigo-600" />
          </div>
          <div>
            <p className="text-sm font-bold text-slate-500 uppercase tracking-wider">
              Total Physical Units
            </p>
            <p className="text-3xl font-black text-slate-900">{totalItems.toLocaleString()}</p>
          </div>
        </div>
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
          <div className="p-4 bg-yellow-50 rounded-xl">
            <AlertTriangle className="h-8 w-8 text-yellow-600" />
          </div>
          <div>
            <p className="text-sm font-bold text-slate-500 uppercase tracking-wider">
              Low Stock Alerts
            </p>
            <p className="text-3xl font-black text-slate-900">{lowStockCount}</p>
          </div>
        </div>
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
          <div className="p-4 bg-red-50 rounded-xl">
            <X className="h-8 w-8 text-red-600" />
          </div>
          <div>
            <p className="text-sm font-bold text-slate-500 uppercase tracking-wider">Stockouts</p>
            <p className="text-3xl font-black text-slate-900">{outOfStockCount}</p>
          </div>
        </div>
      </div>

      {/* Inventory Table */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="px-6 py-5 border-b border-slate-200 bg-slate-50 flex items-center gap-2">
          <PackageSearch className="h-5 w-5 text-slate-500" />
          <h2 className="text-lg font-bold text-slate-900">Live Inventory Distribution</h2>
        </div>
        <div className="overflow-x-auto">
          {isLoading ? (
            <div className="p-12 flex justify-center items-center text-slate-500 gap-3">
              <Loader2 className="h-6 w-6 animate-spin" /> Syncing with physical warehouses...
            </div>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-white border-b border-slate-200 text-sm font-semibold text-slate-600">
                  <th className="px-6 py-4">Facility / Location</th>
                  <th className="px-6 py-4">Product ID (SKU Reference)</th>
                  <th className="px-6 py-4 text-right">Quantity on Hand</th>
                  <th className="px-6 py-4 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {inventory.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-6 py-12 text-center text-slate-500">
                      All warehouses are completely empty. Receive some stock!
                    </td>
                  </tr>
                ) : (
                  inventory.map((item, idx) => (
                    <tr key={idx} className="hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="font-bold text-slate-900">{item.warehouse_name}</div>
                        <div className="text-sm text-slate-500">{item.location}</div>
                      </td>
                      <td className="px-6 py-4 text-sm font-mono text-slate-600">
                        {item.product_id}
                      </td>
                      <td className="px-6 py-4 text-right font-bold text-slate-900 text-lg">
                        {item.quantity.toLocaleString()}
                      </td>
                      <td className="px-6 py-4 text-center">
                        {item.quantity === 0 ? (
                          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-red-100 text-red-800">
                            Out of Stock
                          </span>
                        ) : item.quantity < 50 ? (
                          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-yellow-100 text-yellow-800">
                            Low Stock
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-green-100 text-green-800">
                            Healthy
                          </span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* --- RECEIVE STOCK MODAL --- */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h3 className="font-bold text-lg text-slate-900 flex items-center gap-2">
                <ArrowDownToLine className="h-5 w-5 text-indigo-600" /> Receive Shipment
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleReceiveStock} className="p-6 space-y-5">
              {errorMsg && (
                <div className="p-3 bg-red-50 text-red-700 text-sm font-medium rounded-lg border border-red-200 flex items-start gap-2">
                  <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" /> {errorMsg}
                </div>
              )}

              {/* Warehouse Selection */}
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">
                  Destination Warehouse
                </label>
                {warehouses.length > 0 ? (
                  <select
                    required
                    className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-600 bg-white"
                    value={stockForm.warehouseId}
                    onChange={(e) => setStockForm({ ...stockForm, warehouseId: e.target.value })}
                  >
                    <option value="" disabled>
                      Select a facility...
                    </option>
                    {warehouses.map((w) => (
                      <option key={w.warehouse_id} value={w.warehouse_id}>
                        {w.name}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    required
                    type="text"
                    className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-600"
                    placeholder="Enter Warehouse UUID"
                    value={stockForm.warehouseId}
                    onChange={(e) => setStockForm({ ...stockForm, warehouseId: e.target.value })}
                  />
                )}
              </div>

              {/* Product Selection */}
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">
                  Incoming Product
                </label>
                <select
                  required
                  className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-600 bg-white"
                  value={stockForm.productId}
                  onChange={(e) => setStockForm({ ...stockForm, productId: e.target.value })}
                >
                  <option value="" disabled>
                    Select a product...
                  </option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.sku})
                    </option>
                  ))}
                </select>
              </div>

              {/* Quantity Input */}
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">
                  Quantity Received
                </label>
                <input
                  required
                  type="number"
                  min="1"
                  className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-600"
                  placeholder="e.g. 500"
                  value={stockForm.quantity}
                  onChange={(e) => setStockForm({ ...stockForm, quantity: e.target.value })}
                />
              </div>

              <div className="pt-4 flex gap-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 px-4 py-2.5 border border-slate-300 text-slate-700 font-bold rounded-xl hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  disabled={isSubmitting}
                  type="submit"
                  className="flex-1 flex justify-center items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2.5 rounded-xl font-bold transition-all disabled:opacity-70"
                >
                  {isSubmitting ? (
                    <Loader2 className="animate-spin h-5 w-5" />
                  ) : (
                    <Plus className="h-5 w-5" />
                  )}{' '}
                  Add to Stock
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
