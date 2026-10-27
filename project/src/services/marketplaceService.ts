import { API_ENDPOINTS } from "@/config/api";
import { getJson, postJson, putJson, deleteJson } from "./apiClient";
import {
  MarketplaceCategory,
  MarketplaceProduct,
  MarketplaceShop,
  CartResponse,
  MarketplaceOrder,
  MarketplaceRecommendation,
  ProductFilters,
} from "@/types/marketplace";

export async function fetchCategories(): Promise<MarketplaceCategory[]> {
  const res = await getJson<{ categories: MarketplaceCategory[] }>(
    API_ENDPOINTS.marketplaceCategories
  );
  return res.categories || [];
}

export async function fetchProducts(
  filters: ProductFilters = {}
): Promise<{ products: MarketplaceProduct[]; count: number }> {
  const params = new URLSearchParams();
  if (filters.category_slug) params.set("category_slug", filters.category_slug);
  if (filters.crop) params.set("crop", filters.crop);
  if (filters.q) params.set("q", filters.q);
  if (filters.is_organic !== undefined)
    params.set("is_organic", String(filters.is_organic));
  if (filters.available_online !== undefined)
    params.set("available_online", String(filters.available_online));
  if (filters.available_offline !== undefined)
    params.set("available_offline", String(filters.available_offline));
  if (filters.min_price !== undefined)
    params.set("min_price", String(filters.min_price));
  if (filters.max_price !== undefined)
    params.set("max_price", String(filters.max_price));
  if (filters.sort_by) params.set("sort_by", filters.sort_by);

  const qs = params.toString();
  const url = qs
    ? `${API_ENDPOINTS.marketplaceProducts}?${qs}`
    : API_ENDPOINTS.marketplaceProducts;

  return await getJson<{ products: MarketplaceProduct[]; count: number }>(url);
}

export async function fetchProduct(
  idOrSlug: string
): Promise<{
  product: MarketplaceProduct;
  offline_shops: MarketplaceShop[];
  offline_stock_count: number;
}> {
  return await getJson<{
    product: MarketplaceProduct;
    offline_shops: MarketplaceShop[];
    offline_stock_count: number;
  }>(`${API_ENDPOINTS.marketplaceProducts}/${encodeURIComponent(idOrSlug)}`);
}

export async function fetchShops(
  district?: string,
  search?: string
): Promise<{ shops: MarketplaceShop[]; count: number }> {
  const params = new URLSearchParams();
  if (district && district.toLowerCase() !== "all")
    params.set("district", district);
  if (search) params.set("q", search);

  const qs = params.toString();
  const url = qs
    ? `${API_ENDPOINTS.marketplaceShops}?${qs}`
    : API_ENDPOINTS.marketplaceShops;

  return await getJson<{ shops: MarketplaceShop[]; count: number }>(url);
}

export async function fetchShopDetails(
  shopId: string
): Promise<{ shop: MarketplaceShop }> {
  return await getJson<{ shop: MarketplaceShop }>(
    `${API_ENDPOINTS.marketplaceShops}/${encodeURIComponent(shopId)}`
  );
}

export async function fetchRecommendations(
  crop: string = "Pineapple",
  diseaseClass?: string,
  growthStage?: string,
  farmId?: string
): Promise<MarketplaceRecommendation> {
  const params = new URLSearchParams();
  if (crop) params.set("crop", crop);
  if (diseaseClass) params.set("disease_class", diseaseClass);
  if (growthStage) params.set("growth_stage", growthStage);
  if (farmId) params.set("farm_id", farmId);

  const qs = params.toString();
  const url = `${API_ENDPOINTS.marketplaceRecommendations}?${qs}`;
  return await getJson<MarketplaceRecommendation>(url);
}

export async function fetchCart(): Promise<CartResponse> {
  return await getJson<CartResponse>(API_ENDPOINTS.marketplaceCart);
}

export async function addToCart(
  productId: string,
  quantity: number = 1
): Promise<CartResponse> {
  return await postJson<{ product_id: string; quantity: number }, CartResponse>(
    API_ENDPOINTS.marketplaceCart,
    { product_id: productId, quantity }
  );
}

export async function updateCartQuantity(
  cartItemId: string,
  quantity: number
): Promise<CartResponse> {
  return await putJson<{ quantity: number }, CartResponse>(
    `${API_ENDPOINTS.marketplaceCart}/${encodeURIComponent(cartItemId)}`,
    { quantity }
  );
}

export async function removeFromCart(cartItemId: string): Promise<CartResponse> {
  return await deleteJson<CartResponse>(
    `${API_ENDPOINTS.marketplaceCart}/${encodeURIComponent(cartItemId)}`
  );
}

export async function clearCart(): Promise<{ message: string }> {
  return await deleteJson<{ message: string }>(API_ENDPOINTS.marketplaceCart);
}

export interface PlaceOrderPayload {
  fulfillment_type: "delivery" | "pickup";
  recipient_name: string;
  contact_phone: string;
  delivery_district?: string;
  delivery_address?: string;
  delivery_pin_code?: string;
  pickup_shop_id?: string;
  notes?: string;
}

export async function placeOrder(
  payload: PlaceOrderPayload
): Promise<{ message: string; order: MarketplaceOrder }> {
  return await postJson<PlaceOrderPayload, { message: string; order: MarketplaceOrder }>(
    API_ENDPOINTS.marketplaceOrders,
    payload
  );
}

export async function fetchMyOrders(): Promise<{ orders: MarketplaceOrder[]; count: number }> {
  return await getJson<{ orders: MarketplaceOrder[]; count: number }>(
    API_ENDPOINTS.marketplaceOrders
  );
}

export async function fetchOrderDetails(
  orderIdOrNumber: string
): Promise<{ order: MarketplaceOrder }> {
  return await getJson<{ order: MarketplaceOrder }>(
    `${API_ENDPOINTS.marketplaceOrders}/${encodeURIComponent(orderIdOrNumber)}`
  );
}

export async function adminFetchOrders(
  statusFilter?: string
): Promise<{ orders: MarketplaceOrder[]; count: number }> {
  const url =
    statusFilter && statusFilter.toLowerCase() !== "all"
      ? `${API_ENDPOINTS.marketplaceAdminOrders}?status=${encodeURIComponent(statusFilter)}`
      : API_ENDPOINTS.marketplaceAdminOrders;
  return await getJson<{ orders: MarketplaceOrder[]; count: number }>(url);
}

export async function adminUpdateOrderStatus(
  orderId: string,
  status: string,
  paymentStatus?: string
): Promise<{ message: string; order: MarketplaceOrder }> {
  return await putJson<
    { status: string; payment_status?: string },
    { message: string; order: MarketplaceOrder }
  >(`${API_ENDPOINTS.marketplaceAdminOrders}/${encodeURIComponent(orderId)}/status`, {
    status,
    payment_status: paymentStatus,
  });
}

export async function adminCreateProduct(
  productData: Partial<MarketplaceProduct>
): Promise<{ message: string; product: MarketplaceProduct }> {
  return await postJson<
    Partial<MarketplaceProduct>,
    { message: string; product: MarketplaceProduct }
  >(API_ENDPOINTS.marketplaceAdminProducts, productData);
}

export async function adminUpdateProduct(
  productId: string,
  productData: Partial<MarketplaceProduct>
): Promise<{ message: string; product: MarketplaceProduct }> {
  return await putJson<
    Partial<MarketplaceProduct>,
    { message: string; product: MarketplaceProduct }
  >(
    `${API_ENDPOINTS.marketplaceAdminProducts}/${encodeURIComponent(productId)}`,
    productData
  );
}
