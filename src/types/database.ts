export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type UserRole = "user" | "admin";
export type AuctionStatus = "draft" | "scheduled" | "active" | "ended" | "cancelled";
export type FulfillmentType = "shipping" | "collection";
export type PaymentStatus =
  | "pending"
  | "submitted"
  | "verified"
  | "rejected"
  | "refunded"
  | "collected"
  | "dispatched"
  | "delivered";
export type NotificationType =
  | "bid_outbid"
  | "auction_won"
  | "auction_ending"
  | "payment_verified"
  | "payment_rejected"
  | "account_suspended"
  | "payment_submitted"
  | "order_dispatched"
  | "collection_confirmed"
  | "order_delivered"
  | "general";
export type SuspensionType = "temporary" | "permanent";

export interface Profile {
  id: string;
  real_name: string;
  username: string;
  whatsapp: string;
  role: string;
  status: string;
  verification_status: string;
  completed_wins: number;
  unpaid_wins: number;
  total_bids: number;
  admin_notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface ShippingAddress {
  id: number;
  user_id: string;
  label: string;
  recipient_name: string;
  phone: string | null;
  address_line1: string;
  address_line2: string | null;
  city: string;
  state: string;
  postal_code: string;
  country: string;
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

export interface Auction {
  id: number;

  auction_number: string;
  internal_sku: string | null;

  title: string;
  short_description: string | null;

  category_id: number | null;

  quantity: number;

  condition: string;
  region: string;

  languages: string[] | null;

  starting_price: number;
  minimum_increment: number;

  current_bid: number | null;
  bid_count: number | null;
  unique_bidder_count: number | null;
  watcher_count: number | null;

  anti_snipe_enabled: boolean | null;
  anti_snipe_trigger_minutes: number | null;
  anti_snipe_extend_minutes: number | null;

  cover_photo_url: string | null;
  gallery_photos: string[] | null;

  start_at: string;
  end_at: string;

  status: AuctionStatus;

  winner_user_id: string | null;

  shipping_type: string | null;
  shipping_fee_west: number | null;
  shipping_fee_east: number | null;
  ships_to_west: boolean;
  ships_to_east: boolean;

  created_by: string | null;

  created_at: string;
  updated_at: string;
}

export interface Bid {
  id: number;
  auction_id: number;
  bidder_id: string;
  bid_amount: number;
  is_winning: boolean;
  created_at: string;
  bidder?: Profile;
}

export interface WatchlistItem {
  id: number;
  user_id: string;
  auction_id: number;
  created_at: string;
  auction?: Auction;
}

export interface Payment {
  id: number;
  auction_id: number;
  winner_user_id: string;
  winning_bid: number;
  shipping_fee: number;
  total_amount: number;
  payment_status: PaymentStatus;
  fulfillment_type: FulfillmentType | null;
  receipt_url: string | null;
  payment_due_at: string | null;
  extension_granted: boolean;
  extension_until: string | null;
  shipping_address_id: number | null;
  collection_date: string | null;
  collection_time_slot: string | null;
  collection_remarks: string | null;
  tracking_number: string | null;
  courier: string | null;
  dispatched_at: string | null;
  collection_pin: string | null;
  win_email_sent_at: string | null;
  win_email_sent: boolean;
  payment_reminder_sent_at: string | null;
  admin_notes: string | null;
  verified_by: string | null;
  verified_at: string | null;
  created_at: string;
  updated_at: string;
  auction?: Auction;
  winner?: Profile;
  shipping_address?: ShippingAddress;
}

export interface Notification {
  id: number;
  user_id: string;
  notification_type: NotificationType;
  title: string;
  message: string;
  related_auction_id: number | null;
  is_read: boolean;
  created_at: string;
}

export interface Category {
  id: number;
  name: string;
  display_order: number | null;
  is_active: boolean;
  created_at: string;
}

export interface BlacklistEntry {
  id: string;
  email: string;
  reason: string;
  blacklisted_by: string | null;
  created_at: string;
}

export interface AdminActivityLog {
  id: string;
  admin_id: string;
  action: string;
  entity_type: string;
  entity_id: string | null;
  details: Json | null;
  created_at: string;
  admin?: Profile;
}

export interface SuspensionRecord {
  id: number;
  user_id: string;
  suspended_by: string;
  suspension_type: SuspensionType;
  reason: string;
  offence_count: number;
  related_auction_id: number | null;
  suspended_until: string | null;
  is_active: boolean;
  admin_notes: string | null;
  created_at: string;
}

type TableRow<
  T extends
    | Profile
    | Category
    | ShippingAddress
    | Auction
    | Bid
    | WatchlistItem
    | Payment
    | Notification
    | BlacklistEntry
    | AdminActivityLog
    | SuspensionRecord,
> = {
  Row: T;
  Insert: Record<string, unknown>;
  Update: Record<string, unknown>;
  Relationships: [];
};

export type Database = {
  public: {
    Tables: {
      profiles: TableRow<Profile>;
      categories: TableRow<Category>;
      shipping_addresses: TableRow<ShippingAddress>;
      auctions: TableRow<Auction>;
      bids: TableRow<Bid>;
      watchlists: TableRow<WatchlistItem>;
      payments: TableRow<Payment>;
      notifications: TableRow<Notification>;
      blacklist: TableRow<BlacklistEntry>;
      admin_activity_logs: TableRow<AdminActivityLog>;
      user_suspensions: TableRow<SuspensionRecord>;
    };
    Views: Record<string, never>;
    Functions: {
      activate_scheduled_auctions: { Args: Record<string, never>; Returns: undefined };
      end_expired_auctions: { Args: Record<string, never>; Returns: undefined };
      end_auction: { Args: { p_auction_id: number }; Returns: undefined };
      is_admin: { Args: Record<string, never>; Returns: boolean };
      is_suspended: { Args: Record<string, never>; Returns: boolean };
      lift_expired_suspension: { Args: Record<string, never>; Returns: boolean };
    };
  };
};
