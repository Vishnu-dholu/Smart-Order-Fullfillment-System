
**Tags:** #react #dashboard #rbac #admin #ssp-lab **Date:** 2026-03-12

#### 📌 The Objective

Build a protected `/admin` route strictly for users with the `ADMIN` role. It will feature two primary forms:

1. **New Product Form:** Posts `Product` DTOs to the Java `inventory-service` (`/products`).
    
2. **New Warehouse Form:** Posts `Warehouse` struct payloads to the Go `warehouse-service` (`/warehouses`).
    

---

### 💻 Step 1: Create the Admin Dashboard Component

Create a new file in your features folder. Let's make an `admin` directory for it. **File:** `src/features/admin/AdminDashboard.tsx`

```tsx
import { AlertCircle, Boxes, CheckCircle, Loader2, MapPin, PackagePlus, Plus, ShieldAlert } from 'lucide-react';
import React, { useState } from 'react';
import { inventoryApi, warehouseApi } from '../../api/axiosConfig';

export const AdminDashboard = () => {
  const [activeTab, setActiveTab] = useState<'products' | 'warehouses'>('products');

  // --- UI State ---
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // --- Product Form State (Java Backend) ---
  const [productForm, setProductForm] = useState({
    sku: '', name: '', description: '', price: '', imageUrl: ''
  });

  // --- Warehouse Form State (Go Backend) ---
  const [warehouseForm, setWarehouseForm] = useState({
    name: '', location: '', capacity: '', latitude: '', longitude: ''
  });

  // --- Handlers ---
  const handleProductSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const payload = {
        ...productForm,
        price: parseFloat(productForm.price)
      };
      
      await inventoryApi.post('/products', payload);
      setSuccessMsg(`Successfully created product: ${productForm.name}`);
      setProductForm({ sku: '', name: '', description: '', price: '', imageUrl: '' }); // Reset
    } catch (err: any) {
      setErrorMsg(err.response?.data?.message || 'Failed to create product.');
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
        longitude: parseFloat(warehouseForm.longitude)
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

      {/* Tabs */}
      <div className="flex space-x-1 bg-slate-100 p-1 rounded-xl mb-8 max-w-md border border-slate-200">
        <button
          onClick={() => { setActiveTab('products'); setSuccessMsg(null); setErrorMsg(null); }}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-bold rounded-lg transition-all ${
            activeTab === 'products' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50'
          }`}
        >
          <Boxes className="h-4 w-4" /> Global Catalog
        </button>
        <button
          onClick={() => { setActiveTab('warehouses'); setSuccessMsg(null); setErrorMsg(null); }}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-bold rounded-lg transition-all ${
            activeTab === 'warehouses' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50'
          }`}
        >
          <MapPin className="h-4 w-4" /> Warehouses
        </button>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 p-6 md:p-8 shadow-sm">
        
        {/* --- PRODUCTS TAB --- */}
        {activeTab === 'products' && (
          <form onSubmit={handleProductSubmit} className="max-w-2xl">
            <h2 className="text-xl font-bold text-slate-900 mb-6 flex items-center gap-2">
              <PackagePlus className="h-5 w-5 text-indigo-600" /> Create New Product
            </h2>
            <div className="space-y-5">
              <div className="grid grid-cols-2 gap-5">
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">SKU</label>
                  <input required type="text" className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-600" placeholder="LAP-X1-PRO"
                    value={productForm.sku} onChange={e => setProductForm({...productForm, sku: e.target.value})} />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">Price (₹)</label>
                  <input required type="number" step="0.01" className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-600" placeholder="85000"
                    value={productForm.price} onChange={e => setProductForm({...productForm, price: e.target.value})} />
                </div>
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">Product Name</label>
                <input required type="text" className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-600" placeholder="Pro Laptop X1"
                  value={productForm.name} onChange={e => setProductForm({...productForm, name: e.target.value})} />
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">Description</label>
                <textarea required rows={3} className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-600 resize-none" placeholder="High performance laptop..."
                  value={productForm.description} onChange={e => setProductForm({...productForm, description: e.target.value})} />
              </div>
              <button disabled={isSubmitting} type="submit" className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-xl font-bold transition-all disabled:opacity-70 disabled:cursor-not-allowed">
                {isSubmitting ? <Loader2 className="animate-spin h-5 w-5" /> : <Plus className="h-5 w-5" />} Save Product to Catalog
              </button>
            </div>
          </form>
        )}

        {/* --- WAREHOUSES TAB --- */}
        {activeTab === 'warehouses' && (
          <form onSubmit={handleWarehouseSubmit} className="max-w-2xl">
            <h2 className="text-xl font-bold text-slate-900 mb-6 flex items-center gap-2">
              <MapPin className="h-5 w-5 text-indigo-600" /> Register Physical Warehouse
            </h2>
            <div className="space-y-5">
              <div className="grid grid-cols-2 gap-5">
                <div className="col-span-2">
                  <label className="block text-sm font-bold text-slate-700 mb-1">Warehouse Name</label>
                  <input required type="text" className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-600" placeholder="e.g. South Bengaluru Distribution Center"
                    value={warehouseForm.name} onChange={e => setWarehouseForm({...warehouseForm, name: e.target.value})} />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">General Location</label>
                  <input required type="text" className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-600" placeholder="e.g. JP Nagar"
                    value={warehouseForm.location} onChange={e => setWarehouseForm({...warehouseForm, location: e.target.value})} />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">Max Capacity (Units)</label>
                  <input required type="number" className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-600" placeholder="100000"
                    value={warehouseForm.capacity} onChange={e => setWarehouseForm({...warehouseForm, capacity: e.target.value})} />
                </div>
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl col-span-2 grid grid-cols-2 gap-4 mt-2">
                  <div className="col-span-2"><p className="text-sm font-bold text-slate-700">Geospatial Routing Coordinates</p></div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1">Latitude</label>
                    <input required type="number" step="any" className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-600" placeholder="12.9063"
                      value={warehouseForm.latitude} onChange={e => setWarehouseForm({...warehouseForm, latitude: e.target.value})} />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1">Longitude</label>
                    <input required type="number" step="any" className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-600" placeholder="77.5857"
                      value={warehouseForm.longitude} onChange={e => setWarehouseForm({...warehouseForm, longitude: e.target.value})} />
                  </div>
                </div>
              </div>
              <button disabled={isSubmitting} type="submit" className="flex items-center gap-2 bg-slate-900 hover:bg-slate-800 text-white px-6 py-3 rounded-xl font-bold transition-all mt-4 disabled:opacity-70 disabled:cursor-not-allowed">
                {isSubmitting ? <Loader2 className="animate-spin h-5 w-5" /> : <Plus className="h-5 w-5" />} Initialize Warehouse
              </button>
            </div>
          </form>
        )}

      </div>
    </div>
  );
};
```


----

### Step 2: Register the Protected Route

Now, let's wire this up to your router so only accounts with the `ADMIN` role can access it.

Open your `src/App.tsx` and add the new route below your Warehouse Manager route:

```tsx
// ... your existing imports
import { AdminDashboard } from './features/admin/AdminDashboard'; // NEW IMPORT

// ... inside your App() return block:
        {/* WAREHOUSE MANAGER ROUTES */}
        <Route element={<ProtectedRoute allowedRoles={['WAREHOUSE_MANAGER', 'ADMIN']} />}>
          <Route path="/warehouse/inventory" element={<WarehouseDashboard />} />
        </Route>

        {/* SYSTEM ADMIN ROUTES */}
        <Route element={<ProtectedRoute allowedRoles={['ADMIN']} />}>
          <Route path="/admin" element={<AdminDashboard />} />
        </Route>
// ...
```



