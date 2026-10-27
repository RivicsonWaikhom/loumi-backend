export interface MarketplaceCategory {
  id: string;
  name: string;
  slug: string;
  icon?: string;
  description?: string;
  display_order: number;
}

export interface MarketplaceProduct {
  id: string;
  name: string;
  slug: string;
  category_id: string;
  category_name?: string;
  category_slug?: string;
  subcategory?: string;
  brand: string;
  description: string;
  intended_crops: string[];
  target_conditions: string[];
  use_case?: string;
  package_size: string;
  price: number;
  currency: string;
  stock_quantity: number;
  is_available_online: number | boolean;
  is_available_offline: number | boolean;
  is_organic: number | boolean;
  composition?: string;
  usage_instructions?: string;
  dosage_guidelines?: string;
  safety_precautions?: string;
  regulatory_info?: string;
  seller_name: string;
  image_url?: string;
  rating: number;
  reviews_count: number;
  is_active: number | boolean;
  created_at?: string;
}

export interface MarketplaceShop {
  id: string;
  name: string;
  slug: string;
  district: string;
  address: string;
  locality: string;
  contact_phone: string;
  opening_hours: string;
  latitude?: number;
  longitude?: number;
  is_verified: number | boolean;
  verification_badge?: string;
  created_at?: string;
  inventory?: MarketplaceShopInventoryItem[];
  in_stock?: number | boolean;
  stock_level?: 'in_stock' | 'low_stock' | 'out_of_stock';
  price_override?: number | null;
  last_verified_at?: string;
}

export interface MarketplaceShopInventoryItem {
  id: string;
  name: string;
  slug: string;
  package_size: string;
  price: number;
  is_organic: number | boolean;
  image_url?: string;
  rating: number;
  subcategory?: string;
  category_name?: string;
  in_stock: number | boolean;
  stock_level: string;
  price_override?: number | null;
  last_verified_at?: string;
}

export interface CartItem {
  cart_item_id: string;
  product_id: string;
  name: string;
  slug: string;
  brand: string;
  price: number;
  package_size: string;
  quantity: number;
  stock_quantity: number;
  item_total: number;
  in_stock: boolean;
  image_url?: string;
  is_available_online: number | boolean;
  is_organic: number | boolean;
  category_name?: string;
}

export interface CartResponse {
  user_id: string;
  items: CartItem[];
  total_items: number;
  subtotal: number;
  delivery_fee: number;
  free_delivery_threshold: number;
  qualifies_free_delivery: boolean;
  total_amount: number;
  currency: string;
}

export interface OrderItem {
  id: string;
  order_id: string;
  product_id: string;
  product_name: string;
  package_size: string;
  unit_price: number;
  quantity: number;
  total_price: number;
  image_url?: string;
  product_slug?: string;
}

export type OrderStatus =
  | 'pending'
  | 'confirmed'
  | 'processing'
  | 'ready_for_pickup'
  | 'dispatched'
  | 'completed'
  | 'cancelled';

export interface MarketplaceOrder {
  id: string;
  order_number: string;
  user_id: string;
  status: OrderStatus;
  fulfillment_type: 'delivery' | 'pickup';
  pickup_shop_id?: string | null;
  pickup_shop_name?: string | null;
  pickup_shop_locality?: string | null;
  pickup_shop_address?: string | null;
  pickup_shop_phone?: string | null;
  recipient_name: string;
  contact_phone: string;
  delivery_district?: string | null;
  delivery_address?: string | null;
  delivery_pin_code?: string | null;
  notes?: string | null;
  subtotal: number;
  delivery_fee: number;
  total_amount: number;
  payment_method: 'cash_on_delivery' | 'pay_at_pickup';
  payment_status: 'unpaid' | 'paid_on_receipt';
  created_at: string;
  updated_at?: string;
  items?: OrderItem[];
  total_items_count?: number;
  user_full_name?: string;
  user_email?: string;
}

export interface MarketplaceRecommendation {
  crop?: string;
  disease_condition?: string | null;
  advisory_notes: string[];
  disclaimer: string;
  recommendations: Array<{
    product: MarketplaceProduct;
    relevance_reason: string;
    application_priority: string;
  }>;
}

export interface ProductFilters {
  category_slug?: string;
  crop?: string;
  q?: string;
  is_organic?: boolean;
  available_online?: boolean;
  available_offline?: boolean;
  min_price?: number;
  max_price?: number;
  sort_by?: 'recommended' | 'price_asc' | 'price_desc' | 'rating';
}
