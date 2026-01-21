/**
 * Common TypeScript type definitions for the application
 */

// Base entity interface
export interface BaseEntity {
  shortname: string;
  subpath: string;
  resource_type: string;
  space_name?: string;
  uuid?: string;
  created_at?: string;
  updated_at?: string;
  is_active?: boolean;
  state?: EntityState;
  attributes?: Record<string, any>;
}

// Entity states
export type EntityState = 'pending' | 'in_progress' | 'approved' | 'rejected' | 'active' | 'inactive';

// Attachment interface
export interface Attachment extends BaseEntity {
  attributes: {
    payload?: {
      body?: string;
      content_type?: string;
      size?: number;
    };
  };
}

// Space interface
export interface Space extends BaseEntity {
  displayname?: Record<string, string>;
  description?: Record<string, string>;
  meta?: Record<string, any>;
}

// User profile interface
export interface UserProfile {
  displayname?: string;
  email?: string;
  msisdn?: string;
  password?: string;
  groups?: string[];
  roles?: string[];
  is_active?: boolean;
}

// Form data interfaces
export interface FormData {
  [key: string]: any;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

// Schema interfaces
export interface SchemaProperty {
  type: 'string' | 'number' | 'integer' | 'boolean' | 'array' | 'object';
  title?: string;
  description?: string;
  default?: any;
  enum?: any[];
  format?: string;
  minimum?: number;
  maximum?: number;
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  multipleOf?: number;
  items?: SchemaProperty;
  properties?: Record<string, SchemaProperty>;
  required?: string[];
  additionalProperties?: boolean;
}

export interface Schema {
  title?: string;
  description?: string;
  type: string;
  properties: Record<string, SchemaProperty>;
  required?: string[];
  additionalProperties?: boolean;
}

// API Response interfaces
export interface ApiResponse<T = any> {
  status: 'success' | 'error' | 'failed';
  data?: T;
  message?: string;
  errors?: string[];
}

export interface QueryResponse<T = any> extends ApiResponse<T> {
  records?: T[];
  attributes?: Record<string, any>;
}

// Order related interfaces
export interface OrderItem {
  sku: string;
  options: Array<{
    key: string;
    variation_shortname: string;
  }>;
  discount: {
    type: string;
    value: number;
  };
  quantity: number;
  subtotal: number;
  variant_key: string;
  item_subtotal: number;
  brand_shortname: string;
  price_at_purchase: number;
  product_shortname: string;
  available_shortname: string;
  commission_category: string;
  main_category_shortname: string;
}

export interface OrderUser {
  email?: string;
  phone: string;
  state: string;
  address: string;
  shortname: string;
  displayname: string;
}

export interface OrderShipping {
  key: string;
  max: number;
  min: number;
  cost: number;
  minimum_retail: number;
}

export interface OrderCoupon {
  code: string;
  type: string;
  is_shipping: boolean;
  discount_type: string;
  discount_value: number;
  discount_amount: number;
  seller_shortname?: string;
  coupon_body?: any;
}

export interface OrderPayload {
  info: string;
  user: OrderUser;
  items: OrderItem[];
  coupon?: OrderCoupon;
  services: any[];
  shipping: OrderShipping;
  is_active: boolean;
  order_code: string;
  order_from: string;
  activated_at?: string;
  payment_type: string;
  tracking_code: string;
  payment_status: string;
  combined_order_id: number;
  payment_transaction_id?: string;
}

// Wrapper for nested order structure from API
export interface OrderPayloadWrapper {
  tags: string[];
  uuid: string;
  state: string;
  is_open: boolean;
  payload: {
    body: OrderPayload;
    checksum: string;
    content_type: string;
  };
  is_active: boolean;
  shortname: string;
  created_at: string;
  updated_at: string;
  attachments: Record<string, any>;
  description: Record<string, any>;
  displayname: Record<string, any>;
  owner_shortname: string;
  workflow_shortname: string;
}

export interface Order {
  resource_type: 'ticket';
  uuid: string;
  shortname: string;
  subpath: string;
  attributes: {
    created_at: string;
    state: string;
    updated_at: string;
    is_open: boolean;
    space_name: string;
    owner_shortname: string;
    workflow_shortname: string;
    displayname?: Record<string, string>;
    payload: {
      body: OrderPayloadWrapper;
      checksum: string;
      content_type: string;
      schema_shortname: string | null;
    };
    description?: Record<string, string>;
    is_active: boolean;
    tags: string[];
  };
}

export interface CombinedOrderPayload {
  info: string;
  coupon?: OrderCoupon;
  is_active: boolean;
  created_at: string;
  order_from: string;
  payment_type: string;
  total_amount: number;
  payment_status: string;
  user_shortname: string;
  combined_order_id: number;
  orders_shortnames: string[];
}

export interface CombinedOrder {
  resource_type: 'content';
  uuid: string;
  shortname: string;
  subpath: string;
  attributes: {
    created_at: string;
    updated_at: string;
    space_name: string;
    owner_shortname: string;
    payload: {
      body: CombinedOrderPayload;
      checksum: string;
      content_type: string;
    };
    is_active: boolean;
    tags: string[];
  };
}

export interface PaymentPayload {
  amount: number;
  status: string;
  currency: string;
  created_at: string;
  updated_at: string;
  payment_url?: string;
  checkout_id?: string;
  completed_at?: string;
  failed_at?: string;
  failure_reason?: string;
  transaction_id: string;
  payment_provider: string;
  payment_response: any;
  combined_order_shortname: string;
}

export interface Payment {
  resource_type: 'content';
  uuid: string;
  shortname: string;
  subpath: string;
  attributes: {
    created_at: string;
    updated_at: string;
    space_name: string;
    owner_shortname: string;
    payload: {
      body: PaymentPayload;
      checksum: string;
      content_type: string;
    };
    is_active: boolean;
    tags: string[];
  };
}
}

