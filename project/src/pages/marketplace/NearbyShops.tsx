import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Store,
  MapPin,
  Phone,
  Clock,
  ShieldCheck,
  Search,
  ExternalLink,
  ChevronRight,
  Package,
  Layers,
  Sparkles,
  Leaf,
  CheckCircle2,
} from 'lucide-react';
import { fetchShops, fetchShopDetails } from '@/services/marketplaceService';
import { MarketplaceShop } from '@/types/marketplace';

const MANIPUR_DISTRICTS = [
  'All Districts',
  'Imphal West',
  'Imphal East',
  'Bishnupur',
  'Churachandpur',
  'Kakching',
  'Thoubal',
];

export default function NearbyShops() {
  const [shops, setShops] = useState<MarketplaceShop[]>([]);
  const [selectedDistrict, setSelectedDistrict] = useState<string>('All Districts');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);

  // Selected shop for viewing inventory modal/drawer
  const [activeShop, setActiveShop] = useState<MarketplaceShop | null>(null);
  const [loadingShopDetail, setLoadingShopDetail] = useState<boolean>(false);

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        setLoading(true);
        const districtParam = selectedDistrict === 'All Districts' ? undefined : selectedDistrict;
        const res = await fetchShops(districtParam, searchQuery.trim() || undefined);
        if (active) {
          setShops(res.shops);
        }
      } catch (err) {
        console.error('Failed to load shops:', err);
      } finally {
        if (active) setLoading(false);
      }
    }

    const timer = setTimeout(() => load(), 200);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [selectedDistrict, searchQuery]);

  const handleOpenShopInventory = async (shop: MarketplaceShop) => {
    try {
      setLoadingShopDetail(true);
      setActiveShop(shop);
      const res = await fetchShopDetails(shop.id);
      setActiveShop(res.shop);
    } catch (err) {
      console.error('Failed to load shop details:', err);
    } finally {
      setLoadingShopDetail(false);
    }
  };

  return (
    <div className="min-h-screen bg-forest-50/20 pb-20">
      {/* Hero Header */}
      <section className="border-b border-forest-100 bg-linear-to-b from-forest-50/80 via-white to-white py-10 sm:py-14">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="inline-flex items-center gap-2 rounded-full border border-forest-200 bg-forest-100/70 px-3.5 py-1 text-xs font-semibold text-forest-800">
            <Store className="h-3.5 w-3.5 text-forest-700" />
            <span>Manipur Physical Agriculture Retail Network</span>
          </div>

          <h1 className="mt-3 font-display text-3xl font-extrabold tracking-tight text-forest-900 sm:text-4xl">
            Locate Verified Agri-Dealers Across Manipur
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-forest-600 sm:text-base">
            Find official agricultural input shops, verified dealers, and fertilizer distributors in your district.
            Inspect available in-store stock, opening hours, and phone numbers before traveling.
          </p>

          {/* District & Search Controls */}
          <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-12">
            <div className="relative sm:col-span-7 lg:col-span-6">
              <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-forest-400" />
              <input
                type="text"
                placeholder="Search by shop name, market complex, or locality..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full rounded-full border border-forest-200 bg-white py-2.5 pl-10 pr-4 text-sm text-forest-900 placeholder-forest-400 focus:border-forest-500 focus:outline-hidden focus:ring-2 focus:ring-forest-200"
              />
            </div>
          </div>

          {/* District Filter Pills */}
          <div className="mt-5 flex items-center gap-2 overflow-x-auto pb-2 scrollbar-thin">
            {MANIPUR_DISTRICTS.map((district) => (
              <button
                key={district}
                type="button"
                onClick={() => setSelectedDistrict(district)}
                className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-4 py-2 text-xs font-semibold transition ${
                  selectedDistrict === district
                    ? 'bg-forest-800 text-white shadow-xs'
                    : 'bg-white text-forest-700 border border-forest-200 hover:bg-forest-50'
                }`}
              >
                <MapPin className="h-3.5 w-3.5" />
                <span>{district}</span>
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Directory Grid */}
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold uppercase tracking-wider text-forest-500">
            Found {shops.length} {shops.length === 1 ? 'Dealer' : 'Dealers'} in Manipur
          </p>
          <Link
            to="/marketplace"
            className="text-xs font-semibold text-forest-700 underline hover:text-forest-900"
          >
            ← Back to Online Marketplace
          </Link>
        </div>

        {loading && (
          <div className="mt-16 flex flex-col items-center justify-center text-center">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-forest-600 border-t-transparent" />
            <p className="mt-3 text-sm font-medium text-forest-600">Loading shops directory...</p>
          </div>
        )}

        {!loading && shops.length === 0 && (
          <div className="mt-12 rounded-3xl border border-dashed border-forest-200 bg-white p-12 text-center">
            <Store className="mx-auto h-12 w-12 text-forest-300" />
            <h3 className="mt-4 font-display text-lg font-bold text-forest-800">
              No dealers found for {selectedDistrict}
            </h3>
            <p className="mt-1 text-sm text-forest-600">
              Try selecting "All Districts" or clearing your search keywords.
            </p>
          </div>
        )}

        {!loading && shops.length > 0 && (
          <div className="mt-6 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {shops.map((shop) => (
              <div
                key={shop.id}
                className="flex flex-col justify-between overflow-hidden rounded-2xl border border-forest-100 bg-white p-6 shadow-2xs transition duration-200 hover:-translate-y-1 hover:border-forest-200 hover:shadow-md"
              >
                <div>
                  {/* Verified Badge */}
                  <div className="flex items-center justify-between gap-2">
                    <span className="rounded-full bg-forest-100 px-2.5 py-0.5 text-[11px] font-bold text-forest-800">
                      {shop.district}
                    </span>

                    {shop.is_verified && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-800 ring-1 ring-emerald-200">
                        <ShieldCheck className="h-3 w-3 text-emerald-600" />
                        <span>Verified Dealer</span>
                      </span>
                    )}
                  </div>

                  <h3 className="mt-3 font-display text-lg font-bold text-forest-900">
                    {shop.name}
                  </h3>

                  <p className="mt-1 text-xs text-forest-500 font-medium">{shop.locality}</p>

                  <div className="mt-4 space-y-2 text-xs text-forest-700">
                    <p className="flex items-start gap-2">
                      <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-forest-400" />
                      <span>{shop.address}</span>
                    </p>

                    <p className="flex items-center gap-2">
                      <Clock className="h-4 w-4 shrink-0 text-forest-400" />
                      <span>{shop.opening_hours}</span>
                    </p>

                    <p className="flex items-center gap-2">
                      <Phone className="h-4 w-4 shrink-0 text-forest-400" />
                      <a
                        href={`tel:${shop.contact_phone}`}
                        className="font-semibold text-forest-900 hover:underline hover:text-emerald-700"
                      >
                        {shop.contact_phone}
                      </a>
                    </p>
                  </div>
                </div>

                {/* Card Actions */}
                <div className="mt-6 border-t border-forest-50 pt-4">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleOpenShopInventory(shop)}
                      className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-full bg-forest-800 py-2.5 text-xs font-bold text-white shadow-2xs hover:bg-forest-900"
                    >
                      <Package className="h-3.5 w-3.5" />
                      <span>View In-Store Stock</span>
                    </button>

                    <a
                      href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                        `${shop.name}, ${shop.locality}, Manipur`
                      )}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center justify-center rounded-full border border-forest-200 bg-white p-2.5 text-forest-700 hover:bg-forest-50"
                      title="Open in Google Maps"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* In-Store Inventory Modal */}
      {activeShop && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-forest-950/40 p-4 backdrop-blur-xs">
          <div className="relative flex max-h-[85vh] w-full max-w-2xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl">
            {/* Modal Header */}
            <div className="border-b border-forest-100 bg-forest-50/50 p-6">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="rounded-full bg-forest-100 px-2 py-0.5 text-[11px] font-bold text-forest-800">
                      {activeShop.district}
                    </span>
                    <span className="text-xs text-forest-500 font-mono text-[11px]">
                      {activeShop.verification_badge}
                    </span>
                  </div>
                  <h3 className="mt-2 font-display text-xl font-bold text-forest-900">
                    {activeShop.name}
                  </h3>
                  <p className="mt-0.5 text-xs text-forest-600">{activeShop.address}</p>
                </div>

                <button
                  type="button"
                  onClick={() => setActiveShop(null)}
                  className="rounded-full border border-forest-200 bg-white p-1 text-forest-500 hover:text-forest-900"
                >
                  ✕
                </button>
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-4 text-xs text-forest-700">
                <span className="flex items-center gap-1">
                  <Clock className="h-3.5 w-3.5 text-forest-400" />
                  <span>{activeShop.opening_hours}</span>
                </span>
                <span className="flex items-center gap-1">
                  <Phone className="h-3.5 w-3.5 text-forest-400" />
                  <a href={`tel:${activeShop.contact_phone}`} className="font-bold underline">
                    {activeShop.contact_phone}
                  </a>
                </span>
              </div>
            </div>

            {/* Inventory List */}
            <div className="flex-1 overflow-y-auto p-6 scrollbar-thin">
              <h4 className="font-display text-sm font-bold text-forest-900">
                Live In-Store Products ({activeShop.inventory?.length || 0})
              </h4>

              {loadingShopDetail ? (
                <div className="py-12 text-center text-xs text-forest-600">
                  <div className="mx-auto h-6 w-6 animate-spin rounded-full border-2 border-forest-600 border-t-transparent" />
                  <p className="mt-2">Fetching live store inventory...</p>
                </div>
              ) : (
                <div className="mt-4 space-y-3">
                  {(activeShop.inventory || []).map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center justify-between rounded-xl border border-forest-100 bg-forest-50/20 p-3 hover:bg-forest-50/50"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <h5 className="text-xs font-bold text-forest-900">{item.name}</h5>
                          {Boolean(item.is_organic) && (
                            <span className="rounded-full bg-emerald-100 px-2 py-0.2 text-[10px] font-bold text-emerald-800">
                              Organic
                            </span>
                          )}
                        </div>
                        <p className="mt-0.5 text-[11px] text-forest-500">
                          {item.package_size} • {item.category_name}
                        </p>
                      </div>

                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <p className="font-display text-sm font-bold text-forest-900">
                            ₹{item.price.toFixed(0)}
                          </p>
                          <span
                            className={`text-[10px] font-semibold ${
                              item.in_stock ? 'text-emerald-700' : 'text-red-600'
                            }`}
                          >
                            {item.in_stock ? '● In Stock' : '○ Out of stock'}
                          </span>
                        </div>

                        <Link
                          to={`/marketplace/product/${item.id}`}
                          className="rounded-full bg-forest-100 px-3 py-1.5 text-xs font-bold text-forest-800 hover:bg-forest-200"
                        >
                          Details
                        </Link>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="border-t border-forest-100 bg-white p-4 text-center">
              <a
                href={`tel:${activeShop.contact_phone}`}
                className="inline-flex items-center gap-2 rounded-full bg-emerald-700 px-6 py-2.5 text-xs font-bold text-white shadow-xs hover:bg-emerald-800"
              >
                <Phone className="h-3.5 w-3.5" />
                <span>Call {activeShop.name} Directly to Hold Stock</span>
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
