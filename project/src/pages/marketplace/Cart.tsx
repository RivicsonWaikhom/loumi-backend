import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ShoppingBag,
  Trash2,
  Store,
  Truck,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  Info,
  MapPin,
  Phone,
  ChevronRight,
  Sprout,
} from 'lucide-react';
import {
  fetchCart,
  updateCartQuantity,
  removeFromCart,
  clearCart,
  placeOrder,
  fetchShops,
  PlaceOrderPayload,
} from '@/services/marketplaceService';
import { CartResponse, MarketplaceShop } from '@/types/marketplace';
import { useAuth } from '@/context/AuthContext';

const MANIPUR_DISTRICTS = [
  'Imphal West',
  'Imphal East',
  'Bishnupur',
  'Churachandpur',
  'Kakching',
  'Thoubal',
  'Ukhrul',
  'Senapati',
  'Tamenglong',
  'Chandel',
];

export default function Cart() {
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuth();

  const [cart, setCart] = useState<CartResponse | null>(null);
  const [shops, setShops] = useState<MarketplaceShop[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Fulfillment selector
  const [fulfillmentType, setFulfillmentType] = useState<'delivery' | 'pickup'>('delivery');

  // Delivery fields
  const [recipientName, setRecipientName] = useState<string>(user?.full_name || '');
  const [contactPhone, setContactPhone] = useState<string>('');
  const [district, setDistrict] = useState<string>('Imphal West');
  const [address, setAddress] = useState<string>('');
  const [pinCode, setPinCode] = useState<string>('');
  const [notes, setNotes] = useState<string>('');

  // Pickup fields
  const [pickupShopId, setPickupShopId] = useState<string>('');

  // Submission state
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [orderSuccess, setOrderSuccess] = useState<any | null>(null);

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login?redirect=/marketplace/cart');
      return;
    }

    async function loadData() {
      try {
        setLoading(true);
        const [cartData, shopsData] = await Promise.all([
          fetchCart(),
          fetchShops(),
        ]);
        setCart(cartData);
        setShops(shopsData.shops);
        if (shopsData.shops.length > 0) {
          setPickupShopId(shopsData.shops[0].id);
        }
      } catch (err: any) {
        console.error('Failed to load cart:', err);
        setError(err.message || 'Failed to load shopping cart.');
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [isAuthenticated, navigate]);

  useEffect(() => {
    if (user?.full_name && !recipientName) {
      setRecipientName(user.full_name);
    }
  }, [user]);

  const handleUpdateQty = async (cartItemId: string, newQty: number) => {
    try {
      const updated = await updateCartQuantity(cartItemId, newQty);
      setCart(updated);
    } catch (err: any) {
      alert(err.message || 'Failed to update quantity.');
    }
  };

  const handleRemove = async (cartItemId: string) => {
    try {
      const updated = await removeFromCart(cartItemId);
      setCart(updated);
    } catch (err: any) {
      alert(err.message || 'Failed to remove item.');
    }
  };

  const handleClear = async () => {
    if (!confirm('Are you sure you want to empty your agricultural cart?')) return;
    try {
      await clearCart();
      const updated = await fetchCart();
      setCart(updated);
    } catch (err: any) {
      alert(err.message || 'Failed to clear cart.');
    }
  };

  const handleSubmitOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cart || cart.items.length === 0) return;

    if (!recipientName.trim()) {
      alert('Please provide the recipient name.');
      return;
    }
    if (!contactPhone.trim() || contactPhone.trim().length < 8) {
      alert('Please enter a valid contact phone number.');
      return;
    }

    if (fulfillmentType === 'delivery') {
      if (!address.trim()) {
        alert('Please enter your full delivery address in Manipur.');
        return;
      }
    } else {
      if (!pickupShopId) {
        alert('Please select a verified pickup shop.');
        return;
      }
    }

    try {
      setSubmitting(true);
      const payload: PlaceOrderPayload = {
        fulfillment_type: fulfillmentType,
        recipient_name: recipientName.trim(),
        contact_phone: contactPhone.trim(),
        delivery_district: fulfillmentType === 'delivery' ? district : undefined,
        delivery_address: fulfillmentType === 'delivery' ? address.trim() : undefined,
        delivery_pin_code: fulfillmentType === 'delivery' ? pinCode.trim() : undefined,
        pickup_shop_id: fulfillmentType === 'pickup' ? pickupShopId : undefined,
        notes: notes.trim() || undefined,
      };

      const res = await placeOrder(payload);
      setOrderSuccess(res.order);
      setCart(null);
    } catch (err: any) {
      alert(err.message || 'Failed to place order.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center text-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-forest-600 border-t-transparent" />
        <p className="mt-4 text-sm font-semibold text-forest-700">Loading your cart...</p>
      </div>
    );
  }

  // Order Confirmed View
  if (orderSuccess) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 text-center">
        <div className="rounded-3xl border border-forest-200 bg-white p-8 shadow-sm">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
            <CheckCircle2 className="h-10 w-10" />
          </div>

          <h2 className="mt-4 font-display text-2xl font-extrabold text-forest-900">
            Order Request Confirmed!
          </h2>
          <p className="mt-1 text-xs text-forest-500 font-mono">
            Order Reference: <strong className="text-forest-900">{orderSuccess.order_number}</strong>
          </p>

          <p className="mt-3 text-sm text-forest-700">
            Thank you, <strong>{orderSuccess.recipient_name}</strong>. Your order request has been registered
            with the Loumi Manipur Agri Hub.
          </p>

          <div className="mt-6 rounded-2xl bg-forest-50/70 p-5 text-left text-xs text-forest-800">
            <div className="flex items-center justify-between border-b border-forest-100 pb-2">
              <span className="text-forest-500">Fulfillment Type:</span>
              <strong className="capitalize">{orderSuccess.fulfillment_type}</strong>
            </div>

            {orderSuccess.fulfillment_type === 'pickup' ? (
              <div className="flex items-center justify-between border-b border-forest-100 py-2">
                <span className="text-forest-500">Pickup Location:</span>
                <strong className="text-right">{orderSuccess.pickup_shop_name}</strong>
              </div>
            ) : (
              <div className="flex items-center justify-between border-b border-forest-100 py-2">
                <span className="text-forest-500">Delivery Address:</span>
                <strong className="text-right">
                  {orderSuccess.delivery_address}, {orderSuccess.delivery_district}
                </strong>
              </div>
            )}

            <div className="flex items-center justify-between border-b border-forest-100 py-2">
              <span className="text-forest-500">Payment Due on Receipt:</span>
              <strong className="font-display text-sm font-bold text-forest-900">
                ₹{orderSuccess.total_amount.toFixed(0)}
              </strong>
            </div>

            <div className="flex items-center justify-between pt-2">
              <span className="text-forest-500">Contact Helpline:</span>
              <strong>+91 98620 12345 (Loumi Kisan Seva)</strong>
            </div>
          </div>

          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link
              to="/marketplace/orders"
              className="inline-flex items-center gap-2 rounded-full bg-forest-800 px-6 py-2.5 text-xs font-bold text-white shadow-xs hover:bg-forest-900"
            >
              <span>View in Order History</span>
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              to="/marketplace"
              className="inline-flex items-center gap-2 rounded-full border border-forest-200 bg-white px-6 py-2.5 text-xs font-bold text-forest-800 hover:bg-forest-50"
            >
              <span>Continue Shopping</span>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const selectedShop = shops.find((s) => s.id === pickupShopId);
  const isEmpty = !cart || cart.items.length === 0;

  return (
    <div className="min-h-screen bg-forest-50/20 pb-20">
      <div className="border-b border-forest-100 bg-white py-6">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="font-display text-2xl font-bold text-forest-900 sm:text-3xl">
                My Agricultural Cart
              </h1>
              <p className="mt-1 text-xs text-forest-600">
                Review your agricultural items, select fulfillment, and place your order request.
              </p>
            </div>

            {!isEmpty && (
              <button
                type="button"
                onClick={handleClear}
                className="inline-flex items-center gap-1.5 rounded-full border border-forest-200 bg-white px-3.5 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50"
              >
                <Trash2 className="h-3.5 w-3.5" />
                <span>Empty Cart</span>
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {isEmpty ? (
          <div className="rounded-3xl border border-dashed border-forest-200 bg-white p-12 text-center">
            <ShoppingBag className="mx-auto h-12 w-12 text-forest-300" />
            <h3 className="mt-4 font-display text-lg font-bold text-forest-900">
              Your agricultural cart is empty
            </h3>
            <p className="mt-1 text-xs text-forest-600">
              Browse biological crop protectants, organic fertilizers, and pineapple suckers.
            </p>
            <Link
              to="/marketplace"
              className="mt-6 inline-flex items-center gap-2 rounded-full bg-forest-800 px-6 py-2.5 text-xs font-bold text-white hover:bg-forest-900"
            >
              <span>Browse Marketplace</span>
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmitOrder} className="grid grid-cols-1 gap-8 lg:grid-cols-12">
            {/* Left: Cart Items & Fulfillment Choice */}
            <div className="space-y-6 lg:col-span-7">
              {/* Items Card */}
              <div className="overflow-hidden rounded-3xl border border-forest-100 bg-white p-6 shadow-2xs">
                <h3 className="font-display text-base font-bold text-forest-900">
                  Cart Items ({cart.total_items})
                </h3>

                <div className="mt-4 divide-y divide-forest-50">
                  {cart.items.map((item) => (
                    <div key={item.cart_item_id} className="flex items-center justify-between py-4">
                      <div className="flex-1 pr-4">
                        <Link
                          to={`/marketplace/product/${item.product_id}`}
                          className="font-display text-sm font-bold text-forest-900 hover:underline"
                        >
                          {item.name}
                        </Link>
                        <p className="mt-0.5 text-xs text-forest-500">
                          {item.package_size} • {item.brand}
                        </p>
                        <p className="mt-1 font-display text-xs font-bold text-forest-800">
                          ₹{item.price.toFixed(0)} each
                        </p>
                      </div>

                      {/* Quantity & Item Total */}
                      <div className="flex items-center gap-4">
                        <div className="flex items-center rounded-lg border border-forest-200 bg-forest-50/50">
                          <button
                            type="button"
                            onClick={() => handleUpdateQty(item.cart_item_id, item.quantity - 1)}
                            className="px-2.5 py-1 text-xs font-bold text-forest-700 hover:bg-forest-100"
                          >
                            -
                          </button>
                          <span className="px-2.5 text-xs font-bold text-forest-900">
                            {item.quantity}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleUpdateQty(item.cart_item_id, item.quantity + 1)}
                            className="px-2.5 py-1 text-xs font-bold text-forest-700 hover:bg-forest-100"
                          >
                            +
                          </button>
                        </div>

                        <span className="w-16 text-right font-display text-sm font-extrabold text-forest-900">
                          ₹{item.item_total.toFixed(0)}
                        </span>

                        <button
                          type="button"
                          onClick={() => handleRemove(item.cart_item_id)}
                          className="text-forest-400 hover:text-red-600"
                          title="Remove item"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Fulfillment Method Card */}
              <div className="overflow-hidden rounded-3xl border border-forest-100 bg-white p-6 shadow-2xs">
                <h3 className="font-display text-base font-bold text-forest-900">
                  Select Fulfillment Method
                </h3>

                <div className="mt-4 grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setFulfillmentType('delivery')}
                    className={`flex items-center gap-3 rounded-2xl border p-4 text-left transition ${
                      fulfillmentType === 'delivery'
                        ? 'border-forest-700 bg-forest-50/80 ring-2 ring-forest-200'
                        : 'border-forest-200 bg-white hover:bg-forest-50/40'
                    }`}
                  >
                    <div className="rounded-xl bg-forest-100 p-2.5 text-forest-800">
                      <Truck className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="font-bold text-xs text-forest-900">Home Delivery</p>
                      <p className="text-[11px] text-forest-500">Across Manipur Districts</p>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setFulfillmentType('pickup')}
                    className={`flex items-center gap-3 rounded-2xl border p-4 text-left transition ${
                      fulfillmentType === 'pickup'
                        ? 'border-forest-700 bg-forest-50/80 ring-2 ring-forest-200'
                        : 'border-forest-200 bg-white hover:bg-forest-50/40'
                    }`}
                  >
                    <div className="rounded-xl bg-forest-100 p-2.5 text-forest-800">
                      <Store className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="font-bold text-xs text-forest-900">Store Pickup</p>
                      <p className="text-[11px] text-forest-500">Free Pickup at Local Shop</p>
                    </div>
                  </button>
                </div>

                {/* Fulfillment Form Fields */}
                <div className="mt-6 space-y-4 border-t border-forest-50 pt-5 text-xs">
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div>
                      <label className="block font-semibold text-forest-800">Recipient Name *</label>
                      <input
                        type="text"
                        required
                        value={recipientName}
                        onChange={(e) => setRecipientName(e.target.value)}
                        placeholder="Farmer Full Name"
                        className="mt-1 w-full rounded-xl border border-forest-200 bg-white p-2.5 text-forest-900 focus:border-forest-500 focus:outline-hidden"
                      />
                    </div>

                    <div>
                      <label className="block font-semibold text-forest-800">Contact Phone Number *</label>
                      <input
                        type="tel"
                        required
                        value={contactPhone}
                        onChange={(e) => setContactPhone(e.target.value)}
                        placeholder="+91 98620 XXXXX"
                        className="mt-1 w-full rounded-xl border border-forest-200 bg-white p-2.5 text-forest-900 focus:border-forest-500 focus:outline-hidden"
                      />
                    </div>
                  </div>

                  {fulfillmentType === 'delivery' ? (
                    <>
                      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <div>
                          <label className="block font-semibold text-forest-800">District in Manipur *</label>
                          <select
                            value={district}
                            onChange={(e) => setDistrict(e.target.value)}
                            className="mt-1 w-full rounded-xl border border-forest-200 bg-white p-2.5 text-forest-900 focus:border-forest-500 focus:outline-hidden"
                          >
                            {MANIPUR_DISTRICTS.map((d) => (
                              <option key={d} value={d}>
                                {d}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label className="block font-semibold text-forest-800">PIN Code (Optional)</label>
                          <input
                            type="text"
                            value={pinCode}
                            onChange={(e) => setPinCode(e.target.value)}
                            placeholder="e.g. 795001"
                            className="mt-1 w-full rounded-xl border border-forest-200 bg-white p-2.5 text-forest-900 focus:border-forest-500 focus:outline-hidden"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block font-semibold text-forest-800">
                          Detailed Delivery Address &amp; Landmarks *
                        </label>
                        <textarea
                          rows={2}
                          required
                          value={address}
                          onChange={(e) => setAddress(e.target.value)}
                          placeholder="House No., Locality/Village, Near Church/School/Bazar..."
                          className="mt-1 w-full rounded-xl border border-forest-200 bg-white p-2.5 text-forest-900 focus:border-forest-500 focus:outline-hidden"
                        />
                      </div>
                    </>
                  ) : (
                    <div>
                      <label className="block font-semibold text-forest-800">
                        Choose Verified Pickup Shop in Manipur *
                      </label>
                      <select
                        value={pickupShopId}
                        onChange={(e) => setPickupShopId(e.target.value)}
                        className="mt-1 w-full rounded-xl border border-forest-200 bg-white p-2.5 text-forest-900 focus:border-forest-500 focus:outline-hidden"
                      >
                        {shops.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.name} ({s.district} - {s.locality})
                          </option>
                        ))}
                      </select>

                      {selectedShop && (
                        <div className="mt-3 rounded-xl bg-forest-50 p-3 text-xs text-forest-700">
                          <p className="font-bold text-forest-900">{selectedShop.name}</p>
                          <p className="mt-0.5">{selectedShop.address}</p>
                          <p className="mt-1 text-forest-500">
                            Hours: {selectedShop.opening_hours} • Phone: {selectedShop.contact_phone}
                          </p>
                        </div>
                      )}
                    </div>
                  )}

                  <div>
                    <label className="block font-semibold text-forest-800">
                      Order Instructions / Field Notes (Optional)
                    </label>
                    <input
                      type="text"
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="e.g. Please deliver in the morning, or call before dispatch"
                      className="mt-1 w-full rounded-xl border border-forest-200 bg-white p-2.5 text-forest-900 focus:border-forest-500 focus:outline-hidden"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Right: Authoritative Order Summary */}
            <div className="lg:col-span-5">
              <div className="sticky top-24 rounded-3xl border border-forest-100 bg-white p-6 shadow-2xs">
                <h3 className="font-display text-base font-bold text-forest-900">
                  Payment &amp; Order Summary
                </h3>

                <div className="mt-4 space-y-2.5 text-xs text-forest-700">
                  <div className="flex justify-between">
                    <span>Items Subtotal:</span>
                    <strong className="text-forest-900">₹{cart.subtotal.toFixed(0)}</strong>
                  </div>

                  <div className="flex justify-between">
                    <span>Fulfillment ({fulfillmentType === 'delivery' ? 'Home Delivery' : 'Store Pickup'}):</span>
                    {fulfillmentType === 'pickup' || cart.qualifies_free_delivery ? (
                      <span className="font-bold text-emerald-700">FREE</span>
                    ) : (
                      <strong className="text-forest-900">₹{cart.delivery_fee.toFixed(0)}</strong>
                    )}
                  </div>

                  {fulfillmentType === 'delivery' && !cart.qualifies_free_delivery && (
                    <p className="text-[11px] text-forest-500">
                      Add ₹{(cart.free_delivery_threshold - cart.subtotal).toFixed(0)} more for free delivery!
                    </p>
                  )}

                  <div className="border-t border-forest-100 pt-3">
                    <div className="flex items-baseline justify-between">
                      <span className="font-bold text-forest-900">Total Payable:</span>
                      <span className="font-display text-2xl font-extrabold text-forest-900">
                        ₹
                        {(
                          cart.subtotal +
                          (fulfillmentType === 'pickup' || cart.qualifies_free_delivery ? 0 : cart.delivery_fee)
                        ).toFixed(0)}
                      </span>
                    </div>
                    <p className="text-[10px] text-forest-400">Calculated authoritatively by Loumi Server</p>
                  </div>
                </div>

                {/* Payment Method Notice */}
                <div className="mt-6 rounded-2xl border border-emerald-200 bg-emerald-50/60 p-4 text-xs text-emerald-900">
                  <div className="flex items-center gap-2 font-bold">
                    <ShieldCheck className="h-4 w-4 text-emerald-600" />
                    <span>
                      {fulfillmentType === 'delivery'
                        ? 'Cash on Delivery (COD)'
                        : 'Pay at Store on Pickup'}
                    </span>
                  </div>
                  <p className="mt-1 text-emerald-800">
                    No online card payment required. Inspect your input packaging upon receipt before payment.
                  </p>
                </div>

                {/* Submit Button */}
                <button
                  type="submit"
                  disabled={submitting}
                  className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-full bg-forest-800 py-3 text-sm font-bold text-white shadow-xs transition hover:bg-forest-900 active:scale-95 disabled:opacity-50"
                >
                  {submitting ? (
                    <>
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                      <span>Submitting Order Request...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="h-4 w-4" />
                      <span>Confirm Order Request</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
