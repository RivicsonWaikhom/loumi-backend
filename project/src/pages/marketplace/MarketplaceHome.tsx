import React, { useEffect, useState, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ShoppingBag,
  Store,
  Search,
  Filter,
  CheckCircle2,
  Sparkles,
  MapPin,
  Leaf,
  Layers,
  ShieldCheck,
  Sprout,
  Bug,
  Wrench,
  AlertCircle,
  ArrowRight,
  ShoppingCart,
  Star,
  Check,
} from 'lucide-react';
import {
  fetchCategories,
  fetchProducts,
  addToCart,
} from '@/services/marketplaceService';
import {
  MarketplaceCategory,
  MarketplaceProduct,
  ProductFilters,
} from '@/types/marketplace';
import { useAuth } from '@/context/AuthContext';

export default function MarketplaceHome() {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();

  const [categories, setCategories] = useState<MarketplaceCategory[]>([]);
  const [products, setProducts] = useState<MarketplaceProduct[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [selectedCategorySlug, setSelectedCategorySlug] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedCrop, setSelectedCrop] = useState<string>('all');
  const [organicOnly, setOrganicOnly] = useState<boolean>(false);
  const [sortBy, setSortBy] = useState<ProductFilters['sort_by']>('recommended');

  // Adding to cart animation feedback
  const [addingId, setAddingId] = useState<string | null>(null);
  const [addedSuccessId, setAddedSuccessId] = useState<string | null>(null);

  useEffect(() => {
    async function loadInitial() {
      try {
        setLoading(true);
        const [cats, prodRes] = await Promise.all([
          fetchCategories(),
          fetchProducts({ sort_by: 'recommended' }),
        ]);
        setCategories(cats);
        setProducts(prodRes.products);
      } catch (err: any) {
        console.error('Failed to load marketplace products:', err);
        setError('Unable to load agricultural marketplace products. Please check connection.');
      } finally {
        setLoading(false);
      }
    }
    loadInitial();
  }, []);

  // Filter effect
  useEffect(() => {
    let active = true;
    async function applyFilters() {
      try {
        const filters: ProductFilters = {
          category_slug: selectedCategorySlug !== 'all' ? selectedCategorySlug : undefined,
          crop: selectedCrop !== 'all' ? selectedCrop : undefined,
          q: searchQuery.trim() || undefined,
          is_organic: organicOnly ? true : undefined,
          sort_by: sortBy,
        };
        const res = await fetchProducts(filters);
        if (active) {
          setProducts(res.products);
        }
      } catch (err) {
        console.error('Filter error:', err);
      }
    }

    const timer = setTimeout(() => {
      applyFilters();
    }, 250);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [selectedCategorySlug, selectedCrop, searchQuery, organicOnly, sortBy]);

  const handleAddToCart = async (e: React.MouseEvent, product: MarketplaceProduct) => {
    e.preventDefault();
    e.stopPropagation();

    if (!isAuthenticated) {
      navigate('/login?redirect=/marketplace');
      return;
    }

    try {
      setAddingId(product.id);
      await addToCart(product.id, 1);
      setAddedSuccessId(product.id);
      setTimeout(() => setAddedSuccessId(null), 2500);
    } catch (err: any) {
      alert(err.message || 'Failed to add item to cart.');
    } finally {
      setAddingId(null);
    }
  };

  const getCategoryIcon = (slug?: string) => {
    switch (slug) {
      case 'bio-protection':
        return <ShieldCheck className="h-4 w-4" />;
      case 'fertilizers-soil-health':
        return <Sprout className="h-4 w-4" />;
      case 'eco-pest-management':
        return <Bug className="h-4 w-4" />;
      case 'seeds-planting-material':
        return <Layers className="h-4 w-4" />;
      case 'tools-equipment':
        return <Wrench className="h-4 w-4" />;
      default:
        return <Leaf className="h-4 w-4" />;
    }
  };

  return (
    <div className="min-h-screen bg-forest-50/30 pb-20">
      {/* Hero Header */}
      <section className="border-b border-forest-100 bg-linear-to-b from-forest-50/80 via-white to-white py-10 sm:py-14">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col items-start justify-between gap-6 md:flex-row md:items-center">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-forest-200 bg-forest-100/70 px-3.5 py-1 text-xs font-semibold text-forest-800">
                <Sparkles className="h-3.5 w-3.5 text-forest-700" />
                <span>Hybrid Agricultural Marketplace for Manipur</span>
              </div>
              <h1 className="mt-3 font-display text-3xl font-extrabold tracking-tight text-forest-900 sm:text-4xl">
                Certified Agri Inputs &amp; Local Dealers
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-relaxed text-forest-600 sm:text-base">
                Discover verified biological crop protectants, organic fertilizers, certified pineapple suckers,
                and field equipment. Order online with Cash on Delivery or find stock at nearby Manipur shops.
              </p>
            </div>

            {/* Quick Actions */}
            <div className="flex flex-wrap items-center gap-3">
              <Link
                to="/marketplace/shops"
                className="inline-flex items-center gap-2 rounded-full border border-forest-200 bg-white px-4 py-2.5 text-sm font-semibold text-forest-800 shadow-2xs transition hover:border-forest-300 hover:bg-forest-50"
              >
                <Store className="h-4 w-4 text-forest-600" />
                <span>Nearby Shops Directory</span>
              </Link>
              <Link
                to="/marketplace/cart"
                className="inline-flex items-center gap-2 rounded-full bg-forest-700 px-5 py-2.5 text-sm font-semibold text-white shadow-xs transition hover:bg-forest-800"
              >
                <ShoppingBag className="h-4 w-4" />
                <span>View Cart &amp; Checkout</span>
              </Link>
            </div>
          </div>

          {/* Search & Main Filter Controls */}
          <div className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-12">
            {/* Search Input */}
            <div className="relative sm:col-span-6 lg:col-span-5">
              <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-forest-400" />
              <input
                type="text"
                placeholder="Search products, bio-fungicides, brands, nutrients..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full rounded-full border border-forest-200 bg-white py-2.5 pl-10 pr-4 text-sm text-forest-900 placeholder-forest-400 focus:border-forest-500 focus:outline-hidden focus:ring-2 focus:ring-forest-200"
              />
            </div>

            {/* Crop Selector */}
            <div className="sm:col-span-3 lg:col-span-3">
              <select
                value={selectedCrop}
                onChange={(e) => setSelectedCrop(e.target.value)}
                className="w-full rounded-full border border-forest-200 bg-white px-4 py-2.5 text-sm font-medium text-forest-700 focus:border-forest-500 focus:outline-hidden focus:ring-2 focus:ring-forest-200"
              >
                <option value="all">🌱 All Crops (General)</option>
                <option value="Pineapple">🍍 Pineapple Inputs</option>
                <option value="Rice">🌾 Rice &amp; Paddy Inputs</option>
              </select>
            </div>

            {/* Sort Selector */}
            <div className="sm:col-span-3 lg:col-span-2">
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="w-full rounded-full border border-forest-200 bg-white px-4 py-2.5 text-sm font-medium text-forest-700 focus:border-forest-500 focus:outline-hidden focus:ring-2 focus:ring-forest-200"
              >
                <option value="recommended">Recommended</option>
                <option value="price_asc">Price: Low to High</option>
                <option value="price_desc">Price: High to Low</option>
                <option value="rating">Highest Rated</option>
              </select>
            </div>

            {/* Organic Toggle Button */}
            <div className="sm:col-span-12 lg:col-span-2 flex items-center">
              <button
                type="button"
                onClick={() => setOrganicOnly(!organicOnly)}
                className={`inline-flex w-full items-center justify-center gap-2 rounded-full border px-4 py-2.5 text-sm font-semibold transition ${
                  organicOnly
                    ? 'border-emerald-600 bg-emerald-50 text-emerald-800 ring-2 ring-emerald-200'
                    : 'border-forest-200 bg-white text-forest-700 hover:bg-forest-50'
                }`}
              >
                <Leaf className={`h-4 w-4 ${organicOnly ? 'text-emerald-600' : 'text-forest-400'}`} />
                <span>Organic Only</span>
              </button>
            </div>
          </div>

          {/* Category Tabs */}
          <div className="mt-6 flex items-center gap-2 overflow-x-auto pb-2 scrollbar-thin">
            <button
              type="button"
              onClick={() => setSelectedCategorySlug('all')}
              className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-4 py-2 text-xs font-semibold transition ${
                selectedCategorySlug === 'all'
                  ? 'bg-forest-800 text-white shadow-xs'
                  : 'bg-white text-forest-700 border border-forest-200 hover:bg-forest-50'
              }`}
            >
              <Layers className="h-3.5 w-3.5" />
              <span>All Categories</span>
            </button>

            {categories.map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => setSelectedCategorySlug(cat.slug)}
                className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-4 py-2 text-xs font-semibold transition ${
                  selectedCategorySlug === cat.slug
                    ? 'bg-forest-800 text-white shadow-xs'
                    : 'bg-white text-forest-700 border border-forest-200 hover:bg-forest-50'
                }`}
              >
                {getCategoryIcon(cat.slug)}
                <span>{cat.name}</span>
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Main Content Area */}
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Results Header */}
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold uppercase tracking-wider text-forest-500">
            Showing {products.length} {products.length === 1 ? 'Product' : 'Products'}
          </p>

          <Link
            to="/marketplace/orders"
            className="text-xs font-semibold text-forest-700 underline hover:text-forest-900"
          >
            My Past Orders →
          </Link>
        </div>

        {/* Loading / Error States */}
        {loading && (
          <div className="mt-16 flex flex-col items-center justify-center text-center">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-forest-600 border-t-transparent" />
            <p className="mt-3 text-sm font-medium text-forest-600">Loading catalog...</p>
          </div>
        )}

        {error && !loading && (
          <div className="mt-8 rounded-2xl border border-red-200 bg-red-50 p-6 text-center text-red-800">
            <AlertCircle className="mx-auto h-8 w-8 text-red-500" />
            <p className="mt-2 text-sm font-semibold">{error}</p>
          </div>
        )}

        {/* Empty State */}
        {!loading && !error && products.length === 0 && (
          <div className="mt-12 rounded-3xl border border-dashed border-forest-200 bg-white p-12 text-center">
            <Leaf className="mx-auto h-12 w-12 text-forest-300" />
            <h3 className="mt-4 font-display text-lg font-bold text-forest-800">
              No agricultural products matched your filters
            </h3>
            <p className="mt-1 text-sm text-forest-600">
              Try adjusting your search query, selecting "All Crops", or turning off the organic filter.
            </p>
            <button
              type="button"
              onClick={() => {
                setSelectedCategorySlug('all');
                setSelectedCrop('all');
                setSearchQuery('');
                setOrganicOnly(false);
              }}
              className="mt-4 inline-flex items-center gap-2 rounded-full bg-forest-700 px-5 py-2 text-xs font-semibold text-white hover:bg-forest-800"
            >
              Reset All Filters
            </button>
          </div>
        )}

        {/* Products Grid */}
        {!loading && !error && products.length > 0 && (
          <div className="mt-6 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {products.map((product) => (
              <ProductCard
                key={product.id}
                product={product}
                isAdding={addingId === product.id}
                justAdded={addedSuccessId === product.id}
                onAddToCart={(e) => handleAddToCart(e, product)}
              />
            ))}
          </div>
        )}

        {/* Offline Agricultural Dealers Banner */}
        <section className="mt-16 overflow-hidden rounded-3xl border border-forest-200 bg-linear-to-r from-forest-800 to-forest-900 p-8 text-white shadow-sm sm:p-10">
          <div className="flex flex-col items-start justify-between gap-6 md:flex-row md:items-center">
            <div className="max-w-xl">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-forest-200 backdrop-blur-xs">
                <Store className="h-3.5 w-3.5" />
                <span>Physical Agro-Dealers Directory</span>
              </span>
              <h2 className="mt-3 font-display text-2xl font-bold tracking-tight text-white sm:text-3xl">
                Prefer buying in person? Locate nearby shops in Manipur
              </h2>
              <p className="mt-2 text-sm text-forest-200">
                Verified input retailers across Imphal West, Imphal East, Bishnupur, Churachandpur, Kakching, and Thoubal.
                Check live in-store stock, get directions, and call ahead.
              </p>
            </div>

            <Link
              to="/marketplace/shops"
              className="inline-flex items-center gap-2 rounded-full bg-pineapple-400 px-6 py-3 text-sm font-bold text-forest-950 shadow-md transition hover:bg-pineapple-300"
            >
              <span>Explore Verified Shops</span>
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
}

