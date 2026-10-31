import React, { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  ShoppingBag,
  Store,
  ShieldCheck,
  Leaf,
  CheckCircle2,
  AlertTriangle,
  Phone,
  Clock,
  MapPin,
  Star,
  Info,
  Check,
  Layers,
  ChevronRight,
  ExternalLink,
  Package,
  Sparkles,
} from 'lucide-react';
import { fetchProduct, addToCart } from '@/services/marketplaceService';
import { MarketplaceProduct, MarketplaceShop } from '@/types/marketplace';
import { useAuth } from '@/context/AuthContext';

export default function ProductDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();

  const [product, setProduct] = useState<MarketplaceProduct | null>(null);
  const [offlineShops, setOfflineShops] = useState<MarketplaceShop[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Cart actions
  const [quantity, setQuantity] = useState<number>(1);
  const [isAdding, setIsAdding] = useState<boolean>(false);
  const [addedSuccess, setAddedSuccess] = useState<boolean>(false);

  // Tabs
  const [activeTab, setActiveTab] = useState<'application' | 'safety' | 'specs'>('application');

  useEffect(() => {
    async function loadProduct() {
      if (!id) return;
      try {
        setLoading(true);
        setError(null);
        const res = await fetchProduct(id);
        setProduct(res.product);
        setOfflineShops(res.offline_shops || []);
      } catch (err: any) {
        console.error('Failed to load product:', err);
        setError(err.message || 'Product could not be loaded.');
      } finally {
        setLoading(false);
      }
    }
    loadProduct();
  }, [id]);

  const handleAddToCart = async () => {
    if (!product) return;
    if (!isAuthenticated) {
      navigate(`/login?redirect=/marketplace/product/${product.id}`);
      return;
    }

    try {
      setIsAdding(true);
      await addToCart(product.id, quantity);
      setAddedSuccess(true);
      setTimeout(() => setAddedSuccess(false), 3000);
    } catch (err: any) {
      alert(err.message || 'Failed to add item to cart.');
    } finally {
      setIsAdding(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center text-center">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-forest-600 border-t-transparent" />
        <p className="mt-4 text-sm font-semibold text-forest-700">Loading product details...</p>
      </div>
    );
  }

  if (error || !product) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 text-center">
        <div className="rounded-3xl border border-red-200 bg-red-50 p-8">
          <AlertTriangle className="mx-auto h-12 w-12 text-red-500" />
          <h2 className="mt-4 font-display text-xl font-bold text-red-900">
            {error || 'Product Not Found'}
          </h2>
          <p className="mt-2 text-sm text-red-700">
            The agricultural input product you requested could not be found or is inactive.
          </p>
          <Link
            to="/marketplace"
            className="mt-6 inline-flex items-center gap-2 rounded-full bg-forest-800 px-6 py-2.5 text-xs font-semibold text-white hover:bg-forest-900"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Return to Marketplace</span>
          </Link>
        </div>
      </div>
    );
  }

  const isOrganic = Boolean(product.is_organic);
  const isOutOfStock = product.stock_quantity <= 0;
  const shopsWithStock = offlineShops.filter((s) => s.in_stock);

  return (
    <div className="min-h-screen bg-forest-50/20 pb-20">
      {/* Breadcrumbs */}
      <nav className="border-b border-forest-100 bg-white py-3">
        <div className="mx-auto flex max-w-7xl items-center gap-2 px-4 text-xs font-medium text-forest-600 sm:px-6 lg:px-8">
          <Link to="/" className="hover:text-forest-900">
            Home
          </Link>
          <ChevronRight className="h-3.5 w-3.5 text-forest-300" />
          <Link to="/marketplace" className="hover:text-forest-900">
            Marketplace
          </Link>
          <ChevronRight className="h-3.5 w-3.5 text-forest-300" />
          {product.category_name && (
            <>
              <Link
                to={`/marketplace?category_slug=${product.category_slug}`}
                className="hover:text-forest-900"
              >
                {product.category_name}
              </Link>
              <ChevronRight className="h-3.5 w-3.5 text-forest-300" />
            </>
          )}
          <span className="truncate font-semibold text-forest-900">{product.name}</span>
        </div>
      </nav>

      {/* Main Container */}
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Product Hero */}
        <div className="grid grid-cols-1 gap-10 lg:grid-cols-12">
          {/* Left Column: Media & Highlights */}
          <div className="lg:col-span-5">
            <div className="overflow-hidden rounded-3xl border border-forest-100 bg-white p-8 shadow-xs">
              <div className="relative flex h-72 w-full items-center justify-center rounded-2xl bg-linear-to-b from-forest-50/60 to-white p-4">
                {product.image_type === 'official_packshot' ? (
                  <span className="absolute top-3 left-3 z-10 rounded-md bg-emerald-800/90 px-2.5 py-1 text-xs font-semibold text-white shadow-xs backdrop-blur-xs">
                    Official Packshot
                  </span>
                ) : product.image_type === 'unverified_reference' ? (
                  <span className="absolute top-3 left-3 z-10 rounded-md bg-amber-800/90 px-2.5 py-1 text-xs font-semibold text-white shadow-xs backdrop-blur-xs">
                    Pack Verification Ref.
                  </span>
                ) : (
                  <span className="absolute top-3 left-3 z-10 rounded-md bg-forest-800/80 px-2.5 py-1 text-xs font-medium text-white shadow-xs backdrop-blur-xs">
                    Representative Agricultural Ref.
                  </span>
                )}

                {product.image_url ? (
                  <img
                    src={product.image_url}
                    alt={product.name}
                    className="h-full max-h-64 w-auto object-contain drop-shadow-sm transition hover:scale-105"
                    onError={(e) => {
                      (e.currentTarget as HTMLElement).style.display = 'none';
                      const fallback = e.currentTarget.parentElement?.querySelector('.fallback-placeholder');
                      if (fallback) (fallback as HTMLElement).classList.remove('hidden');
                    }}
                  />
                ) : null}
                <div
                  className={`fallback-placeholder flex flex-col items-center justify-center text-center ${
                    product.image_url ? 'hidden' : ''
                  }`}
                >
                  <span className="flex h-20 w-20 items-center justify-center rounded-3xl bg-forest-100 text-forest-700 shadow-xs">
                    {isOrganic ? <Leaf className="h-10 w-10 text-emerald-600" /> : <Package className="h-10 w-10" />}
                  </span>
                  <span className="mt-4 text-sm font-semibold text-forest-600">{product.brand}</span>
                  <span className="text-xs text-forest-400">{product.seller_name}</span>
                </div>
              </div>

              {/* Image Reference & Integrity Note */}
              {product.image_note && (
                <div className="mt-4 rounded-xl border border-forest-100 bg-forest-50/70 p-3 text-xs text-forest-800">
                  <div className="flex items-start gap-2">
                    <Info className="h-4 w-4 shrink-0 text-forest-600 mt-0.5" />
                    <div>
                      <p className="font-bold text-forest-900">
                        {product.image_type === 'official_packshot'
                          ? 'Official Packaging Photography'
                          : 'Image Reference Note'}
                      </p>
                      <p className="mt-0.5 text-xs text-forest-700 leading-relaxed">{product.image_note}</p>
                      {product.image_type !== 'official_packshot' && (
                        <p className="mt-1 text-[11px] text-forest-500 italic">
                          Important: This photo is a representative reference. Do not present a representative photo as the exact product sold by Loumi.
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Verified Agricultural Trust Badges */}
              <div className="mt-6 space-y-3 border-t border-forest-100 pt-6">
                {product.verification_status === 'unconfirmed' ? (
                  <div className="flex items-start gap-3 rounded-2xl border-2 border-amber-300 bg-amber-50/90 p-4 text-amber-900 shadow-xs">
                    <AlertTriangle className="h-5 w-5 shrink-0 text-amber-600 mt-0.5" />
                    <div>
                      <p className="text-sm font-bold text-amber-950">
                        Verification required — not an application recommendation
                      </p>
                      <p className="mt-1 text-xs leading-relaxed text-amber-800">
                        While this active ingredient is documented in university agronomy literature for tropical agriculture, pineapple may not currently be a primary schedule on the CIB&amp;RC container label in India. Loumi does not endorse off-label use. Please inspect physical container labels and consult your local Krishi Vigyan Kendra (KVK) or Horticulture Officer prior to application.
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-2.5 rounded-xl bg-forest-50 p-3 text-xs text-forest-800">
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
                    <div>
                      <p className="font-bold">Verified Agricultural Input</p>
                      <p className="text-forest-600">Standardized specification suitable for Manipur crop cultivation.</p>
                    </div>
                  </div>
                )}

                {isOrganic && (
                  <div className="flex items-center gap-2.5 rounded-xl bg-emerald-50/80 p-3 text-xs text-emerald-900">
                    <Leaf className="h-4 w-4 shrink-0 text-emerald-600" />
                    <div>
                      <p className="font-bold">Certified Organic Agricultural Input</p>
                      <p className="text-emerald-700">Suitable for bio-farming and chemical-free cultivation.</p>
                    </div>
                  </div>
                )}

                {product.regulatory_info && (
                  <div className="flex items-center gap-2.5 rounded-xl bg-forest-50 p-3 text-xs text-forest-800">
                    <ShieldCheck className="h-4 w-4 shrink-0 text-forest-600" />
                    <div>
                      <p className="font-bold">Official Demonstration Registration</p>
                      <p className="text-forest-600 font-mono text-[11px]">{product.regulatory_info}</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Right Column: Buying Options & Identity */}
          <div className="lg:col-span-7 flex flex-col justify-between">
            <div>
              {/* Category & Rating */}
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-forest-100 px-3 py-1 text-xs font-semibold text-forest-800">
                  <Layers className="h-3.5 w-3.5" />
                  <span>{product.category_name || product.subcategory || 'Agri Input'}</span>
                </span>

                <div className="flex items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1 text-xs font-bold text-amber-800 border border-amber-200">
                  <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-500" />
                  <span>{product.rating.toFixed(1)}</span>
                  <span className="text-amber-600 font-normal">({product.reviews_count} Verified Reviews)</span>
                </div>
              </div>

              <h1 className="mt-3 font-display text-2xl font-extrabold tracking-tight text-forest-900 sm:text-3xl">
                {product.name}
              </h1>

              <div className="mt-2 flex flex-wrap items-center gap-4 text-xs text-forest-600">
                <span>
                  Pack Size: <strong className="text-forest-900">{product.package_size}</strong>
                </span>
                <span>•</span>
                <span>
                  Target Crops:{' '}
                  <strong className="text-forest-900">{product.intended_crops.join(', ')}</strong>
                </span>
              </div>

              {/* Price Block */}
              <div className="mt-6 rounded-2xl border border-forest-100 bg-white p-5 shadow-2xs">
                <div className="flex items-baseline justify-between">
                  <div>
                    <span className="font-display text-3xl font-extrabold text-forest-900">
                      ₹{product.price.toFixed(0)}
                    </span>
                    <span className="ml-2 text-xs text-forest-500">Inclusive of all local taxes</span>
                  </div>

                  <span
                    className={`rounded-full px-3 py-1 text-xs font-bold ${
                      isOutOfStock
                        ? 'bg-red-100 text-red-800'
                        : product.stock_quantity <= 10
                        ? 'bg-amber-100 text-amber-800'
                        : 'bg-emerald-100 text-emerald-800'
                    }`}
                  >
                    {isOutOfStock
                      ? 'Out of Stock'
                      : product.stock_quantity <= 10
                      ? `Low Stock (${product.stock_quantity} left)`
                      : 'In Stock for Delivery'}
                  </span>
                </div>

                {/* Dual Channels Box */}
                <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
                  {/* Channel 1: Buy Online */}
                  <div className="flex flex-col justify-between rounded-xl border border-forest-200 bg-forest-50/40 p-4">
                    <div>
                      <div className="flex items-center gap-2 text-xs font-bold text-forest-900">
                        <ShoppingBag className="h-4 w-4 text-forest-700" />
                        <span>Channel 1: Order Online</span>
                      </div>
                      <p className="mt-1 text-xs text-forest-600">
                        Cash on Delivery across Manipur. Free shipping on orders over ₹500.
                      </p>
                    </div>

                    <div className="mt-4">
                      {/* Quantity Selector */}
                      <div className="flex items-center gap-3">
                        <span className="text-xs font-medium text-forest-700">Qty:</span>
                        <div className="flex items-center rounded-lg border border-forest-200 bg-white">
                          <button
                            type="button"
                            disabled={quantity <= 1 || isOutOfStock}
                            onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                            className="px-2.5 py-1 text-xs font-bold text-forest-700 hover:bg-forest-50 disabled:opacity-40"
                          >
                            -
                          </button>
                          <span className="px-3 text-xs font-bold text-forest-900">{quantity}</span>
                          <button
                            type="button"
                            disabled={quantity >= product.stock_quantity || isOutOfStock}
                            onClick={() => setQuantity((q) => q + 1)}
                            className="px-2.5 py-1 text-xs font-bold text-forest-700 hover:bg-forest-50 disabled:opacity-40"
                          >
                            +
                          </button>
                        </div>
                      </div>

                      <button
                        type="button"
                        disabled={isOutOfStock || isAdding}
                        onClick={handleAddToCart}
                        className={`mt-3 inline-flex w-full items-center justify-center gap-2 rounded-full py-2.5 text-xs font-bold shadow-xs transition ${
                          addedSuccess
                            ? 'bg-emerald-600 text-white'
                            : isOutOfStock
                            ? 'cursor-not-allowed bg-forest-200 text-forest-400'
                            : 'bg-forest-800 text-white hover:bg-forest-900 active:scale-95'
                        }`}
                      >
                        {addedSuccess ? (
                          <>
                            <Check className="h-4 w-4" />
                            <span>Added to Cart!</span>
                          </>
                        ) : isAdding ? (
                          <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                        ) : (
                          <>
                            <ShoppingBag className="h-4 w-4" />
                            <span>Add to Cart (₹{(product.price * quantity).toFixed(0)})</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Channel 2: Buy Offline */}
                  <div className="flex flex-col justify-between rounded-xl border border-forest-200 bg-white p-4">
                    <div>
                      <div className="flex items-center gap-2 text-xs font-bold text-forest-900">
                        <Store className="h-4 w-4 text-emerald-700" />
                        <span>Channel 2: Nearby Offline Shops</span>
                      </div>
                      <p className="mt-1 text-xs text-forest-600">
                        Available at{' '}
                        <strong className="text-forest-900">{shopsWithStock.length} verified dealers</strong>{' '}
                        across Manipur districts.
                      </p>
                    </div>

                    <a
                      href="#offline-shops"
                      className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-full border border-forest-300 bg-white py-2.5 text-xs font-bold text-forest-800 shadow-2xs hover:bg-forest-50"
                    >
                      <span>View Shop Locations &amp; Phone</span>
                      <MapPin className="h-3.5 w-3.5" />
                    </a>
                  </div>
                </div>
              </div>

              {/* Description */}
              <div className="mt-6">
                <h3 className="font-display text-sm font-bold text-forest-900">Product Overview</h3>
                <p className="mt-2 text-xs leading-relaxed text-forest-700">{product.description}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Tabbed Technical & Application Information */}
        <div className="mt-14 rounded-3xl border border-forest-100 bg-white p-6 shadow-xs sm:p-8">
          <div className="flex border-b border-forest-100">
            <button
              type="button"
              onClick={() => setActiveTab('application')}
              className={`border-b-2 px-5 py-3 text-xs font-bold transition ${
                activeTab === 'application'
                  ? 'border-forest-800 text-forest-900'
                  : 'border-transparent text-forest-500 hover:text-forest-800'
              }`}
            >
              Dosage &amp; Field Application
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('safety')}
              className={`border-b-2 px-5 py-3 text-xs font-bold transition ${
                activeTab === 'safety'
                  ? 'border-forest-800 text-forest-900'
                  : 'border-transparent text-forest-500 hover:text-forest-800'
              }`}
            >
              Safety Precautions &amp; PPE
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('specs')}
              className={`border-b-2 px-5 py-3 text-xs font-bold transition ${
                activeTab === 'specs'
                  ? 'border-forest-800 text-forest-900'
                  : 'border-transparent text-forest-500 hover:text-forest-800'
              }`}
            >
              Composition &amp; Specifications
            </button>
          </div>

          <div className="mt-6">
            {activeTab === 'application' && (
              <div className="space-y-4 text-xs text-forest-700 leading-relaxed">
                <div>
                  <h4 className="font-bold text-forest-900">Application Instructions:</h4>
                  <p className="mt-1">{product.usage_instructions || 'Apply as directed on the label.'}</p>
                </div>
                <div>
                  <h4 className="font-bold text-forest-900">Recommended Dosage Guidelines:</h4>
                  <p className="mt-1">{product.dosage_guidelines || 'Consult local KVK extension officers.'}</p>
                </div>
                <div className="rounded-xl bg-forest-50 p-4 text-forest-700">
                  <p className="font-semibold text-forest-900">Best Field Practice for Manipur Farmers:</p>
                  <p className="mt-1">
                    Apply during calm morning (before 9:00 AM) or late afternoon hours to prevent rapid evaporation.
                    Always ensure adequate spray coverage on both upper and lower leaf surfaces.
                  </p>
                </div>
              </div>
            )}

            {activeTab === 'safety' && (
              <div className="space-y-4 text-xs text-forest-700 leading-relaxed">
                <div>
                  <h4 className="font-bold text-forest-900">Safety &amp; Protective Equipment (PPE):</h4>
                  <p className="mt-1">{product.safety_precautions || 'Wear mask and protective gloves during handling.'}</p>
                </div>
                <div>
                  <h4 className="font-bold text-forest-900">Storage &amp; Disposal:</h4>
                  <p className="mt-1">
                    Store in original sealed container in a cool, dry, well-ventilated area away from direct sunlight,
                    foodstuffs, and out of reach of children and livestock.
                  </p>
                </div>
              </div>
            )}

            {activeTab === 'specs' && (
              <div className="space-y-3 text-xs text-forest-700">
                <div className="flex border-b border-forest-50 py-2">
                  <span className="w-44 font-semibold text-forest-900">Active Composition</span>
                  <span>{product.composition || 'Proprietary agricultural grade'}</span>
                </div>
                <div className="flex border-b border-forest-50 py-2">
                  <span className="w-44 font-semibold text-forest-900">Pack Size</span>
                  <span>{product.package_size}</span>
                </div>
                <div className="flex border-b border-forest-50 py-2">
                  <span className="w-44 font-semibold text-forest-900">Manufacturer / Brand</span>
                  <span>{product.brand}</span>
                </div>
                <div className="flex border-b border-forest-50 py-2">
                  <span className="w-44 font-semibold text-forest-900">Organic Status</span>
                  <span>{isOrganic ? 'Certified Organic Input' : 'Standard Agricultural Formulation'}</span>
                </div>
                <div className="flex border-b border-forest-50 py-2">
                  <span className="w-44 font-semibold text-forest-900">Regulatory Reference</span>
                  <span className="font-mono">{product.regulatory_info || 'Demonstration Standard'}</span>
                </div>
                <div className="flex py-2">
                  <span className="w-44 font-semibold text-forest-900">Verification Status</span>
                  <span className={product.verification_status === 'unconfirmed' ? 'font-bold text-amber-800' : 'font-semibold text-emerald-700'}>
                    {product.verification_status === 'unconfirmed'
                      ? 'Verification required — not an application recommendation'
                      : 'Verified for recommended regional crop use'}
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Nearby Offline Shops Stock Section */}
        <section id="offline-shops" className="mt-14 scroll-mt-20">
          <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
            <div>
              <div className="inline-flex items-center gap-1.5 rounded-full bg-forest-100 px-3 py-1 text-xs font-semibold text-forest-800">
                <Store className="h-3.5 w-3.5" />
                <span>Physical Retail Network</span>
              </div>
              <h2 className="mt-2 font-display text-2xl font-bold tracking-tight text-forest-900">
                Available at Nearby Manipur Agricultural Shops
              </h2>
              <p className="mt-1 text-xs text-forest-600">
                Check store inventory before traveling. You can call directly to reserve your stock.
              </p>
            </div>

            <Link
              to="/marketplace/shops"
              className="text-xs font-bold text-forest-700 underline hover:text-forest-900"
            >
              Browse All Manipur Dealers →
            </Link>
          </div>

          <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {offlineShops.map((shop) => (
              <div
                key={shop.id}
                className="flex flex-col justify-between rounded-2xl border border-forest-100 bg-white p-5 shadow-2xs"
              >
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="rounded-full bg-forest-50 px-2.5 py-0.5 text-[11px] font-semibold text-forest-700">
                      {shop.district}
                    </span>

                    <span
                      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-bold ${
                        shop.in_stock
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-red-100 text-red-700'
                      }`}
                    >
                      {shop.in_stock ? (
                        <>
                          <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                          <span>In Stock</span>
                        </>
                      ) : (
                        <span>Out of Stock</span>
                      )}
                    </span>
                  </div>

                  <h3 className="mt-3 font-display text-base font-bold text-forest-900">
                    {shop.name}
                  </h3>
                  <p className="mt-1 flex items-start gap-1.5 text-xs text-forest-600">
                    <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-forest-400" />
                    <span>{shop.address}</span>
                  </p>
                </div>

                <div className="mt-4 border-t border-forest-50 pt-3">
                  <div className="flex items-center justify-between text-xs text-forest-600">
                    <span className="flex items-center gap-1 text-[11px]">
                      <Clock className="h-3.5 w-3.5 text-forest-400" />
                      <span>{shop.opening_hours}</span>
                    </span>

                    <a
                      href={`tel:${shop.contact_phone}`}
                      className="inline-flex items-center gap-1 font-bold text-forest-800 hover:text-emerald-700"
                    >
                      <Phone className="h-3.5 w-3.5" />
                      <span>Call Shop</span>
                    </a>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
