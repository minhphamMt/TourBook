-- TourBook full schema for Supabase (single company version)
-- Run this in Supabase SQL Editor on a fresh project.
-- This file creates enums, tables, indexes, triggers, helper functions, and seed data.

create extension if not exists pgcrypto;

do $$
begin
  if not exists (
    select 1
    from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where t.typname = 'user_status' and n.nspname = 'public'
  ) then
    create type public.user_status as enum ('active', 'inactive', 'blocked');
  end if;

  if not exists (
    select 1
    from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where t.typname = 'gender_type' and n.nspname = 'public'
  ) then
    create type public.gender_type as enum ('male', 'female', 'other');
  end if;

  if not exists (
    select 1
    from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where t.typname = 'tour_status' and n.nspname = 'public'
  ) then
    create type public.tour_status as enum ('draft', 'published', 'archived');
  end if;

  if not exists (
    select 1
    from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where t.typname = 'schedule_status' and n.nspname = 'public'
  ) then
    create type public.schedule_status as enum (
      'draft',
      'open',
      'sold_out',
      'closed',
      'completed',
      'cancelled'
    );
  end if;

  if not exists (
    select 1
    from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where t.typname = 'traveler_type' and n.nspname = 'public'
  ) then
    create type public.traveler_type as enum ('adult', 'child', 'infant');
  end if;

  if not exists (
    select 1
    from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where t.typname = 'booking_status' and n.nspname = 'public'
  ) then
    create type public.booking_status as enum (
      'pending',
      'awaiting_payment',
      'confirmed',
      'completed',
      'cancel_requested',
      'cancelled',
      'expired'
    );
  end if;

  if not exists (
    select 1
    from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where t.typname = 'payment_status' and n.nspname = 'public'
  ) then
    create type public.payment_status as enum (
      'unpaid',
      'pending',
      'partially_paid',
      'paid',
      'failed',
      'refunded',
      'partially_refunded'
    );
  end if;

  if not exists (
    select 1
    from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where t.typname = 'payment_transaction_status' and n.nspname = 'public'
  ) then
    create type public.payment_transaction_status as enum (
      'pending',
      'authorized',
      'paid',
      'failed',
      'cancelled',
      'refunded',
      'partially_refunded',
      'expired'
    );
  end if;

  if not exists (
    select 1
    from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where t.typname = 'review_status' and n.nspname = 'public'
  ) then
    create type public.review_status as enum ('pending', 'approved', 'hidden');
  end if;

  if not exists (
    select 1
    from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where t.typname = 'refund_status' and n.nspname = 'public'
  ) then
    create type public.refund_status as enum ('pending', 'approved', 'rejected', 'refunded');
  end if;

  if not exists (
    select 1
    from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where t.typname = 'ticket_status' and n.nspname = 'public'
  ) then
    create type public.ticket_status as enum ('open', 'in_progress', 'resolved', 'closed');
  end if;

  if not exists (
    select 1
    from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where t.typname = 'ticket_sender_type' and n.nspname = 'public'
  ) then
    create type public.ticket_sender_type as enum ('customer', 'staff', 'system');
  end if;

  if not exists (
    select 1
    from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where t.typname = 'discount_type' and n.nspname = 'public'
  ) then
    create type public.discount_type as enum ('percentage', 'fixed_amount');
  end if;

  if not exists (
    select 1
    from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where t.typname = 'booking_price_line_type' and n.nspname = 'public'
  ) then
    create type public.booking_price_line_type as enum (
      'fare',
      'surcharge',
      'discount',
      'tax',
      'service_fee',
      'coupon'
    );
  end if;

  if not exists (
    select 1
    from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where t.typname = 'payment_method_type' and n.nspname = 'public'
  ) then
    create type public.payment_method_type as enum ('gateway', 'bank_transfer', 'cash', 'manual');
  end if;
end
$$;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.generate_booking_code()
returns text
language plpgsql
as $$
begin
  return 'BK' || to_char(now(), 'YYMMDD') || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));
end;
$$;

create or replace function public.generate_ticket_code()
returns text
language plpgsql
as $$
begin
  return 'TK' || to_char(now(), 'YYMMDD') || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));
end;
$$;

