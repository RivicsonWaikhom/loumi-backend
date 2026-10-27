import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ShoppingBag,
  Store,
  Truck,
  Clock,
  CheckCircle2,
  AlertCircle,
  Phone,
  ArrowRight,
  PackageCheck,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { fetchMyOrders } from '@/services/marketplaceService';
import { MarketplaceOrder, OrderStatus } from '@/types/marketplace';
import { useAuth } from '@/context/AuthContext';

export default function OrderHistory() {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();

  const [orders, setOrders] = useState<MarketplaceOrder[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login?redirect=/marketplace/orders');
      return;
    }

    async function load() {
      try {
        setLoading(true);
        const res = await fetchMyOrders();
        setOrders(res.orders);
      } catch (err: any) {
        console.error('Failed to load orders:', err);
        setError(err.message || 'Failed to fetch order history.');
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [isAuthenticated, navigate]);

  const getStatusBadge = (status: OrderStatus) => {
    switch (status) {
      case 'completed':
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-3 py-0.5 text-xs font-bold text-emerald-800">
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
            <span>Completed</span>
          </span>
        );
      case 'dispatched':
      case 'ready_for_pickup':
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-3 py-0.5 text-xs font-bold text-blue-800">
            <Truck className="h-3.5 w-3.5 text-blue-600" />
            <span>{status === 'ready_for_pickup' ? 'Ready for Pickup' : 'Dispatched'}</span>
          </span>
        );
      case 'processing':
      case 'confirmed':
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-3 py-0.5 text-xs font-bold text-amber-800">
            <Clock className="h-3.5 w-3.5 text-amber-600" />
            <span>{status === 'processing' ? 'Processing' : 'Confirmed'}</span>
          </span>
        );
      case 'cancelled':
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-3 py-0.5 text-xs font-bold text-red-800">
            <AlertCircle className="h-3.5 w-3.5 text-red-600" />
            <span>Cancelled</span>
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-forest-100 px-3 py-0.5 text-xs font-bold text-forest-800">
            <Clock className="h-3.5 w-3.5 text-forest-600" />
            <span>Pending Review</span>
          </span>
        );
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center text-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-forest-600 border-t-transparent" />
        <p className="mt-4 text-sm font-semibold text-forest-700">Loading your orders...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-forest-50/20 pb-20">
      <div className="border-b border-forest-100 bg-white py-6">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="font-display text-2xl font-bold text-forest-900 sm:text-3xl">
                My Order History
              </h1>
              <p className="mt-1 text-xs text-forest-600">
                Track your agricultural input orders, delivery status, and pickup store details.
              </p>
            </div>

            <Link
              to="/marketplace"
              className="inline-flex items-center gap-1.5 rounded-full bg-forest-800 px-4 py-2 text-xs font-bold text-white hover:bg-forest-900"
            >
              <ShoppingBag className="h-3.5 w-3.5" />
              <span>Back to Marketplace</span>
            </Link>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
        {error && (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-center text-xs text-red-800">
            {error}
          </div>
        )}

        {orders.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-forest-200 bg-white p-12 text-center">
            <PackageCheck className="mx-auto h-12 w-12 text-forest-300" />
            <h3 className="mt-4 font-display text-lg font-bold text-forest-900">
              No agricultural orders placed yet
            </h3>
            <p className="mt-1 text-xs text-forest-600">
              When you purchase items online or place a pickup reservation, your records will show up here.
            </p>
            <Link
              to="/marketplace"
              className="mt-6 inline-flex items-center gap-2 rounded-full bg-forest-800 px-6 py-2.5 text-xs font-bold text-white hover:bg-forest-900"
            >
              <span>Explore Marketplace Catalog</span>
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        ) : (
          <div className="space-y-6">
            {orders.map((order) => (
              <div
                key={order.id}
                className="overflow-hidden rounded-3xl border border-forest-100 bg-white p-6 shadow-2xs"
              >
                {/* Header */}
                <div className="flex flex-wrap items-center justify-between gap-4 border-b border-forest-50 pb-4">
                  <div>
                    <span className="font-mono text-xs font-bold text-forest-900">
                      {order.order_number}
                    </span>
                    <p className="mt-0.5 text-[11px] text-forest-500">
                      Placed on {new Date(order.created_at).toLocaleDateString('en-IN', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </p>
                  </div>

                  <div className="flex items-center gap-3">
                    {getStatusBadge(order.status)}
                    <span className="font-display text-lg font-extrabold text-forest-900">
                      ₹{order.total_amount.toFixed(0)}
                    </span>
                  </div>
                </div>

                {/* Fulfillment Details */}
                <div className="mt-4 grid grid-cols-1 gap-4 text-xs text-forest-700 sm:grid-cols-2">
                  <div className="rounded-xl bg-forest-50/60 p-3">
                    <p className="font-bold text-forest-900 flex items-center gap-1.5">
                      {order.fulfillment_type === 'pickup' ? (
                        <>
                          <Store className="h-4 w-4 text-forest-700" />
                          <span>Store Pickup Location:</span>
                        </>
                      ) : (
                        <>
                          <Truck className="h-4 w-4 text-forest-700" />
                          <span>Home Delivery Destination:</span>
                        </>
                      )}
                    </p>

                    <p className="mt-1 font-medium">
                      {order.fulfillment_type === 'pickup'
                        ? `${order.pickup_shop_name} (${order.pickup_shop_locality})`
                        : `${order.delivery_address}, ${order.delivery_district}`}
                    </p>

                    <p className="mt-0.5 text-forest-500">
                      Recipient: <strong>{order.recipient_name}</strong> • Phone: {order.contact_phone}
                    </p>
                  </div>

                  <div className="rounded-xl bg-forest-50/60 p-3 flex flex-col justify-between">
                    <div>
                      <p className="font-bold text-forest-900">Payment &amp; Invoicing</p>
                      <p className="mt-1">
                        Method:{' '}
                        <span className="capitalize font-medium">
                          {order.payment_method === 'cash_on_delivery'
                            ? 'Cash on Delivery (COD)'
                            : 'Pay at Store on Pickup'}
                        </span>
                      </p>
                      <p className="text-forest-500">
                        Status:{' '}
                        <strong className="text-forest-800 uppercase text-[10px]">
                          {order.payment_status}
                        </strong>
                      </p>
                    </div>

                    <div className="mt-2 text-[11px] text-forest-500">
                      Total Items: <strong>{order.total_items_count} items</strong>
                    </div>
                  </div>
                </div>

                {/* Helpline footer */}
                <div className="mt-4 flex items-center justify-between border-t border-forest-50 pt-3 text-[11px] text-forest-500">
                  <span>Questions about this order? Contact Loumi Support:</span>
                  <a
                    href="tel:+919862012345"
                    className="flex items-center gap-1 font-bold text-forest-800 hover:text-emerald-700"
                  >
                    <Phone className="h-3 w-3" />
                    <span>+91 98620 12345</span>
                  </a>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
