import {
  AlertTriangle,
  Archive,
  ArrowDownToLine,
  Box,
  Building2,
  CheckCircle,
  ClipboardList,
  Loader2,
  PackageSearch,
  Plus,
  Truck,
  X,
} from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { inventoryApi, orderApi, warehouseApi } from '../../api/axiosConfig';

// --- Interfaces ---
interface StockItem {
  warehouseId: string;
  warehouseName: string;
  location: string;
  productId: string;
  quantity: number;
  latitude: number;
  longitude: number;
}

interface Product {
  id: string;
  sku: string;
  name: string;
  lowStockThreshold?: number;
  totalStock?: number;
  reservedStock?: number;
}

interface Warehouse {
  warehouse_id: string;
  name: string;
}

interface OrderToFulfill {
  orderId: string;
  userId: string;
  status: string;
  totalAmount: number;
  shippingAddress: string;
  createdAt: string;
}

export const WarehouseDashboard = () => {
  // --- Tab State ---
  const [activeTab, setActiveTab] = useState<'inventory' | 'fulfillment' | 'completed'>(() => {
    return (sessionStorage.getItem('warehouseActiveTab') as any) || 'inventory';
  });

  // --- Data State ---
  const [inventory, setInventory] = useState<StockItem[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [allSystemOrders, setAllSystemOrders] = useState<OrderToFulfill[]>([]);

  // Dual-cache flags
  const [hasFetchedInventory, setHasFetchedInventory] = useState(false);
  const [hasFetchedOrders, setHasFetchedOrders] = useState(false);
  /** Separate flags so inventory vs orders requests do not clobber each other's UI (avoids stuck spinners). */
  const [inventoryLoading, setInventoryLoading] = useState(false);
  const [ordersLoading, setOrdersLoading] = useState(false);

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

  // 1. Save tab state
  useEffect(() => {
    sessionStorage.setItem('warehouseActiveTab', activeTab);
  }, [activeTab]);

  // NEW: Auto-dismiss success/error messages after 5 seconds
  useEffect(() => {
    if (successMsg || errorMsg) {
      const timer = setTimeout(() => {
        setSuccessMsg(null);
        setErrorMsg(null);
      }, 5000); // 5000ms = 5 seconds

      // Cleanup function to prevent memory leaks if component unmounts
      return () => clearTimeout(timer);
    }
  }, [successMsg, errorMsg]);

  // --- Data Fetching ---
  const fetchInventoryData = async () => {
    setInventoryLoading(true);
    try {
      const stockRes = await warehouseApi.get('/stock');
      setInventory(stockRes.data || []);

      const productsRes = await inventoryApi.get('/products');
      setProducts(productsRes.data.content || productsRes.data || []);

      try {
        const warehouseRes = await warehouseApi.get('/warehouses');
        setWarehouses(warehouseRes.data || []);
      } catch (wErr) {
        console.warn('Could not fetch warehouses list.');
      }
      setHasFetchedInventory(true);
    } catch (error) {
      console.error('Error fetching inventory data:', error);
      setErrorMsg('Could not load inventory. You may need Warehouse Manager or Admin access.');
      setHasFetchedInventory(true);
    } finally {
      setInventoryLoading(false);
    }
  };

  const fetchOrdersData = async () => {
    setOrdersLoading(true);
    try {
      const ordersRes = await orderApi.get('/orders/all');
      setAllSystemOrders(ordersRes.data || []);
      setHasFetchedOrders(true);
    } catch (error) {
      console.error('Error fetching orders data:', error);
      setErrorMsg('Could not load orders queue. Warehouse Manager or Admin role is required.');
      setHasFetchedOrders(true);
    } finally {
      setOrdersLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'inventory' && !hasFetchedInventory) {
      fetchInventoryData();
    } else if ((activeTab === 'fulfillment' || activeTab === 'completed') && !hasFetchedOrders) {
      fetchOrdersData();
    }
  }, [activeTab, hasFetchedInventory, hasFetchedOrders]);

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
      await warehouseApi.post(`/warehouses/${stockForm.warehouseId}/stock`, payload);
      setSuccessMsg(`Successfully received ${payload.quantity} units!`);
      setStockForm({ warehouseId: '', productId: '', quantity: '' });
      setIsModalOpen(false);

      setHasFetchedInventory(false);
    } catch (err: any) {
      const status = err.response?.status;
      if (status === 403) {
        setErrorMsg('Not allowed: receiving stock requires a Warehouse Manager or Admin account.');
      } else {
        setErrorMsg(err.response?.data?.error || 'Failed to receive stock.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleShipOrder = async (orderId: string) => {
    try {
      await orderApi.put(`/orders/${orderId}/status`, { status: 'SHIPPED' });
      setSuccessMsg(`Order #${orderId.substring(0, 8)} has been marked as Shipped!`);
      setHasFetchedOrders(false);
      setHasFetchedInventory(false);
    } catch (err: any) {
      if (err.response?.status === 403) {
        setErrorMsg('Not allowed: shipping orders requires Warehouse Manager or Admin.');
      } else {
        setErrorMsg('Failed to update order status.');
      }
      console.error(err);
    }
  };

  // --- Derived Metrics ---
  const totalItems = inventory.reduce((sum, item) => sum + item.quantity, 0);
  const lowStockCount = inventory.filter((item) => {
    const productInfo = products.find((p) => p.id === item.productId);
    const threshold = productInfo?.lowStockThreshold || 10;
    return item.quantity > 0 && item.quantity <= threshold;
  }).length;
  const outOfStockCount = inventory.filter((item) => item.quantity === 0).length;

  const pendingStatuses = ['CONFIRMED', 'PENDING_INVENTORY'];
  const pendingOrders = allSystemOrders.filter((o) => pendingStatuses.includes(o.status));
  const completedOrders = allSystemOrders.filter((o) => o.status === 'SHIPPED');

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header & Actions */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900 flex items-center gap-3">
            <Building2 className="h-8 w-8 text-indigo-600" />
            Warehouse Operations
          </h1>
          <p className="text-slate-600 mt-2">Manage physical inventory and pack outgoing orders.</p>
        </div>
        {activeTab === 'inventory' && (
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
        )}
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
      {errorMsg && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl flex items-center justify-between animate-in fade-in slide-in-from-top-4">
          <div className="flex items-center gap-3">
            <AlertTriangle className="h-6 w-6 text-red-500" />
            <p className="text-red-700 font-medium">{errorMsg}</p>
          </div>
          <button onClick={() => setErrorMsg(null)}>
            <X className="h-5 w-5 text-red-600 hover:text-red-800" />
          </button>
        </div>
      )}

      {/* Navigation Tabs */}
      <div className="flex space-x-1 bg-slate-100 p-1 rounded-xl mb-8 max-w-2xl border border-slate-200">
        <button
          onClick={() => {
            setActiveTab('inventory');
            setSuccessMsg(null);
            setErrorMsg(null);
          }}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-bold rounded-lg transition-all ${
            activeTab === 'inventory'
              ? 'bg-white text-slate-900 shadow-sm'
              : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50'
          }`}
        >
          <PackageSearch className="h-4 w-4" /> Live Inventory
        </button>
        <button
          onClick={() => {
            setActiveTab('fulfillment');
            setSuccessMsg(null);
            setErrorMsg(null);
          }}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-bold rounded-lg transition-all ${
            activeTab === 'fulfillment'
              ? 'bg-white text-slate-900 shadow-sm'
              : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50'
          }`}
        >
          <ClipboardList className="h-4 w-4" /> Fulfillment Queue
        </button>
        <button
          onClick={() => {
            setActiveTab('completed');
            setSuccessMsg(null);
            setErrorMsg(null);
          }}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-bold rounded-lg transition-all ${
            activeTab === 'completed'
              ? 'bg-white text-slate-900 shadow-sm'
              : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50'
          }`}
        >
          <Archive className="h-4 w-4" /> Completed Orders
        </button>
      </div>

      {/* --- INVENTORY TAB --- */}
      {activeTab === 'inventory' && (
        <>
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
                <p className="text-sm font-bold text-slate-500 uppercase tracking-wider">
                  Stockouts
                </p>
                <p className="text-3xl font-black text-slate-900">{outOfStockCount}</p>
              </div>
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
            <div className="px-6 py-5 border-b border-slate-200 bg-slate-50 flex items-center gap-2">
              <PackageSearch className="h-5 w-5 text-slate-500" />
              <h2 className="text-lg font-bold text-slate-900">Live Inventory Distribution</h2>
            </div>
            <div className="overflow-x-auto">
              {inventoryLoading && inventory.length === 0 ? (
                <div className="p-12 flex justify-center items-center text-slate-500 gap-3">
                  <Loader2 className="h-6 w-6 animate-spin" /> Syncing with physical warehouses...
                </div>
              ) : (
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-white border-b border-slate-200 text-sm font-semibold text-slate-600">
                      <th className="px-6 py-4">Facility / Location</th>
                      <th className="px-6 py-4">Product Details</th>
                      <th className="px-6 py-4 text-right">Stock Levels</th>
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
                      inventory.map((item, idx) => {
                        const productInfo = products.find((p) => p.id === item.productId);
                        const threshold = productInfo?.lowStockThreshold || 10;
                        const globalStock = productInfo?.totalStock || 0;

                        return (
                          <tr key={idx} className="hover:bg-slate-50 transition-colors">
                            <td className="px-6 py-4">
                              <div className="font-bold text-slate-900">{item.warehouseName}</div>
                              <div className="text-sm text-slate-500">{item.location}</div>
                            </td>

                            <td className="px-6 py-4">
                              <div className="font-bold text-slate-900 text-sm">
                                {productInfo ? productInfo.name : 'Unknown Product'}
                              </div>
                              <div className="text-xs font-mono text-slate-500 mt-0.5">
                                {productInfo ? productInfo.sku : item.productId.substring(0, 8)}
                              </div>
                            </td>

                            <td className="px-6 py-4 text-right">
                              <div className="font-bold text-slate-900 text-lg">
                                {item.quantity.toLocaleString()}{' '}
                                <span className="text-xs font-medium text-slate-400">Local</span>
                              </div>
                              {productInfo && (
                                <div
                                  className="text-xs font-bold text-indigo-600 mt-0.5"
                                  title="Total stock across all warehouses"
                                >
                                  {globalStock.toLocaleString()}{' '}
                                  <span className="font-medium text-indigo-400">Global</span>
                                </div>
                              )}
                            </td>

                            <td className="px-6 py-4 text-center">
                              {(() => {
                                if (item.quantity === 0) {
                                  return (
                                    <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-red-100 text-red-800">
                                      Out of Stock
                                    </span>
                                  );
                                } else if (item.quantity <= threshold) {
                                  return (
                                    <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-yellow-100 text-yellow-800">
                                      Low Stock
                                    </span>
                                  );
                                } else {
                                  return (
                                    <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-green-100 text-green-800">
                                      Healthy
                                    </span>
                                  );
                                }
                              })()}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </>
      )}

      {/* --- FULFILLMENT TAB --- */}
      {activeTab === 'fulfillment' && (
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
          <div className="px-6 py-5 border-b border-slate-200 bg-slate-50 flex justify-between items-center">
            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <ClipboardList className="h-5 w-5 text-slate-500" />
              Active Fulfillment Queue
            </h2>
            <span className="bg-yellow-100 text-yellow-800 px-3 py-1 rounded-full text-xs font-bold">
              {pendingOrders.length} Pending
            </span>
          </div>

          <div className="overflow-x-auto">
            {ordersLoading && allSystemOrders.length === 0 ? (
              <div className="p-12 flex justify-center items-center text-slate-500 gap-3">
                <Loader2 className="h-6 w-6 animate-spin" /> Fetching active orders...
              </div>
            ) : (
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-white border-b border-slate-200 text-sm font-semibold text-slate-600">
                    <th className="px-6 py-4">Order ID & Date</th>
                    <th className="px-6 py-4">Shipping Address</th>
                    <th className="px-6 py-4 text-center">Status</th>
                    <th className="px-6 py-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {pendingOrders.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-6 py-12 text-center text-slate-500">
                        No orders are currently waiting to be shipped. Great job!
                      </td>
                    </tr>
                  ) : (
                    pendingOrders.map((order) => (
                      <tr key={order.orderId} className="hover:bg-slate-50 transition-colors">
                        <td className="px-6 py-4">
                          <div className="font-mono font-bold text-slate-900 text-sm">
                            #{order.orderId.substring(0, 8)}
                          </div>
                          <div className="text-sm text-slate-500 mt-1">
                            {new Date(order.createdAt).toLocaleString()}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-sm text-slate-700 max-w-xs line-clamp-2">
                            {order.shippingAddress}
                          </div>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-yellow-100 text-yellow-800">
                            {order.status.replace('_', ' ')}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <button
                            onClick={() => handleShipOrder(order.orderId)}
                            className="inline-flex items-center justify-center gap-2 bg-slate-900 hover:bg-slate-800 text-white px-4 py-2 rounded-lg text-sm font-bold transition-all shadow-sm active:scale-95"
                          >
                            <Truck className="h-4 w-4" /> Ship Order
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* --- COMPLETED ORDERS TAB --- */}
      {activeTab === 'completed' && (
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
          <div className="px-6 py-5 border-b border-slate-200 bg-slate-50 flex justify-between items-center">
            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <Archive className="h-5 w-5 text-slate-500" />
              Completed Shipments
            </h2>
            <span className="bg-indigo-100 text-indigo-800 px-3 py-1 rounded-full text-xs font-bold">
              {completedOrders.length} Shipped
            </span>
          </div>

          <div className="overflow-x-auto">
            {ordersLoading && allSystemOrders.length === 0 ? (
              <div className="p-12 flex justify-center items-center text-slate-500 gap-3">
                <Loader2 className="h-6 w-6 animate-spin" /> Fetching shipment history...
              </div>
            ) : (
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-white border-b border-slate-200 text-sm font-semibold text-slate-600">
                    <th className="px-6 py-4">Order ID & Date</th>
                    <th className="px-6 py-4">Shipping Address</th>
                    <th className="px-6 py-4 text-center">Status</th>
                    <th className="px-6 py-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {completedOrders.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-6 py-12 text-center text-slate-500">
                        No orders have been shipped yet.
                      </td>
                    </tr>
                  ) : (
                    completedOrders.map((order) => (
                      <tr key={order.orderId} className="bg-slate-50 opacity-90 transition-colors">
                        <td className="px-6 py-4">
                          <div className="font-mono font-bold text-slate-900 text-sm">
                            #{order.orderId.substring(0, 8)}
                          </div>
                          <div className="text-sm text-slate-500 mt-1">
                            {new Date(order.createdAt).toLocaleString()}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-sm text-slate-700 max-w-xs line-clamp-2">
                            {order.shippingAddress}
                          </div>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-blue-100 text-blue-800">
                            SHIPPED
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <span className="inline-flex items-center gap-1.5 text-green-600 font-bold text-sm px-4 py-2">
                            <CheckCircle className="h-4 w-4" /> Dispatched
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

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