function ProductCard({
  product,
  isAdding,
  justAdded,
  onAddToCart,
}: {
  product: MarketplaceProduct;
  isAdding: boolean;
  justAdded: boolean;
  onAddToCart: (e: React.MouseEvent) => void;
}) {
  const isOrganic = Boolean(product.is_organic);
  const isOutOfStock = product.stock_quantity <= 0;

  return (
    <div className="group flex flex-col justify-between overflow-hidden rounded-2xl border border-forest-100 bg-white p-4 shadow-2xs transition duration-200 hover:-translate-y-1 hover:border-forest-200 hover:shadow-md">
      <div>
        {/* Top Badges */}
        <div className="flex items-center justify-between gap-2">
          {isOrganic ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-800 ring-1 ring-emerald-200">
              <Leaf className="h-3 w-3 text-emerald-600" />
              <span>Organic</span>
            </span>
          ) : (
            <span className="inline-flex items-center rounded-full bg-forest-50 px-2 py-0.5 text-[11px] font-medium text-forest-700">
              {product.subcategory || 'Agri Input'}
            </span>
          )}

          <div className="flex items-center gap-1 text-xs font-semibold text-amber-600">
            <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
            <span>{product.rating.toFixed(1)}</span>
            <span className="text-forest-400 font-normal">({product.reviews_count})</span>
          </div>
        </div>

        {/* Product Visual & Identity */}
        <Link to={`/marketplace/product/${product.id}`} className="mt-3 block">
          <div className="flex h-36 w-full items-center justify-center rounded-xl bg-forest-50/50 p-4 transition group-hover:bg-forest-50">
            <div className="flex flex-col items-center justify-center text-center">
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white shadow-2xs text-forest-700">
                <Sprout className="h-6 w-6" />
              </span>
              <span className="mt-2 text-xs font-medium text-forest-500">{product.brand}</span>
            </div>
          </div>

          <h3 className="mt-3 font-display text-base font-bold text-forest-900 line-clamp-2 group-hover:text-forest-700">
            {product.name}
          </h3>
        </Link>

        {/* Package & Crops */}
        <div className="mt-2 flex items-center justify-between text-xs text-forest-600">
          <span className="font-semibold text-forest-800">{product.package_size}</span>
          <span className="rounded-md bg-forest-100/60 px-2 py-0.5 text-[11px] text-forest-700">
            {product.intended_crops.slice(0, 2).join(', ')}
          </span>
        </div>

        {/* Short Description */}
        <p className="mt-2 text-xs leading-relaxed text-forest-600 line-clamp-2">
          {product.description}
        </p>
      </div>

      {/* Pricing & Dual Actions */}
      <div className="mt-4 border-t border-forest-50 pt-3">
        <div className="flex items-baseline justify-between">
          <div>
            <span className="font-display text-xl font-extrabold text-forest-900">
              ₹{product.price.toFixed(0)}
            </span>
            <span className="ml-1 text-[11px] text-forest-500">incl. GST</span>
          </div>

          <span
            className={`text-[11px] font-semibold ${
              isOutOfStock
                ? 'text-red-600'
                : product.stock_quantity <= 10
                ? 'text-amber-600'
                : 'text-emerald-700'
            }`}
          >
            {isOutOfStock
              ? 'Out of stock'
              : product.stock_quantity <= 10
              ? `Only ${product.stock_quantity} left`
              : 'In Stock'}
          </span>
        </div>

        {/* Buttons */}
        <div className="mt-3 flex items-center gap-2">
          <button
            type="button"
            disabled={isOutOfStock || isAdding}
            onClick={onAddToCart}
            className={`inline-flex flex-1 items-center justify-center gap-1.5 rounded-full px-3 py-2 text-xs font-semibold shadow-2xs transition ${
              justAdded
                ? 'bg-emerald-600 text-white'
                : isOutOfStock
                ? 'cursor-not-allowed bg-forest-100 text-forest-400'
                : 'bg-forest-700 text-white hover:bg-forest-800 active:scale-95'
            }`}
          >
            {justAdded ? (
              <>
                <Check className="h-3.5 w-3.5" />
                <span>Added to Cart!</span>
              </>
            ) : isAdding ? (
              <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
            ) : (
              <>
                <ShoppingCart className="h-3.5 w-3.5" />
                <span>Buy Online</span>
              </>
            )}
          </button>

          <Link
            to={`/marketplace/product/${product.id}#offline-shops`}
            className="inline-flex items-center justify-center rounded-full border border-forest-200 bg-white p-2 text-forest-700 hover:border-forest-300 hover:bg-forest-50"
            title="Find at nearby offline shops in Manipur"
          >
            <Store className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>
    </div>
  );
}
