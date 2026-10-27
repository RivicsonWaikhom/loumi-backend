import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ShieldAlert,
  Package,
  Layers,
  Store,
  CheckCircle2,
  AlertCircle,
  Clock,
  Truck,
  Edit,
  Plus,
  ArrowLeft,
} from 'lucide-react';
import {
  adminFetchOrders,
  adminUpdateOrderStatus,
  adminCreateProduct,
  fetchCategories,
  fetchProducts,
} from '@/services/marketplaceService';
import {
  MarketplaceOrder,
  MarketplaceCategory,
  MarketplaceProduct,
  OrderStatus,
} from '@/types/marketplace';
import { useAuth } from '@/context/AuthContext';

export default function AdminMarketplace() {
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuth();

  const [activeTab, setActiveTab] = useState<'orders' | 'products' | 'new_product'>('orders');
  const [orders, setOrders] = useState<MarketplaceOrder[]>([]);
  const [categories, setCategories] = useState<MarketplaceCategory[]>([]);
  const [products, setProducts] = useState<MarketplaceProduct[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // New product form
  const [newProdName, setNewProdName] = useState('');
  const [newProdCatId, setNewProdCatId] = useState('');
  const [newProdBrand, setNewProdBrand] = useState('Loumi Agri Network');
  const [newProdDesc, setNewProdDesc] = useState('');
  const [newProdPack, setNewProdPack] = useState('1 kg');
  const [newProdPrice, setNewProdPrice] = useState('350');
  const [newProdStock, setNewProdStock] = useState('50');
  const [newProdOrganic, setNewProdOrganic] = useState(true);
  const [newProdCrops, setNewProdCrops] = useState('Pineapple, Rice');
  const [newProdReg, setNewProdReg] = useState('CIB&RC Demo Reg Standard');
  const [savingProduct, setSavingProduct] = useState(false);
  const [productSuccess, setProductSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login?redirect=/marketplace/admin');
      return;
    }

    async function loadData() {
      try {
        setLoading(true);
        setError(null);
        const [ordersRes, cats, prodsRes] = await Promise.all([
          adminFetchOrders(statusFilter !== 'all' ? statusFilter : undefined),
          fetchCategories(),
          fetchProducts(),
        ]);
        setOrders(ordersRes.orders);
        setCategories(cats);
        if (cats.length > 0 && !newProdCatId) {
          setNewProdCatId(cats[0].id);
        }
        setProducts(prodsRes.products);
      } catch (err: any) {
        console.error('Admin loading failed:', err);
        setError(err.message || 'Access denied or failed to load admin records.');
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [isAuthenticated, statusFilter, navigate]);

  const handleStatusChange = async (orderId: string, newStatus: string) => {
    try {
      await adminUpdateOrderStatus(orderId, newStatus);
      const res = await adminFetchOrders(statusFilter !== 'all' ? statusFilter : undefined);
      setOrders(res.orders);
    } catch (err: any) {
      alert(err.message || 'Failed to update order status.');
    }
  };

  const handleCreateProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSavingProduct(true);
      const payload: Partial<MarketplaceProduct> = {
        name: newProdName.trim(),
        category_id: newProdCatId,
        brand: newProdBrand.trim(),
        description: newProdDesc.trim(),
        package_size: newProdPack.trim(),
        price: parseFloat(newProdPrice) || 100,
        stock_quantity: parseInt(newProdStock) || 50,
        is_organic: newProdOrganic ? 1 : 0,
        intended_crops: newProdCrops.split(',').map((c) => c.trim()).filter(Boolean),
        regulatory_info: newProdReg.trim(),
      };

      await adminCreateProduct(payload);
      setProductSuccess('Product successfully added to Loumi Marketplace!');
      setNewProdName('');
      setNewProdDesc('');
      const prodsRes = await fetchProducts();
      setProducts(prodsRes.products);
      setTimeout(() => {
        setProductSuccess(null);
        setActiveTab('products');
      }, 1500);
    } catch (err: any) {
      alert(err.message || 'Failed to create product.');
    } finally {
      setSavingProduct(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center text-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-forest-600 border-t-transparent" />
        <p className="mt-4 text-sm font-semibold text-forest-700">Loading admin operations...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-forest-50/20 pb-20">
      {/* Header */}
      <div className="border-b border-forest-100 bg-white py-6">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
            <div>
              <div className="flex items-center gap-2">
                <span className="rounded-full bg-forest-800 px-2.5 py-0.5 text-[11px] font-bold text-white">
                  Admin Control Panel
                </span>
                <span className="text-xs text-forest-500">Logged in as {user?.email}</span>
              </div>
              <h1 className="mt-2 font-display text-2xl font-bold text-forest-900 sm:text-3xl">
                Marketplace Administration
              </h1>
            </div>

            <div className="flex items-center gap-2">
              <Link
                to="/marketplace"
                className="inline-flex items-center gap-1.5 rounded-full border border-forest-200 bg-white px-4 py-2 text-xs font-bold text-forest-800 hover:bg-forest-50"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                <span>Storefront</span>
              </Link>
            </div>
          </div>

          {/* Navigation Tabs */}
          <div className="mt-6 flex border-b border-forest-100">
            <button
              type="button"
              onClick={() => setActiveTab('orders')}
              className={`border-b-2 px-5 py-2.5 text-xs font-bold transition ${
                activeTab === 'orders'
                  ? 'border-forest-800 text-forest-900'
                  : 'border-transparent text-forest-500 hover:text-forest-800'
              }`}
            >
              Customer Orders ({orders.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('products')}
              className={`border-b-2 px-5 py-2.5 text-xs font-bold transition ${
                activeTab === 'products'
                  ? 'border-forest-800 text-forest-900'
                  : 'border-transparent text-forest-500 hover:text-forest-800'
              }`}
            >
              Product Catalog ({products.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('new_product')}
              className={`border-b-2 px-5 py-2.5 text-xs font-bold transition ${
                activeTab === 'new_product'
                  ? 'border-forest-800 text-forest-900'
                  : 'border-transparent text-forest-500 hover:text-forest-800'
              }`}
            >
              + Add New Agri Product
            </button>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {error && (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-center text-xs text-red-800">
            {error}
          </div>
        )}

        {/* Tab 1: Orders Management */}
        {activeTab === 'orders' && (
          <div>
            <div className="mb-4 flex items-center justify-between">
              <span className="text-xs font-bold text-forest-700">Filter by Status:</span>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="rounded-full border border-forest-200 bg-white px-3.5 py-1.5 text-xs font-medium text-forest-800"
              >
                <option value="all">All Statuses</option>
                <option value="pending">Pending</option>
                <option value="confirmed">Confirmed</option>
                <option value="processing">Processing</option>
                <option value="ready_for_pickup">Ready for Pickup</option>
                <option value="dispatched">Dispatched</option>
                <option value="completed">Completed</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>

            <div className="space-y-4">
              {orders.map((order) => (
                <div
                  key={order.id}
                  className="rounded-2xl border border-forest-100 bg-white p-5 shadow-2xs"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-forest-50 pb-3">
                    <div>
                      <span className="font-mono text-xs font-bold text-forest-900">
                        {order.order_number}
                      </span>
                      <p className="mt-0.5 text-xs text-forest-600">
                        Farmer: <strong>{order.recipient_name}</strong> ({order.contact_phone})
                      </p>
                    </div>

                    <div className="flex items-center gap-3">
                      <span className="font-display text-base font-extrabold text-forest-900">
                        ₹{order.total_amount.toFixed(0)}
                      </span>

                      {/* Status Selector */}
                      <select
                        value={order.status}
                        onChange={(e) => handleStatusChange(order.id, e.target.value)}
                        className="rounded-full border border-forest-200 bg-forest-50 px-3 py-1 text-xs font-bold text-forest-900 focus:outline-hidden"
                      >
                        <option value="pending">pending</option>
                        <option value="confirmed">confirmed</option>
                        <option value="processing">processing</option>
                        <option value="ready_for_pickup">ready_for_pickup</option>
                        <option value="dispatched">dispatched</option>
                        <option value="completed">completed</option>
                        <option value="cancelled">cancelled</option>
                      </select>
                    </div>
                  </div>

                  <div className="mt-3 flex flex-wrap items-center justify-between gap-4 text-xs text-forest-600">
                    <div>
                      Fulfillment: <strong className="capitalize">{order.fulfillment_type}</strong> •{' '}
                      {order.fulfillment_type === 'pickup'
                        ? order.pickup_shop_name
                        : `${order.delivery_address}, ${order.delivery_district}`}
                    </div>
                    <div>
                      Items: <strong>{order.total_items_count} items</strong>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Tab 2: Products List */}
        {activeTab === 'products' && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {products.map((p) => (
              <div key={p.id} className="rounded-2xl border border-forest-100 bg-white p-4 shadow-2xs">
                <div className="flex items-center justify-between">
                  <span className="rounded-full bg-forest-100 px-2 py-0.5 text-[10px] font-bold text-forest-800">
                    {p.category_name}
                  </span>
                  <span className="font-bold text-xs text-forest-900">₹{p.price.toFixed(0)}</span>
                </div>
                <h4 className="mt-2 font-display text-sm font-bold text-forest-900">{p.name}</h4>
                <p className="mt-1 text-xs text-forest-500">
                  Stock: <strong>{p.stock_quantity} units</strong> • {p.package_size}
                </p>
              </div>
            ))}
          </div>
        )}

        {/* Tab 3: New Product Form */}
        {activeTab === 'new_product' && (
          <form
            onSubmit={handleCreateProduct}
            className="mx-auto max-w-2xl rounded-3xl border border-forest-100 bg-white p-8 shadow-xs text-xs space-y-4"
          >
            <h3 className="font-display text-base font-bold text-forest-900">
              Create New Agricultural Input Product
            </h3>

            {productSuccess && (
              <div className="rounded-xl bg-emerald-100 p-3 text-emerald-800 font-semibold">
                {productSuccess}
              </div>
            )}

            <div>
              <label className="block font-semibold text-forest-800">Product Name *</label>
              <input
                type="text"
                required
                value={newProdName}
                onChange={(e) => setNewProdName(e.target.value)}
                placeholder="e.g. Bio-Potash Fruit Vigor Boost"
                className="mt-1 w-full rounded-xl border border-forest-200 p-2.5"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block font-semibold text-forest-800">Category *</label>
                <select
                  value={newProdCatId}
                  onChange={(e) => setNewProdCatId(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-forest-200 p-2.5"
                >
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-forest-800">Brand / Cooperative</label>
                <input
                  type="text"
                  value={newProdBrand}
                  onChange={(e) => setNewProdBrand(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-forest-200 p-2.5"
                />
              </div>
            </div>

            <div>
              <label className="block font-semibold text-forest-800">Description *</label>
              <textarea
                rows={3}
                required
                value={newProdDesc}
                onChange={(e) => setNewProdDesc(e.target.value)}
                placeholder="Agronomic purpose and benefits..."
                className="mt-1 w-full rounded-xl border border-forest-200 p-2.5"
              />
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block font-semibold text-forest-800">Package Size</label>
                <input
                  type="text"
                  value={newProdPack}
                  onChange={(e) => setNewProdPack(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-forest-200 p-2.5"
                />
              </div>

              <div>
                <label className="block font-semibold text-forest-800">Price (₹ INR)</label>
                <input
                  type="number"
                  value={newProdPrice}
                  onChange={(e) => setNewProdPrice(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-forest-200 p-2.5"
                />
              </div>

              <div>
                <label className="block font-semibold text-forest-800">Stock Quantity</label>
                <input
                  type="number"
                  value={newProdStock}
                  onChange={(e) => setNewProdStock(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-forest-200 p-2.5"
                />
              </div>
            </div>

            <div>
              <label className="flex items-center gap-2 cursor-pointer font-semibold text-forest-800">
                <input
                  type="checkbox"
                  checked={newProdOrganic}
                  onChange={(e) => setNewProdOrganic(e.target.checked)}
                  className="rounded text-forest-700"
                />
                <span>Certified Organic Agricultural Input</span>
              </label>
            </div>

            <div>
              <label className="block font-semibold text-forest-800">Target Crops</label>
              <input
                type="text"
                value={newProdCrops}
                onChange={(e) => setNewProdCrops(e.target.value)}
                placeholder="Pineapple, Rice, Vegetables"
                className="mt-1 w-full rounded-xl border border-forest-200 p-2.5"
              />
            </div>

            <button
              type="submit"
              disabled={savingProduct}
              className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-full bg-forest-800 py-3 text-xs font-bold text-white hover:bg-forest-900"
            >
              {savingProduct ? 'Saving Product...' : 'Publish Product to Marketplace'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