// Order related interfaces
export interface OrderItem {
  sku: string;
  options: Array<{
    key: string;
    variation_shortname: string;
  }>;
  discount: {
    type: string;
    value: number;
  };
  quantity: number;
  subtotal: number;
  variant_key: string;
  item_subtotal: number;
  brand_shortname: string;
  price_at_purchase: number;
  product_shortname: string;
  available_shortname: string;
  commission_category: string;
  main_category_shortname: string;
}

export interface OrderUser {
  email?: string;
  phone: string;
  state: string;
  address: string;
  shortname: string;
  displayname: string;
}

export interface OrderShipping {
  key: string;
  max: number;
  min: number;
  cost: number;
  minimum_retail: number;
}

export interface OrderCoupon {
  code: string;
  type: string;
  is_shipping: boolean;
  discount_type: string;
  discount_value: number;
  discount_amount: number;
  seller_shortname?: string;
  coupon_body?: any;
}

export interface OrderPayload {
  info: string;
  user: OrderUser;
  items: OrderItem[];
  coupon?: OrderCoupon;
  services: any[];
  shipping: OrderShipping;
  is_active: boolean;
  order_code: string;
  order_from: string;
  activated_at?: string;
  payment_type: string;
  tracking_code: string;
  payment_status: string;
  combined_order_id: number;
  payment_transaction_id?: string;
}

export interface Order {
  resource_type: 'ticket';
  uuid: string;
  shortname: string;
  subpath: string;
  attributes: {
    created_at: string;
    state: string;
    updated_at: string;
    is_open: boolean;
    space_name: string;
    owner_shortname: string;
    workflow_shortname: string;
    displayname?: Record<string, string>;
    payload: {
      body: OrderPayload;
      checksum: string;
      content_type: string;
      schema_shortname: string | null;
    };
    description?: Record<string, string>;
    is_active: boolean;
    tags: string[];
  };
}

export interface CombinedOrderPayload {
  info: string;
  coupon?: OrderCoupon;
  is_active: boolean;
  created_at: string;
  order_from: string;
  payment_type: string;
  total_amount: number;
  payment_status: string;
  user_shortname: string;
  combined_order_id: number;
  orders_shortnames: string[];
}

export interface CombinedOrder {
  resource_type: 'content';
  uuid: string;
  shortname: string;
  subpath: string;
  attributes: {
    created_at: string;
    updated_at: string;
    space_name: string;
    owner_shortname: string;
    payload: {
      body: CombinedOrderPayload;
      checksum: string;
      content_type: string;
    };
    is_active: boolean;
    tags: string[];
  };
}

export interface PaymentPayload {
  amount: number;
  status: string;
  currency: string;
  created_at: string;
  updated_at: string;
  payment_url?: string;
  checkout_id?: string;
  completed_at?: string;
  failed_at?: string;
  failure_reason?: string;
  transaction_id: string;
  payment_provider: string;
  payment_response: any;
  combined_order_shortname: string;
}

export interface Payment {
  resource_type: 'content';
  uuid: string;
  shortname: string;
  subpath: string;
  attributes: {
    created_at: string;
    updated_at: string;
    space_name: string;
    owner_shortname: string;
    payload: {
      body: PaymentPayload;
      checksum: string;
      content_type: string;
    };
    is_active: boolean;
    tags: string[];
  };
}

// Request interfaces
export interface RequestRecord {
  resource_type: string;
  shortname: string;
  subpath: string;
  attributes: Record<string, any>;
}

export interface ApiRequest {
  space_name: string;
  request_type: string;
  records: RequestRecord[];
}

// Notification interface
export interface Notification extends BaseEntity {
  title?: string;
  message?: string;
  read?: boolean;
  type?: 'info' | 'success' | 'warning' | 'error';
}

// Contact message interface
export interface ContactMessage extends BaseEntity {
  subject?: string;
  message?: string;
  sender_email?: string;
  replied?: boolean;
  reply_message?: string;
}

// File type information
export interface FileTypeInfo {
  contentType: string;
  resourceType: string;
}

// Preview data interface
export interface PreviewData {
  url: string;
  type: 'image' | 'video' | 'pdf' | 'audio' | 'file';
  filename: string;
}

// Editor interfaces
export interface EditorOptions {
  uid?: string;
  content: string;
  isEditMode?: boolean;
  attachments?: Attachment[];
  resource_type?: string;
  space_name?: string;
  subpath?: string;
  parent_shortname?: string;
  changed?: () => void;
}

// Toast message interface
export interface ToastOptions {
  message: string;
  type?: 'success' | 'error' | 'warning' | 'info';
  timeout?: number;
}

// Pagination interface
export interface PaginationInfo {
  current_page: number;
  total_pages: number;
  total_records: number;
  page_size: number;
}

// Search/Filter interfaces
export interface SearchFilters {
  query?: string;
  resource_type?: string;
  state?: EntityState;
  date_from?: string;
  date_to?: string;
  [key: string]: any;
}

export interface SearchResult<T = BaseEntity> {
  records: T[];
  pagination: PaginationInfo;
  filters: SearchFilters;
}