import {
  AlertCircle,
  Boxes,
  CheckCircle,
  Image as ImageIcon,
  Loader2,
  MapPin,
  PackagePlus,
  PackageSearch,
  Plus,
  ShieldAlert,
} from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { inventoryApi, warehouseApi } from '../../api/axiosConfig';

// Define the Product interface (Restored the Stock fields!)
interface Product {
  product_id?: string;
  id?: string;
  sku: string;
  name: string;
  description: string;
  price: number;
  imageUrl?: string;
  totalStock?: number;
  reservedStock?: number;
}

export const AdminDashboard = () => {
  const [activeTab, setActiveTab] = useState<'add-product' | 'catalog' | 'add-warehouse'>(() => {
    return (sessionStorage.getItem('adminActiveTab') as any) || 'add-product';
  });

  // --- UI State ---
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // --- Data State ---
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoadingProducts, setIsLoadingProducts] = useState(false);

  // NEW: A dedicated flag to track if we already pulled from the DB
  const [hasFetchedCatalog, setHasFetchedCatalog] = useState(false);

  // --- Form State ---
  const [productForm, setProductForm] = useState({
    sku: '',
    name: '',
    description: '',
    price: '',
    imageUrl: '',
  });

  const [warehouseForm, setWarehouseForm] = useState({
    name: '',
    location: '',
    capacity: '',
    latitude: '',
    longitude: '',
  });

  useEffect(() => {
    sessionStorage.setItem('adminActiveTab', activeTab);
  }, [activeTab]);

  // --- Data Fetching ---
  const fetchProducts = async () => {
    setIsLoadingProducts(true);
    try {
      const response = await inventoryApi.get('/products');
      setProducts(response.data.content || response.data || []);
      setHasFetchedCatalog(true); // Mark as successfully fetched!
    } catch (err: any) {
      console.error('Failed to fetch products', err);
    } finally {
      setIsLoadingProducts(false);
    }
  };

  // Fetch products ONLY when navigating to the catalog tab AND if we haven't fetched yet
  useEffect(() => {
    if (activeTab === 'catalog' && !hasFetchedCatalog) {
      fetchProducts();
    }
  }, [activeTab, hasFetchedCatalog]);

  // --- Handlers ---
  const handleProductSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const payload = {
        sku: productForm.sku,
        name: productForm.name,
        description: productForm.description,
        price: parseFloat(productForm.price),
        imageUrl: productForm.imageUrl,
      };

      await inventoryApi.post('/products', payload);
      setSuccessMsg(`Successfully created product: ${productForm.name}`);
      setProductForm({ sku: '', name: '', description: '', price: '', imageUrl: '' }); // Reset

      // NEW: Invalidate the cache so the catalog tab knows it needs to fetch fresh data!
      setHasFetchedCatalog(false);

      // Auto-switch to the catalog tab
      setActiveTab('catalog');
    } catch (err: any) {
      setErrorMsg(
        err.response?.data?.message || 'Failed to create product. Check if SKU is unique.',
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleWarehouseSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const payload = {
        name: warehouseForm.name,
        location: warehouseForm.location,
        capacity: parseInt(warehouseForm.capacity, 10),
        latitude: parseFloat(warehouseForm.latitude),
        longitude: parseFloat(warehouseForm.longitude),
      };

      await warehouseApi.post('/warehouses', payload);
      setSuccessMsg(`Successfully registered warehouse: ${warehouseForm.name}`);
      setWarehouseForm({ name: '', location: '', capacity: '', latitude: '', longitude: '' }); // Reset
    } catch (err: any) {
      setErrorMsg(err.response?.data?.error || 'Failed to create warehouse.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-extrabold text-slate-900 flex items-center gap-3">
          <ShieldAlert className="h-8 w-8 text-indigo-600" />
          Administrator Control Panel
        </h1>
        <p className="text-slate-600 mt-2">Manage global catalog and physical infrastructure.</p>
      </div>

      {/* Status Messages */}
      {successMsg && (
        <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-xl flex items-center gap-3 animate-in fade-in slide-in-from-top-4">
          <CheckCircle className="h-6 w-6 text-green-500" />
          <p className="text-green-700 font-medium">{successMsg}</p>
        </div>
      )}
      {errorMsg && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl flex items-center gap-3 animate-in fade-in slide-in-from-top-4">
          <AlertCircle className="h-6 w-6 text-red-500" />
          <p className="text-red-700 font-medium">{errorMsg}</p>
        </div>
      )}

      {/* 3-Part Navigation Tabs */}
      <div className="flex space-x-1 bg-slate-100 p-1 rounded-xl mb-8 max-w-2xl border border-slate-200">
        <button
          onClick={() => {
            setActiveTab('add-product');
            setSuccessMsg(null);
            setErrorMsg(null);
          }}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-bold rounded-lg transition-all ${
            activeTab === 'add-product'
              ? 'bg-white text-slate-900 shadow-sm'
              : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50'
          }`}
        >
          <PackagePlus className="h-4 w-4" /> Add New Product
        </button>
        <button
          onClick={() => {
            setActiveTab('catalog');
            setSuccessMsg(null);
            setErrorMsg(null);
          }}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-bold rounded-lg transition-all ${
            activeTab === 'catalog'
              ? 'bg-white text-slate-900 shadow-sm'
              : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50'
          }`}
        >
          <Boxes className="h-4 w-4" /> View Catalog
        </button>
        <button
          onClick={() => {
            setActiveTab('add-warehouse');
            setSuccessMsg(null);
            setErrorMsg(null);
          }}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-bold rounded-lg transition-all ${
            activeTab === 'add-warehouse'
              ? 'bg-white text-slate-900 shadow-sm'
              : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50'
          }`}
        >
          <MapPin className="h-4 w-4" /> Add Warehouse
        </button>
      </div>

      {/* --- ADD PRODUCT TAB CONTENT --- */}
      {activeTab === 'add-product' && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 md:p-8 shadow-sm">
          <form onSubmit={handleProductSubmit} className="max-w-3xl">
            <h2 className="text-xl font-bold text-slate-900 mb-6 flex items-center gap-2">
              <PackagePlus className="h-5 w-5 text-indigo-600" /> Create New Product
            </h2>

            <div className="space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">
                    SKU (Unique)
                  </label>
                  <input
                    required
                    type="text"
                    className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-600"
                    placeholder="LAP-X1-PRO"
                    value={productForm.sku}
                    onChange={(e) => setProductForm({ ...productForm, sku: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">Price (₹)</label>
                  <input
                    required
                    type="number"
                    step="0.01"
                    className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-600"
                    placeholder="85000.00"
                    value={productForm.price}
                    onChange={(e) => setProductForm({ ...productForm, price: e.target.value })}
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">Product Name</label>
                <input
                  required
                  type="text"
                  maxLength={100}
                  className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-600"
                  placeholder="Pro Laptop X1"
                  value={productForm.name}
                  onChange={(e) => setProductForm({ ...productForm, name: e.target.value })}
                />
              </div>

              <div>
                <label className="flex items-center gap-1.5 text-sm font-bold text-slate-700 mb-1">
                  <ImageIcon className="h-4 w-4 text-slate-400" /> Image URL
                </label>
                <input
                  type="url"
                  maxLength={255}
                  className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-600"
                  placeholder="https://example.com/image.png"
                  value={productForm.imageUrl}
                  onChange={(e) => setProductForm({ ...productForm, imageUrl: e.target.value })}
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">Description</label>
                <textarea
                  required
                  rows={3}
                  className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-600 resize-none"
                  placeholder="Detailed product description..."
                  value={productForm.description}
                  onChange={(e) => setProductForm({ ...productForm, description: e.target.value })}
                />
              </div>

              <div className="pt-2">
                <button
                  disabled={isSubmitting}
                  type="submit"
                  className="flex items-center justify-center gap-2 w-full sm:w-auto bg-indigo-600 hover:bg-indigo-700 text-white px-8 py-3 rounded-xl font-bold transition-all disabled:opacity-70 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? (
                    <Loader2 className="animate-spin h-5 w-5" />
                  ) : (
                    <Plus className="h-5 w-5" />
                  )}{' '}
                  Save Product to Catalog
                </button>
              </div>
            </div>
          </form>
        </div>
      )}

      {/* --- VIEW CATALOG TAB CONTENT --- */}
      {activeTab === 'catalog' && (
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
          <div className="px-6 py-5 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <PackageSearch className="h-5 w-5 text-slate-500" />
              Current Global Catalog
            </h2>
          </div>

          <div className="overflow-x-auto">
            {isLoadingProducts ? (
              <div className="p-8 flex justify-center items-center text-slate-500 gap-2">
                <Loader2 className="h-5 w-5 animate-spin" /> Loading catalog...
              </div>
            ) : (
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-white border-b border-slate-200 text-sm font-semibold text-slate-600">
                    <th className="px-6 py-4 w-16">Image</th>
                    <th className="px-6 py-4">Product Details</th>
                    <th className="px-6 py-4">SKU</th>
                    <th className="px-6 py-4 text-center">Global Stock</th>
                    <th className="px-6 py-4 text-right">Price</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {products.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-6 py-8 text-center text-slate-500">
                        No products found in the catalog. Switch to "Add New Product" to create one!
                      </td>
                    </tr>
                  ) : (
                    products.map((product) => {
                      const total = product.totalStock || 0;
                      const reserved = product.reservedStock || 0;
                      const available = total - reserved;

                      return (
                        <tr
                          key={product.id || product.product_id || product.sku}
                          className="hover:bg-slate-50 transition-colors"
                        >
                          <td className="px-6 py-4">
                            {product.imageUrl ? (
                              <img
                                src={product.imageUrl}
                                alt={product.name}
                                className="h-12 w-12 rounded-lg object-cover border border-slate-200"
                              />
                            ) : (
                              <div className="h-12 w-12 rounded-lg bg-slate-100 flex items-center justify-center border border-slate-200">
                                <ImageIcon className="h-5 w-5 text-slate-400" />
                              </div>
                            )}
                          </td>
                          <td className="px-6 py-4">
                            <div className="font-bold text-slate-900">{product.name}</div>
                            <div
                              className="text-sm text-slate-500 line-clamp-1 max-w-md"
                              title={product.description}
                            >
                              {product.description}
                            </div>
                          </td>
                          <td className="px-6 py-4 text-sm font-mono text-slate-600 font-medium">
                            {product.sku}
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex flex-col items-center">
                              <span
                                className={`text-sm font-bold ${available > 0 ? 'text-green-600' : 'text-red-500'}`}
                              >
                                {available} Available
                              </span>
                              <span className="text-xs text-slate-400">
                                ({total} Total | {reserved} Reserved)
                              </span>
                            </div>
                          </td>
                          <td className="px-6 py-4 text-right font-bold text-slate-900">
                            ₹
                            {product.price.toLocaleString('en-IN', {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })}
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
      )}

      {/* --- ADD WAREHOUSE TAB CONTENT --- */}
      {activeTab === 'add-warehouse' && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 md:p-8 shadow-sm">
          <form onSubmit={handleWarehouseSubmit} className="max-w-2xl">
            <h2 className="text-xl font-bold text-slate-900 mb-6 flex items-center gap-2">
              <MapPin className="h-5 w-5 text-indigo-600" /> Register Physical Warehouse
            </h2>

            <div className="space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="md:col-span-2">
                  <label className="block text-sm font-bold text-slate-700 mb-1">
                    Warehouse Name
                  </label>
                  <input
                    required
                    type="text"
                    className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-600"
                    placeholder="e.g. South Bengaluru Distribution Center"
                    value={warehouseForm.name}
                    onChange={(e) => setWarehouseForm({ ...warehouseForm, name: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">
                    General Location
                  </label>
                  <input
                    required
                    type="text"
                    className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-600"
                    placeholder="e.g. JP Nagar"
                    value={warehouseForm.location}
                    onChange={(e) =>
                      setWarehouseForm({ ...warehouseForm, location: e.target.value })
                    }
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">
                    Max Capacity (Units)
                  </label>
                  <input
                    required
                    type="number"
                    min="1"
                    className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-600"
                    placeholder="100000"
                    value={warehouseForm.capacity}
                    onChange={(e) =>
                      setWarehouseForm({ ...warehouseForm, capacity: e.target.value })
                    }
                  />
                </div>
                <div className="p-5 bg-slate-50 border border-slate-200 rounded-xl md:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-5 mt-2">
                  <div className="sm:col-span-2">
                    <p className="text-sm font-bold text-slate-800">
                      Geospatial Routing Coordinates
                    </p>
                    <p className="text-xs text-slate-500 mt-1">
                      Required for the Haversine distance calculations.
                    </p>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1">Latitude</label>
                    <input
                      required
                      type="number"
                      step="any"
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-600"
                      placeholder="12.9063"
                      value={warehouseForm.latitude}
                      onChange={(e) =>
                        setWarehouseForm({ ...warehouseForm, latitude: e.target.value })
                      }
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1">Longitude</label>
                    <input
                      required
                      type="number"
                      step="any"
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-600"
                      placeholder="77.5857"
                      value={warehouseForm.longitude}
                      onChange={(e) =>
                        setWarehouseForm({ ...warehouseForm, longitude: e.target.value })
                      }
                    />
                  </div>
                </div>
              </div>

              <div className="pt-2">
                <button
                  disabled={isSubmitting}
                  type="submit"
                  className="flex items-center justify-center gap-2 w-full sm:w-auto bg-slate-900 hover:bg-slate-800 text-white px-8 py-3 rounded-xl font-bold transition-all mt-4 disabled:opacity-70 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? (
                    <Loader2 className="animate-spin h-5 w-5" />
                  ) : (
                    <Plus className="h-5 w-5" />
                  )}{' '}
                  Initialize Warehouse
                </button>
              </div>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