create or replace function public.generate_invoice_number()
returns text
language plpgsql
as $$
begin
  return 'INV' || to_char(now(), 'YYYYMMDD') || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6));
end;
$$;

create table if not exists public.roles (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.permissions (
  id uuid primary key default gen_random_uuid(),
  code text not null,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.role_permissions (
  id uuid primary key default gen_random_uuid(),
  role_id uuid not null references public.roles(id) on delete cascade,
  permission_id uuid not null references public.permissions(id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint role_permissions_role_permission_key unique (role_id, permission_id)
);

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  full_name text,
  phone text,
  avatar_url text,
  date_of_birth date,
  gender public.gender_type,
  address text,
  status public.user_status not null default 'active',
  customer_level text not null default 'regular',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  role_id uuid not null references public.roles(id) on delete cascade,
  assigned_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint user_roles_user_role_key unique (user_id, role_id)
);

create table if not exists public.saved_travelers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  full_name text not null,
  phone text,
  email text,
  date_of_birth date,
  gender public.gender_type,
  id_number text,
  passport_number text,
  nationality text,
  traveler_type public.traveler_type not null default 'adult',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.user_addresses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  label text,
  full_name text not null,
  phone text not null,
  address_line text not null,
  province text,
  district text,
  ward text,
  postal_code text,
  country_code text not null default 'VN',
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.locations (
  id uuid primary key default gen_random_uuid(),
  parent_id uuid references public.locations(id) on delete set null,
  name text not null,
  slug text not null,
  location_type text not null,
  description text,
  image_url text,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null,
  description text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.tags (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.cancellation_policies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  rules_jsonb jsonb not null default '[]'::jsonb,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.tours (
  id uuid primary key default gen_random_uuid(),
  slug text not null,
  name text not null,
  short_description text,
  description text,
  departure_location_id uuid references public.locations(id) on delete set null,
  duration_days integer not null check (duration_days > 0),
  duration_nights integer not null default 0 check (duration_nights >= 0),
  base_currency text not null default 'VND',
  is_featured boolean not null default false,
  included_text text,
  excluded_text text,
  terms_text text,
  important_notes text,
  cancellation_policy_id uuid references public.cancellation_policies(id) on delete set null,
  status public.tour_status not null default 'draft',
  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.tour_destinations (
  id uuid primary key default gen_random_uuid(),
  tour_id uuid not null references public.tours(id) on delete cascade,
  location_id uuid not null references public.locations(id) on delete restrict,
  sort_order integer not null default 0,
  is_primary boolean not null default false,
  created_at timestamptz not null default now(),
  constraint tour_destinations_tour_location_key unique (tour_id, location_id)
);

create table if not exists public.tour_categories (
  id uuid primary key default gen_random_uuid(),
  tour_id uuid not null references public.tours(id) on delete cascade,
  category_id uuid not null references public.categories(id) on delete restrict,
  created_at timestamptz not null default now(),
  constraint tour_categories_tour_category_key unique (tour_id, category_id)
);

create table if not exists public.tour_tags (
  id uuid primary key default gen_random_uuid(),
  tour_id uuid not null references public.tours(id) on delete cascade,
  tag_id uuid not null references public.tags(id) on delete restrict,
  created_at timestamptz not null default now(),
  constraint tour_tags_tour_tag_key unique (tour_id, tag_id)
);

create table if not exists public.tour_images (
  id uuid primary key default gen_random_uuid(),
  tour_id uuid not null references public.tours(id) on delete cascade,
  image_url text not null,
  alt_text text,
  is_cover boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.tour_itinerary_days (
  id uuid primary key default gen_random_uuid(),
  tour_id uuid not null references public.tours(id) on delete cascade,
  day_number integer not null check (day_number > 0),
  title text not null,
  description text,
  meals jsonb not null default '[]'::jsonb,
  accommodation text,
  transportation text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tour_itinerary_days_tour_day_key unique (tour_id, day_number)
);

create table if not exists public.departure_schedules (
  id uuid primary key default gen_random_uuid(),
  tour_id uuid not null references public.tours(id) on delete restrict,
  departure_date date not null,
  return_date date not null,
  meeting_point text,
  meeting_at timestamptz,
  capacity integer not null check (capacity > 0),
  cutoff_at timestamptz,
  status public.schedule_status not null default 'open',
  currency text not null default 'VND',
  notes text,
  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint departure_schedules_valid_dates check (return_date >= departure_date),
  constraint departure_schedules_id_tour_key unique (id, tour_id)
);

create table if not exists public.schedule_price_tiers (
  id uuid primary key default gen_random_uuid(),
  schedule_id uuid not null references public.departure_schedules(id) on delete cascade,
  traveler_type public.traveler_type not null,
  age_from integer,
  age_to integer,
  price numeric(14, 2) not null check (price >= 0),
  sale_price numeric(14, 2) check (sale_price is null or sale_price >= 0),
  currency text not null default 'VND',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint schedule_price_tiers_schedule_traveler_key unique (schedule_id, traveler_type),
  constraint schedule_price_tiers_valid_ages check (
    age_from is null or age_to is null or age_to >= age_from
  )
);

create table if not exists public.coupons (
  id uuid primary key default gen_random_uuid(),
  code text not null,
  name text not null,
  description text,
  discount_type public.discount_type not null,
  discount_value numeric(14, 2) not null check (discount_value >= 0),
  min_order_amount numeric(14, 2) not null default 0 check (min_order_amount >= 0),
  max_discount_amount numeric(14, 2) check (max_discount_amount is null or max_discount_amount >= 0),
  start_at timestamptz,
  end_at timestamptz,
  usage_limit integer check (usage_limit is null or usage_limit >= 0),
  usage_per_user_limit integer check (usage_per_user_limit is null or usage_per_user_limit >= 0),
  used_count integer not null default 0 check (used_count >= 0),
  is_active boolean not null default true,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint coupons_valid_date_range check (start_at is null or end_at is null or end_at >= start_at)
);

create table if not exists public.coupon_tours (
  id uuid primary key default gen_random_uuid(),
  coupon_id uuid not null references public.coupons(id) on delete cascade,
  tour_id uuid not null references public.tours(id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint coupon_tours_coupon_tour_key unique (coupon_id, tour_id)
);

create table if not exists public.coupon_categories (
  id uuid primary key default gen_random_uuid(),
  coupon_id uuid not null references public.coupons(id) on delete cascade,
  category_id uuid not null references public.categories(id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint coupon_categories_coupon_category_key unique (coupon_id, category_id)
);

create table if not exists public.payment_methods (
  id uuid primary key default gen_random_uuid(),
  code text not null,
  name text not null,
  method_type public.payment_method_type not null,
  provider_name text,
  description text,
  is_active boolean not null default true,
  settings_jsonb jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.bookings (
  id uuid primary key default gen_random_uuid(),
  booking_code text not null default public.generate_booking_code(),
  user_id uuid references public.profiles(id) on delete set null,
  tour_id uuid not null references public.tours(id) on delete restrict,
  schedule_id uuid not null,
  contact_name text not null,
  contact_phone text not null,
  contact_email text not null,
  adult_count integer not null default 0 check (adult_count >= 0),
  child_count integer not null default 0 check (child_count >= 0),
  infant_count integer not null default 0 check (infant_count >= 0),
  subtotal_amount numeric(14, 2) not null check (subtotal_amount >= 0),
  discount_amount numeric(14, 2) not null default 0 check (discount_amount >= 0),
  tax_amount numeric(14, 2) not null default 0 check (tax_amount >= 0),
  service_fee_amount numeric(14, 2) not null default 0 check (service_fee_amount >= 0),
  total_amount numeric(14, 2) not null check (total_amount >= 0),
  currency text not null default 'VND',
  booking_status public.booking_status not null default 'pending',
  payment_status public.payment_status not null default 'unpaid',
  expires_at timestamptz,
  confirmed_at timestamptz,
  completed_at timestamptz,
  cancelled_at timestamptz,
  cancel_reason text,
  customer_note text,
  snapshot_jsonb jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint bookings_has_at_least_one_traveler check ((adult_count + child_count + infant_count) > 0),
  constraint bookings_schedule_tour_fk
    foreign key (schedule_id, tour_id)
    references public.departure_schedules(id, tour_id)
    on delete restrict
);

create table if not exists public.booking_travelers (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings(id) on delete cascade,
  saved_traveler_id uuid references public.saved_travelers(id) on delete set null,
  full_name text not null,
  phone text,
  email text,
  date_of_birth date,
  gender public.gender_type,
  id_number text,
  passport_number text,
  nationality text,
  traveler_type public.traveler_type not null,
  price_amount numeric(14, 2) check (price_amount is null or price_amount >= 0),
  special_request text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.booking_price_lines (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings(id) on delete cascade,
  line_type public.booking_price_line_type not null,
  label text not null,
  quantity integer not null default 1 check (quantity > 0),
  unit_amount numeric(14, 2) not null check (unit_amount >= 0),
  total_amount numeric(14, 2) not null,
  metadata_jsonb jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.coupon_usages (
  id uuid primary key default gen_random_uuid(),
  coupon_id uuid not null references public.coupons(id) on delete restrict,
  booking_id uuid not null references public.bookings(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete set null,
  discount_amount numeric(14, 2) not null check (discount_amount >= 0),
  created_at timestamptz not null default now(),
  constraint coupon_usages_booking_key unique (booking_id)
);

create table if not exists public.booking_events (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings(id) on delete cascade,
  actor_id uuid references public.profiles(id) on delete set null,
  event_type text not null,
  note text,
  event_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.booking_notes (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings(id) on delete cascade,
  author_id uuid references public.profiles(id) on delete set null,
  note text not null,
  is_private boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings(id) on delete cascade,
  payment_method_id uuid references public.payment_methods(id) on delete set null,
  provider_name text,
  provider_order_id text,
  provider_payment_id text,
  transaction_code text,
  amount numeric(14, 2) not null check (amount >= 0),
  currency text not null default 'VND',
  status public.payment_transaction_status not null default 'pending',
  requested_at timestamptz not null default now(),
  paid_at timestamptz,
  failed_at timestamptz,
  failure_reason text,
  raw_response jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.payment_events (
  id uuid primary key default gen_random_uuid(),
  payment_id uuid not null references public.payments(id) on delete cascade,
  event_name text not null,
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'received',
  received_at timestamptz not null default now(),
  processed_at timestamptz
);

create table if not exists public.refunds (
  id uuid primary key default gen_random_uuid(),
  payment_id uuid not null references public.payments(id) on delete cascade,
  amount numeric(14, 2) not null check (amount > 0),
  reason text,
  status public.refund_status not null default 'pending',
  requested_by uuid references public.profiles(id) on delete set null,
  approved_by uuid references public.profiles(id) on delete set null,
  refunded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.invoices (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings(id) on delete cascade,
  invoice_number text not null default public.generate_invoice_number(),
  company_name text,
  tax_code text,
  billing_email text,
  billing_address text,
  issued_at timestamptz,
  status text not null default 'issued',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint invoices_booking_key unique (booking_id)
);

create table if not exists public.wishlist (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  tour_id uuid not null references public.tours(id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint wishlist_user_tour_key unique (user_id, tour_id)
);

create table if not exists public.reviews (
  id uuid primary key default gen_random_uuid(),
  tour_id uuid not null references public.tours(id) on delete restrict,
  booking_id uuid not null references public.bookings(id) on delete restrict,
  user_id uuid references public.profiles(id) on delete set null,
  rating smallint not null check (rating between 1 and 5),
  comment text,
  status public.review_status not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint reviews_booking_key unique (booking_id)
);

create table if not exists public.review_replies (
  id uuid primary key default gen_random_uuid(),
  review_id uuid not null references public.reviews(id) on delete cascade,
  replied_by uuid references public.profiles(id) on delete set null,
  reply_text text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint review_replies_review_key unique (review_id)
);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  content text not null,
  notification_type text not null,
  reference_type text,
  reference_id uuid,
  is_read boolean not null default false,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.support_tickets (
  id uuid primary key default gen_random_uuid(),
  ticket_code text not null default public.generate_ticket_code(),
  user_id uuid references public.profiles(id) on delete set null,
  booking_id uuid references public.bookings(id) on delete set null,
  subject text not null,
  status public.ticket_status not null default 'open',
  priority text not null default 'normal',
  assigned_to uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  closed_at timestamptz
);

create table if not exists public.support_ticket_messages (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.support_tickets(id) on delete cascade,
  sender_id uuid references public.profiles(id) on delete set null,
  sender_type public.ticket_sender_type not null,
  message text not null,
  attachments_jsonb jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.activity_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.profiles(id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  old_data jsonb,
  new_data jsonb,
  ip_address inet,
  created_at timestamptz not null default now()
);

create table if not exists public.banners (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  image_url text not null,
  link_url text,
  placement text not null default 'home',
  sort_order integer not null default 0,
  is_active boolean not null default true,
  start_at timestamptz,
  end_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint banners_valid_date_range check (start_at is null or end_at is null or end_at >= start_at)
);

create table if not exists public.cms_pages (
  id uuid primary key default gen_random_uuid(),
  slug text not null,
  title text not null,
  content text,
  meta_title text,
  meta_description text,
  is_published boolean not null default false,
  published_at timestamptz,
  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.system_settings (
  id uuid primary key default gen_random_uuid(),
  setting_key text not null,
  setting_value jsonb not null default '{}'::jsonb,
  description text,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists roles_name_unique_idx on public.roles (lower(name));
create unique index if not exists permissions_code_unique_idx on public.permissions (lower(code));
create unique index if not exists profiles_email_unique_idx on public.profiles (lower(email)) where email is not null;
create index if not exists profiles_status_idx on public.profiles (status);

create index if not exists user_roles_user_idx on public.user_roles (user_id);
create index if not exists user_roles_role_idx on public.user_roles (role_id);

create index if not exists saved_travelers_user_idx on public.saved_travelers (user_id);
create index if not exists user_addresses_user_idx on public.user_addresses (user_id);

create unique index if not exists locations_slug_unique_idx on public.locations (lower(slug));
create index if not exists locations_parent_idx on public.locations (parent_id);
create index if not exists locations_type_idx on public.locations (location_type);

create unique index if not exists categories_slug_unique_idx on public.categories (lower(slug));
create unique index if not exists tags_slug_unique_idx on public.tags (lower(slug));

create unique index if not exists tours_slug_unique_idx on public.tours (lower(slug));
create index if not exists tours_status_idx on public.tours (status);
create index if not exists tours_departure_location_idx on public.tours (departure_location_id);

create index if not exists tour_destinations_tour_idx on public.tour_destinations (tour_id, sort_order);
create index if not exists tour_destinations_location_idx on public.tour_destinations (location_id);
create index if not exists tour_categories_category_idx on public.tour_categories (category_id);
create index if not exists tour_tags_tag_idx on public.tour_tags (tag_id);
create index if not exists tour_images_tour_sort_idx on public.tour_images (tour_id, sort_order);
create unique index if not exists tour_images_cover_unique_idx on public.tour_images (tour_id) where is_cover = true;
create index if not exists itinerary_tour_day_idx on public.tour_itinerary_days (tour_id, day_number);

create index if not exists schedules_tour_departure_idx on public.departure_schedules (tour_id, departure_date);
create index if not exists schedules_status_idx on public.departure_schedules (status);
create index if not exists schedule_price_tiers_schedule_idx on public.schedule_price_tiers (schedule_id);

create unique index if not exists coupons_code_unique_idx on public.coupons (lower(code));
create index if not exists coupons_active_time_idx on public.coupons (is_active, start_at, end_at);

create unique index if not exists payment_methods_code_unique_idx on public.payment_methods (lower(code));

create unique index if not exists bookings_code_unique_idx on public.bookings (lower(booking_code));
create index if not exists bookings_user_created_idx on public.bookings (user_id, created_at desc);
create index if not exists bookings_status_idx on public.bookings (booking_status);
create index if not exists bookings_payment_status_idx on public.bookings (payment_status);
create index if not exists bookings_tour_idx on public.bookings (tour_id);
create index if not exists bookings_schedule_idx on public.bookings (schedule_id);

create index if not exists booking_travelers_booking_idx on public.booking_travelers (booking_id);
create index if not exists booking_price_lines_booking_idx on public.booking_price_lines (booking_id);
create index if not exists coupon_usages_coupon_idx on public.coupon_usages (coupon_id);
create index if not exists coupon_usages_user_idx on public.coupon_usages (user_id);
create index if not exists booking_events_booking_created_idx on public.booking_events (booking_id, created_at desc);
create index if not exists booking_notes_booking_created_idx on public.booking_notes (booking_id, created_at desc);

create index if not exists payments_booking_idx on public.payments (booking_id);
create index if not exists payments_status_idx on public.payments (status);
create unique index if not exists payments_provider_order_unique_idx on public.payments (provider_order_id) where provider_order_id is not null;
create unique index if not exists payments_provider_payment_unique_idx on public.payments (provider_payment_id) where provider_payment_id is not null;
create unique index if not exists payments_transaction_code_unique_idx on public.payments (transaction_code) where transaction_code is not null;
create index if not exists payment_events_payment_received_idx on public.payment_events (payment_id, received_at desc);
create index if not exists refunds_payment_status_idx on public.refunds (payment_id, status);
create unique index if not exists invoices_number_unique_idx on public.invoices (lower(invoice_number));

create index if not exists wishlist_user_idx on public.wishlist (user_id);
create index if not exists wishlist_tour_idx on public.wishlist (tour_id);
create index if not exists reviews_tour_status_created_idx on public.reviews (tour_id, status, created_at desc);
create index if not exists reviews_user_idx on public.reviews (user_id);

create index if not exists notifications_user_read_created_idx on public.notifications (user_id, is_read, created_at desc);
create unique index if not exists support_tickets_code_unique_idx on public.support_tickets (lower(ticket_code));
create index if not exists support_tickets_user_status_idx on public.support_tickets (user_id, status, created_at desc);
create index if not exists support_tickets_assigned_idx on public.support_tickets (assigned_to);
create index if not exists support_ticket_messages_ticket_created_idx on public.support_ticket_messages (ticket_id, created_at);

create index if not exists activity_logs_actor_created_idx on public.activity_logs (actor_id, created_at desc);
create index if not exists activity_logs_entity_idx on public.activity_logs (entity_type, entity_id);
create index if not exists banners_placement_active_sort_idx on public.banners (placement, is_active, sort_order);
create unique index if not exists cms_pages_slug_unique_idx on public.cms_pages (lower(slug));
create unique index if not exists system_settings_key_unique_idx on public.system_settings (lower(setting_key));

create or replace function public.assign_default_customer_role()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  customer_role_id uuid;
begin
  select id into customer_role_id
  from public.roles
  where lower(name) = 'customer'
  limit 1;

  if customer_role_id is not null then
    insert into public.user_roles (user_id, role_id)
    values (new.id, customer_role_id)
    on conflict (user_id, role_id) do nothing;
  end if;

  return new;
end;
$$;

create or replace function public.handle_auth_user_created()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (
    id,
    email,
    full_name,
    avatar_url
  )
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'),
    new.raw_user_meta_data ->> 'avatar_url'
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

create or replace function public.handle_auth_user_updated()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.profiles
  set
    email = new.email,
    full_name = coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name', full_name),
    avatar_url = coalesce(new.raw_user_meta_data ->> 'avatar_url', avatar_url),
    updated_at = now()
  where id = new.id;

  return new;
end;
$$;

drop trigger if exists set_updated_at_roles on public.roles;
create trigger set_updated_at_roles
before update on public.roles
for each row execute function public.set_updated_at();

drop trigger if exists set_updated_at_permissions on public.permissions;
create trigger set_updated_at_permissions
before update on public.permissions
for each row execute function public.set_updated_at();

drop trigger if exists set_updated_at_profiles on public.profiles;
create trigger set_updated_at_profiles
before update on public.profiles
for each row execute function public.set_updated_at();

drop trigger if exists set_updated_at_saved_travelers on public.saved_travelers;
create trigger set_updated_at_saved_travelers
before update on public.saved_travelers
for each row execute function public.set_updated_at();

drop trigger if exists set_updated_at_user_addresses on public.user_addresses;
create trigger set_updated_at_user_addresses
before update on public.user_addresses
for each row execute function public.set_updated_at();

drop trigger if exists set_updated_at_locations on public.locations;
create trigger set_updated_at_locations
before update on public.locations
for each row execute function public.set_updated_at();

drop trigger if exists set_updated_at_categories on public.categories;
create trigger set_updated_at_categories
before update on public.categories
for each row execute function public.set_updated_at();

drop trigger if exists set_updated_at_tags on public.tags;
create trigger set_updated_at_tags
before update on public.tags
for each row execute function public.set_updated_at();

drop trigger if exists set_updated_at_cancellation_policies on public.cancellation_policies;
create trigger set_updated_at_cancellation_policies
before update on public.cancellation_policies
for each row execute function public.set_updated_at();

drop trigger if exists set_updated_at_tours on public.tours;
create trigger set_updated_at_tours
before update on public.tours
for each row execute function public.set_updated_at();

drop trigger if exists set_updated_at_tour_images on public.tour_images;
create trigger set_updated_at_tour_images
before update on public.tour_images
for each row execute function public.set_updated_at();

drop trigger if exists set_updated_at_tour_itinerary_days on public.tour_itinerary_days;
create trigger set_updated_at_tour_itinerary_days
before update on public.tour_itinerary_days
for each row execute function public.set_updated_at();

drop trigger if exists set_updated_at_departure_schedules on public.departure_schedules;
create trigger set_updated_at_departure_schedules
before update on public.departure_schedules
for each row execute function public.set_updated_at();

drop trigger if exists set_updated_at_schedule_price_tiers on public.schedule_price_tiers;
create trigger set_updated_at_schedule_price_tiers
before update on public.schedule_price_tiers
for each row execute function public.set_updated_at();

drop trigger if exists set_updated_at_coupons on public.coupons;
create trigger set_updated_at_coupons
before update on public.coupons
for each row execute function public.set_updated_at();

drop trigger if exists set_updated_at_payment_methods on public.payment_methods;
create trigger set_updated_at_payment_methods
before update on public.payment_methods
for each row execute function public.set_updated_at();

drop trigger if exists set_updated_at_bookings on public.bookings;
create trigger set_updated_at_bookings
before update on public.bookings
for each row execute function public.set_updated_at();

drop trigger if exists set_updated_at_booking_travelers on public.booking_travelers;
create trigger set_updated_at_booking_travelers
before update on public.booking_travelers
for each row execute function public.set_updated_at();

drop trigger if exists set_updated_at_booking_notes on public.booking_notes;
create trigger set_updated_at_booking_notes
before update on public.booking_notes
for each row execute function public.set_updated_at();

drop trigger if exists set_updated_at_payments on public.payments;
create trigger set_updated_at_payments
before update on public.payments
for each row execute function public.set_updated_at();

drop trigger if exists set_updated_at_refunds on public.refunds;
create trigger set_updated_at_refunds
before update on public.refunds
for each row execute function public.set_updated_at();

drop trigger if exists set_updated_at_invoices on public.invoices;
create trigger set_updated_at_invoices
before update on public.invoices
for each row execute function public.set_updated_at();

drop trigger if exists set_updated_at_reviews on public.reviews;
create trigger set_updated_at_reviews
before update on public.reviews
for each row execute function public.set_updated_at();

drop trigger if exists set_updated_at_review_replies on public.review_replies;
create trigger set_updated_at_review_replies
before update on public.review_replies
for each row execute function public.set_updated_at();

drop trigger if exists set_updated_at_support_tickets on public.support_tickets;
create trigger set_updated_at_support_tickets
before update on public.support_tickets
for each row execute function public.set_updated_at();

drop trigger if exists set_updated_at_banners on public.banners;
create trigger set_updated_at_banners
before update on public.banners
for each row execute function public.set_updated_at();

drop trigger if exists set_updated_at_cms_pages on public.cms_pages;
create trigger set_updated_at_cms_pages
before update on public.cms_pages
for each row execute function public.set_updated_at();

drop trigger if exists set_updated_at_system_settings on public.system_settings;
create trigger set_updated_at_system_settings
before update on public.system_settings
for each row execute function public.set_updated_at();

drop trigger if exists assign_default_customer_role_on_profile on public.profiles;
create trigger assign_default_customer_role_on_profile
after insert on public.profiles
for each row execute function public.assign_default_customer_role();

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_auth_user_created();

drop trigger if exists on_auth_user_updated on auth.users;
create trigger on_auth_user_updated
after update on auth.users
for each row execute function public.handle_auth_user_updated();

insert into public.roles (name, description)
values
  ('customer', 'Default authenticated customer'),
  ('staff', 'Operations staff'),
  ('admin', 'Administrator'),
  ('super_admin', 'Highest privilege administrator')
on conflict do nothing;

insert into public.permissions (code, description)
values
  ('tour.read', 'View tours'),
  ('tour.write', 'Create and update tours'),
  ('schedule.read', 'View schedules'),
  ('schedule.write', 'Create and update schedules'),
  ('booking.read_own', 'Read own bookings'),
  ('booking.write_own', 'Create and manage own bookings'),
  ('booking.read_all', 'Read all bookings'),
  ('booking.manage', 'Confirm, cancel, and update bookings'),
  ('payment.read_own', 'Read own payments'),
  ('payment.read_all', 'Read all payments'),
  ('payment.manage', 'Manage payments and refunds'),
  ('review.write_own', 'Write own reviews'),
  ('review.moderate', 'Moderate reviews'),
  ('user.read_all', 'Read customers and staff'),
  ('user.manage', 'Manage users and roles'),
  ('coupon.manage', 'Manage coupons'),
  ('banner.manage', 'Manage banners and CMS'),
  ('report.read', 'Read reports'),
  ('settings.manage', 'Manage system settings'),
  ('ticket.read_own', 'Read own support tickets'),
  ('ticket.manage', 'Manage support tickets')
on conflict do nothing;

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
join public.permissions p on p.code in (
  'tour.read',
  'booking.read_own',
  'booking.write_own',
  'payment.read_own',
  'review.write_own',
  'ticket.read_own'
)
where lower(r.name) = 'customer'
on conflict do nothing;

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
join public.permissions p on p.code in (
  'tour.read',
  'tour.write',
  'schedule.read',
  'schedule.write',
  'booking.read_all',
  'booking.manage',
  'payment.read_all',
  'payment.manage',
  'review.moderate',
  'user.read_all',
  'coupon.manage',
  'report.read',
  'ticket.manage'
)
where lower(r.name) = 'staff'
on conflict do nothing;

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
join public.permissions p on true
where lower(r.name) in ('admin', 'super_admin')
on conflict do nothing;

insert into public.payment_methods (code, name, method_type, provider_name, description)
values
  ('cash', 'Cash', 'cash', null, 'Pay in cash'),
  ('bank_transfer', 'Bank Transfer', 'bank_transfer', null, 'Manual bank transfer'),
  ('manual', 'Manual Confirmation', 'manual', null, 'Confirmed manually by staff')
on conflict do nothing;

insert into public.profiles (id, email, full_name, avatar_url)
select
  u.id,
  u.email,
  coalesce(u.raw_user_meta_data ->> 'full_name', u.raw_user_meta_data ->> 'name'),
  u.raw_user_meta_data ->> 'avatar_url'
from auth.users u
where not exists (
  select 1
  from public.profiles p
  where p.id = u.id
);

insert into public.user_roles (user_id, role_id)
select
  p.id,
  r.id
from public.profiles p
cross join lateral (
  select id
  from public.roles
  where lower(name) = 'customer'
  limit 1
) r
where not exists (
  select 1
  from public.user_roles ur
  where ur.user_id = p.id
    and ur.role_id = r.id
);

create or replace view public.schedule_availability as
select
  ds.id as schedule_id,
  ds.tour_id,
  ds.departure_date,
  ds.return_date,
  ds.capacity,
  coalesce(
    sum(
      case
        when b.booking_status in ('awaiting_payment', 'confirmed', 'completed', 'cancel_requested')
          then (b.adult_count + b.child_count + b.infant_count)
        when b.booking_status = 'pending'
          and (b.expires_at is null or b.expires_at > now())
          then (b.adult_count + b.child_count + b.infant_count)
        else 0
      end
    ),
    0
  ) as reserved_slots,
  greatest(
    ds.capacity - coalesce(
      sum(
        case
          when b.booking_status in ('awaiting_payment', 'confirmed', 'completed', 'cancel_requested')
            then (b.adult_count + b.child_count + b.infant_count)
          when b.booking_status = 'pending'
            and (b.expires_at is null or b.expires_at > now())
            then (b.adult_count + b.child_count + b.infant_count)
          else 0
        end
      ),
      0
    ),
    0
  ) as available_slots
from public.departure_schedules ds
left join public.bookings b on b.schedule_id = ds.id
group by ds.id, ds.tour_id, ds.departure_date, ds.return_date, ds.capacity;

