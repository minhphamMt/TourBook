-- Demo seed data for TourBook
-- Recommended: run after supabase/schema.sql on a dev database.
-- Demo password for all seeded auth users: Demo@123456

begin;

create or replace function public.seed_demo_user(
  p_user_id uuid,
  p_email text,
  p_password text,
  p_full_name text,
  p_avatar_url text default null
)
returns uuid
language plpgsql
security definer
set search_path = public, auth, extensions
as $$
declare
  encrypted_pw text;
begin
  encrypted_pw := extensions.crypt(p_password, extensions.gen_salt('bf')); 

  insert into auth.users (
    instance_id,
    id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    last_sign_in_at,
    raw_app_meta_data,
    raw_user_meta_data,
    created_at,
    updated_at,
    confirmation_token,
    email_change,
    email_change_token_new,
    recovery_token
  )
  values (
    '00000000-0000-0000-0000-000000000000',
    p_user_id,
    'authenticated',
    'authenticated',
    p_email,
    encrypted_pw,
    now(),
    now(),
    jsonb_build_object('provider', 'email', 'providers', jsonb_build_array('email')),
    jsonb_build_object('full_name', p_full_name, 'avatar_url', p_avatar_url),
    now(),
    now(),
    '',
    '',
    '',
    ''
  )
  on conflict (id) do update
  set
    email = excluded.email,
    encrypted_password = excluded.encrypted_password,
    email_confirmed_at = excluded.email_confirmed_at,
    last_sign_in_at = excluded.last_sign_in_at,
    raw_app_meta_data = excluded.raw_app_meta_data,
    raw_user_meta_data = excluded.raw_user_meta_data,
    updated_at = now();

  insert into auth.identities (
    provider_id,
    user_id,
    identity_data,
    provider,
    last_sign_in_at,
    created_at,
    updated_at
  )
  values (
    p_email,
    p_user_id,
    jsonb_build_object('sub', p_user_id::text, 'email', p_email, 'email_verified', true),
    'email',
    now(),
    now(),
    now()
  )
  on conflict do nothing;

  return p_user_id;
end;
$$;

select public.seed_demo_user(
  '00000000-0000-0000-0000-000000000101',
  'anna.nguyen@tourbook.demo',
  'Demo@123456',
  'Anna Nguyen',
  'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=400&q=80'
);

select public.seed_demo_user(
  '00000000-0000-0000-0000-000000000102',
  'minh.tran@tourbook.demo',
  'Demo@123456',
  'Minh Tran',
  'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=400&q=80'
);

select public.seed_demo_user(
  '00000000-0000-0000-0000-000000000103',
  'linh.pham@tourbook.demo',
  'Demo@123456',
  'Linh Pham',
  'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=400&q=80'
);

select public.seed_demo_user(
  '00000000-0000-0000-0000-000000000104',
  'quan.le@tourbook.demo',
  'Demo@123456',
  'Quan Le',
  'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=400&q=80'
);

select public.seed_demo_user(
  '00000000-0000-0000-0000-000000000201',
  'thao.staff@tourbook.demo',
  'Demo@123456',
  'Thao Nguyen',
  'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?auto=format&fit=crop&w=400&q=80'
);

select public.seed_demo_user(
  '00000000-0000-0000-0000-000000000301',
  'huy.admin@tourbook.demo',
  'Demo@123456',
  'Huy Vo',
  'https://images.unsplash.com/photo-1502685104226-ee32379fefbe?auto=format&fit=crop&w=400&q=80'
);

update public.profiles
set
  phone = case id
    when '00000000-0000-0000-0000-000000000101' then '0901000001'
    when '00000000-0000-0000-0000-000000000102' then '0901000002'
    when '00000000-0000-0000-0000-000000000103' then '0901000003'
    when '00000000-0000-0000-0000-000000000104' then '0901000004'
    when '00000000-0000-0000-0000-000000000201' then '0901000201'
    when '00000000-0000-0000-0000-000000000301' then '0901000301'
    else phone
  end,
  address = case id
    when '00000000-0000-0000-0000-000000000101' then 'Thanh Xuan, Ha Noi'
    when '00000000-0000-0000-0000-000000000102' then 'Binh Thanh, Ho Chi Minh City'
    when '00000000-0000-0000-0000-000000000103' then 'Hai Chau, Da Nang'
    when '00000000-0000-0000-0000-000000000104' then 'Thu Duc, Ho Chi Minh City'
    when '00000000-0000-0000-0000-000000000201' then 'Nam Tu Liem, Ha Noi'
    when '00000000-0000-0000-0000-000000000301' then 'District 1, Ho Chi Minh City'
    else address
  end,
  customer_level = case id
    when '00000000-0000-0000-0000-000000000101' then 'vip'
    when '00000000-0000-0000-0000-000000000102' then 'regular'
    when '00000000-0000-0000-0000-000000000103' then 'gold'
    when '00000000-0000-0000-0000-000000000104' then 'regular'
    else customer_level
  end,
  status = 'active',
  updated_at = now()
where id in (
  '00000000-0000-0000-0000-000000000101',
  '00000000-0000-0000-0000-000000000102',
  '00000000-0000-0000-0000-000000000103',
  '00000000-0000-0000-0000-000000000104',
  '00000000-0000-0000-0000-000000000201',
  '00000000-0000-0000-0000-000000000301'
);

insert into public.user_roles (user_id, role_id)
select '00000000-0000-0000-0000-000000000201', id
from public.roles
where lower(name) = 'staff'
on conflict do nothing;

insert into public.user_roles (user_id, role_id)
select '00000000-0000-0000-0000-000000000301', id
from public.roles
where lower(name) in ('admin', 'super_admin')
on conflict do nothing;

insert into public.payment_methods (code, name, method_type, provider_name, description, settings_jsonb)
values
  ('vnpay', 'VNPay', 'gateway', 'VNPay', 'VNPay gateway for demo UI', '{"color":"blue"}'::jsonb),
  ('momo', 'MoMo', 'gateway', 'MoMo', 'MoMo wallet payment for demo UI', '{"color":"pink"}'::jsonb)
on conflict do nothing;

insert into public.locations (id, parent_id, name, slug, location_type, description, image_url, is_active, sort_order)
values
  ('00000000-0000-0000-0000-000000001001', null, 'Vietnam', 'vietnam', 'country', 'All Vietnam destinations', null, true, 1),
  ('00000000-0000-0000-0000-000000001101', '00000000-0000-0000-0000-000000001001', 'Ha Noi', 'ha-noi', 'city', 'Capital city', null, true, 1),
  ('00000000-0000-0000-0000-000000001102', '00000000-0000-0000-0000-000000001001', 'Ha Long', 'ha-long', 'city', 'World heritage bay city', null, true, 2),
  ('00000000-0000-0000-0000-000000001103', '00000000-0000-0000-0000-000000001001', 'Da Nang', 'da-nang', 'city', 'Central beach city', null, true, 3),
  ('00000000-0000-0000-0000-000000001104', '00000000-0000-0000-0000-000000001001', 'Hoi An', 'hoi-an', 'city', 'Ancient town', null, true, 4),
  ('00000000-0000-0000-0000-000000001105', '00000000-0000-0000-0000-000000001001', 'Sa Pa', 'sa-pa', 'city', 'Mountain destination', null, true, 5),
  ('00000000-0000-0000-0000-000000001106', '00000000-0000-0000-0000-000000001001', 'Phu Quoc', 'phu-quoc', 'city', 'Island getaway', null, true, 6),
  ('00000000-0000-0000-0000-000000001107', '00000000-0000-0000-0000-000000001001', 'Nha Trang', 'nha-trang', 'city', 'Beach city', null, true, 7),
  ('00000000-0000-0000-0000-000000001108', '00000000-0000-0000-0000-000000001001', 'Hue', 'hue', 'city', 'Imperial city', null, true, 8),
  ('00000000-0000-0000-0000-000000001109', '00000000-0000-0000-0000-000000001001', 'Ho Chi Minh City', 'ho-chi-minh-city', 'city', 'Southern hub', null, true, 9),
  ('00000000-0000-0000-0000-000000001110', '00000000-0000-0000-0000-000000001001', 'Ninh Binh', 'ninh-binh', 'city', 'Northern eco destination', null, true, 10)
on conflict do nothing;

insert into public.categories (id, name, slug, description, is_active)
values
  ('00000000-0000-0000-0000-000000002001', 'Beach Escape', 'beach-escape', 'Beach and island tours', true),
  ('00000000-0000-0000-0000-000000002002', 'Mountain Adventure', 'mountain-adventure', 'Mountain and trekking tours', true),
  ('00000000-0000-0000-0000-000000002003', 'Culture and Heritage', 'culture-and-heritage', 'Culture discovery tours', true),
  ('00000000-0000-0000-0000-000000002004', 'Family Friendly', 'family-friendly', 'Easy tours for family groups', true),
  ('00000000-0000-0000-0000-000000002005', 'Luxury Getaway', 'luxury-getaway', 'Premium resort tours', true),
  ('00000000-0000-0000-0000-000000002006', 'Weekend Trip', 'weekend-trip', 'Short duration tours', true)
on conflict do nothing;

insert into public.tags (id, name, slug)
values
  ('00000000-0000-0000-0000-000000003001', 'Best Seller', 'best-seller'),
  ('00000000-0000-0000-0000-000000003002', 'All Inclusive', 'all-inclusive'),
  ('00000000-0000-0000-0000-000000003003', 'Family Friendly', 'family-friendly'),
  ('00000000-0000-0000-0000-000000003004', 'Honeymoon', 'honeymoon'),
  ('00000000-0000-0000-0000-000000003005', 'Adventure', 'adventure'),
  ('00000000-0000-0000-0000-000000003006', 'Cultural', 'cultural')
on conflict do nothing;

insert into public.cancellation_policies (id, name, description, rules_jsonb, is_active)
values
  (
    '00000000-0000-0000-0000-000000004001',
    'Flexible 7 days',
    'Free cancellation before 7 days, partial charge after that.',
    '[{"days_before":7,"refund_percent":100},{"days_before":3,"refund_percent":50},{"days_before":0,"refund_percent":0}]'::jsonb,
    true
  ),
  (
    '00000000-0000-0000-0000-000000004002',
    'Standard 14 days',
    'Higher penalty close to departure date.',
    '[{"days_before":14,"refund_percent":100},{"days_before":7,"refund_percent":70},{"days_before":3,"refund_percent":30},{"days_before":0,"refund_percent":0}]'::jsonb,
    true
  )
on conflict do nothing;

insert into public.tours (
  id,
  slug,
  name,
  short_description,
  description,
  departure_location_id,
  duration_days,
  duration_nights,
  base_currency,
  is_featured,
  included_text,
  excluded_text,
  terms_text,
  important_notes,
  cancellation_policy_id,
  status,
  created_by,
  updated_by,
  published_at
)
values
  (
    '00000000-0000-0000-0000-000000005001',
    'ha-long-bay-cruise-3n2d',
    'Ha Long Bay Cruise 3N2D',
    'Classic bay cruise with seafood dinner and cave visit.',
    'A balanced itinerary for first-time visitors to Ha Long Bay with a night on cruise, kayaking, seafood meals, and island sightseeing.',
    '00000000-0000-0000-0000-000000001101',
    3,
    2,
    'VND',
    true,
    'Hotel pickup, cruise cabin, 5 meals, entrance tickets, guide.',
    'Personal expenses, drinks, VAT invoice request fee.',
    'Check-in with valid ID. Child pricing applies by age rule.',
    'Suitable for couples, small families, and weekend trips.',
    '00000000-0000-0000-0000-000000004001',
    'published',
    '00000000-0000-0000-0000-000000000301',
    '00000000-0000-0000-0000-000000000301',
    now() - interval '30 days'
  ),
  (
    '00000000-0000-0000-0000-000000005002',
    'da-nang-hoi-an-ba-na-4n3d',
    'Da Nang - Hoi An - Ba Na 4N3D',
    'Family-friendly Central Vietnam highlight tour.',
    'Explore the best of Central Vietnam with beaches, Ba Na Hills, Hoi An Ancient Town, and local cuisine in one comfortable itinerary.',
    '00000000-0000-0000-0000-000000001109',
    4,
    3,
    'VND',
    true,
    'Flights not included, hotel, breakfast, transfers, guide, cable car tickets.',
    'Lunch and dinner outside itinerary, personal shopping.',
    'Guests should arrive before 11:00 AM on departure day.',
    'One of the best conversion tours for homepage hero and listing UI.',
    '00000000-0000-0000-0000-000000004002',
    'published',
    '00000000-0000-0000-0000-000000000301',
    '00000000-0000-0000-0000-000000000201',
    now() - interval '25 days'
  ),
  (
    '00000000-0000-0000-0000-000000005003',
    'sa-pa-fansipan-3n2d',
    'Sa Pa - Fansipan 3N2D',
    'Cool weather, mountain views, and local villages.',
    'A scenic northern escape featuring Sa Pa town, Cat Cat village, Fansipan cable car, and local market moments.',
    '00000000-0000-0000-0000-000000001101',
    3,
    2,
    'VND',
    false,
    'Round-trip sleeper bus, hotel, breakfast, guide, Fansipan combo.',
    'Single room supplement, local motorbike service.',
    'Weather may affect cable car operations.',
    'Great for adventure and mountain lovers.',
    '00000000-0000-0000-0000-000000004001',
    'published',
    '00000000-0000-0000-0000-000000000301',
    '00000000-0000-0000-0000-000000000201',
    now() - interval '20 days'
  ),
  (
    '00000000-0000-0000-0000-000000005004',
    'phu-quoc-luxury-4n3d',
    'Phu Quoc Luxury Retreat 4N3D',
    'Premium island holiday with resort stay and sunset town.',
    'Relax in a beachfront resort, explore island-hopping highlights, and enjoy curated dining for a high-end leisure trip.',
    '00000000-0000-0000-0000-000000001109',
    4,
    3,
    'VND',
    true,
    'Resort stay, breakfast, airport transfer, speedboat island tour.',
    'Mini bar, spa, optional scuba packages.',
    'Peak season surcharge may apply on holidays.',
    'Strong candidate for luxury card layout in UI.',
    '00000000-0000-0000-0000-000000004002',
    'published',
    '00000000-0000-0000-0000-000000000301',
    '00000000-0000-0000-0000-000000000301',
    now() - interval '18 days'
  ),
  (
    '00000000-0000-0000-0000-000000005005',
    'nha-trang-island-3n2d',
    'Nha Trang Island Explorer 3N2D',
    'Sea, island hopping, and easy resort vibe.',
    'An easy-sell seaside itinerary with snorkeling, island boat routes, and beachside dining for family and group travelers.',
    '00000000-0000-0000-0000-000000001109',
    3,
    2,
    'VND',
    false,
    'Hotel, breakfast, island boat, guide, selected attraction tickets.',
    'Snorkeling gear upgrade, personal drinks, VAT invoice request fee.',
    'Weather conditions can affect marine itinerary.',
    'Good tour for showing review cards and image gallery.',
    '00000000-0000-0000-0000-000000004001',
    'published',
    '00000000-0000-0000-0000-000000000301',
    '00000000-0000-0000-0000-000000000201',
    now() - interval '12 days'
  ),
  (
    '00000000-0000-0000-0000-000000005006',
    'hue-da-nang-heritage-3n2d',
    'Hue - Da Nang Heritage 3N2D',
    'Imperial culture, food, and light coastal scenery.',
    'A compact culture-first journey connecting Hue Imperial City, local cuisine, and Da Nang with balanced pace for short leave travelers.',
    '00000000-0000-0000-0000-000000001109',
    3,
    2,
    'VND',
    false,
    'Hotel, breakfast, guide, transfers, entrance tickets.',
    'Dinner on free evening, personal shopping, tips.',
    'Guests should be comfortable with moderate walking.',
    'Strong use case for cultural and content-rich detail page.',
    '00000000-0000-0000-0000-000000004001',
    'published',
    '00000000-0000-0000-0000-000000000301',
    '00000000-0000-0000-0000-000000000201',
    now() - interval '10 days'
  )
on conflict do nothing;

insert into public.tour_destinations (id, tour_id, location_id, sort_order, is_primary)
values
  ('00000000-0000-0000-0000-000000005101', '00000000-0000-0000-0000-000000005001', '00000000-0000-0000-0000-000000001102', 1, true),
  ('00000000-0000-0000-0000-000000005102', '00000000-0000-0000-0000-000000005002', '00000000-0000-0000-0000-000000001103', 1, true),
  ('00000000-0000-0000-0000-000000005103', '00000000-0000-0000-0000-000000005002', '00000000-0000-0000-0000-000000001104', 2, false),
  ('00000000-0000-0000-0000-000000005104', '00000000-0000-0000-0000-000000005003', '00000000-0000-0000-0000-000000001105', 1, true),
  ('00000000-0000-0000-0000-000000005105', '00000000-0000-0000-0000-000000005004', '00000000-0000-0000-0000-000000001106', 1, true),
  ('00000000-0000-0000-0000-000000005106', '00000000-0000-0000-0000-000000005005', '00000000-0000-0000-0000-000000001107', 1, true),
  ('00000000-0000-0000-0000-000000005107', '00000000-0000-0000-0000-000000005006', '00000000-0000-0000-0000-000000001108', 1, true),
  ('00000000-0000-0000-0000-000000005108', '00000000-0000-0000-0000-000000005006', '00000000-0000-0000-0000-000000001103', 2, false)
on conflict do nothing;

insert into public.tour_categories (id, tour_id, category_id)
values
  ('00000000-0000-0000-0000-000000005201', '00000000-0000-0000-0000-000000005001', '00000000-0000-0000-0000-000000002004'),
  ('00000000-0000-0000-0000-000000005202', '00000000-0000-0000-0000-000000005001', '00000000-0000-0000-0000-000000002006'),
  ('00000000-0000-0000-0000-000000005203', '00000000-0000-0000-0000-000000005002', '00000000-0000-0000-0000-000000002003'),
  ('00000000-0000-0000-0000-000000005204', '00000000-0000-0000-0000-000000005002', '00000000-0000-0000-0000-000000002004'),
  ('00000000-0000-0000-0000-000000005205', '00000000-0000-0000-0000-000000005003', '00000000-0000-0000-0000-000000002002'),
  ('00000000-0000-0000-0000-000000005206', '00000000-0000-0000-0000-000000005004', '00000000-0000-0000-0000-000000002001'),
  ('00000000-0000-0000-0000-000000005207', '00000000-0000-0000-0000-000000005004', '00000000-0000-0000-0000-000000002005'),
  ('00000000-0000-0000-0000-000000005208', '00000000-0000-0000-0000-000000005005', '00000000-0000-0000-0000-000000002001'),
  ('00000000-0000-0000-0000-000000005209', '00000000-0000-0000-0000-000000005005', '00000000-0000-0000-0000-000000002004'),
  ('00000000-0000-0000-0000-000000005210', '00000000-0000-0000-0000-000000005006', '00000000-0000-0000-0000-000000002003'),
  ('00000000-0000-0000-0000-000000005211', '00000000-0000-0000-0000-000000005006', '00000000-0000-0000-0000-000000002006')
on conflict do nothing;

insert into public.tour_tags (id, tour_id, tag_id)
values
  ('00000000-0000-0000-0000-000000005301', '00000000-0000-0000-0000-000000005001', '00000000-0000-0000-0000-000000003001'),
  ('00000000-0000-0000-0000-000000005302', '00000000-0000-0000-0000-000000005001', '00000000-0000-0000-0000-000000003003'),
  ('00000000-0000-0000-0000-000000005303', '00000000-0000-0000-0000-000000005002', '00000000-0000-0000-0000-000000003001'),
  ('00000000-0000-0000-0000-000000005304', '00000000-0000-0000-0000-000000005002', '00000000-0000-0000-0000-000000003006'),
  ('00000000-0000-0000-0000-000000005305', '00000000-0000-0000-0000-000000005003', '00000000-0000-0000-0000-000000003005'),
  ('00000000-0000-0000-0000-000000005306', '00000000-0000-0000-0000-000000005004', '00000000-0000-0000-0000-000000003004'),
  ('00000000-0000-0000-0000-000000005307', '00000000-0000-0000-0000-000000005004', '00000000-0000-0000-0000-000000003002'),
  ('00000000-0000-0000-0000-000000005308', '00000000-0000-0000-0000-000000005005', '00000000-0000-0000-0000-000000003003'),
  ('00000000-0000-0000-0000-000000005309', '00000000-0000-0000-0000-000000005006', '00000000-0000-0000-0000-000000003006')
on conflict do nothing;

insert into public.tour_images (id, tour_id, image_url, alt_text, is_cover, sort_order)
values
  ('00000000-0000-0000-0000-000000005401', '00000000-0000-0000-0000-000000005001', 'https://images.unsplash.com/photo-1500375592092-40eb2168fd21?auto=format&fit=crop&w=1200&q=80', 'Ha Long Bay overview', true, 1),
  ('00000000-0000-0000-0000-000000005402', '00000000-0000-0000-0000-000000005001', 'https://images.unsplash.com/photo-1528127269322-539801943592?auto=format&fit=crop&w=1200&q=80', 'Cruise deck', false, 2),
  ('00000000-0000-0000-0000-000000005403', '00000000-0000-0000-0000-000000005002', 'https://images.unsplash.com/photo-1528127269322-539801943592?auto=format&fit=crop&w=1200&q=80', 'Da Nang bridge', true, 1),
  ('00000000-0000-0000-0000-000000005404', '00000000-0000-0000-0000-000000005002', 'https://images.unsplash.com/photo-1523050854058-8df90110c9f1?auto=format&fit=crop&w=1200&q=80', 'Hoi An lantern street', false, 2),
  ('00000000-0000-0000-0000-000000005405', '00000000-0000-0000-0000-000000005003', 'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1200&q=80', 'Sa Pa terrace', true, 1),
  ('00000000-0000-0000-0000-000000005406', '00000000-0000-0000-0000-000000005003', 'https://images.unsplash.com/photo-1517760444937-f6397edcbbcd?auto=format&fit=crop&w=1200&q=80', 'Fansipan cable car', false, 2),
  ('00000000-0000-0000-0000-000000005407', '00000000-0000-0000-0000-000000005004', 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1200&q=80', 'Phu Quoc beach', true, 1),
  ('00000000-0000-0000-0000-000000005408', '00000000-0000-0000-0000-000000005004', 'https://images.unsplash.com/photo-1506929562872-bb421503ef21?auto=format&fit=crop&w=1200&q=80', 'Resort pool', false, 2),
  ('00000000-0000-0000-0000-000000005409', '00000000-0000-0000-0000-000000005005', 'https://images.unsplash.com/photo-1519046904884-53103b34b206?auto=format&fit=crop&w=1200&q=80', 'Nha Trang bay', true, 1),
  ('00000000-0000-0000-0000-000000005410', '00000000-0000-0000-0000-000000005005', 'https://images.unsplash.com/photo-1500835556837-99ac94a94552?auto=format&fit=crop&w=1200&q=80', 'Island boat route', false, 2),
  ('00000000-0000-0000-0000-000000005411', '00000000-0000-0000-0000-000000005006', 'https://images.unsplash.com/photo-1467269204594-9661b134dd2b?auto=format&fit=crop&w=1200&q=80', 'Hue imperial gate', true, 1),
  ('00000000-0000-0000-0000-000000005412', '00000000-0000-0000-0000-000000005006', 'https://images.unsplash.com/photo-1526481280695-3c4691f8f5ea?auto=format&fit=crop&w=1200&q=80', 'Da Nang city night', false, 2)
on conflict do nothing;

insert into public.tour_itinerary_days (id, tour_id, day_number, title, description, meals, accommodation, transportation)
values
  ('00000000-0000-0000-0000-000000005501', '00000000-0000-0000-0000-000000005001', 1, 'Ha Noi to Ha Long', 'Pickup in Ha Noi, transfer to Ha Long, check in cruise, sunset welcome.', '["lunch","dinner"]'::jsonb, 'Overnight cruise cabin', 'Limousine + cruise'),
  ('00000000-0000-0000-0000-000000005502', '00000000-0000-0000-0000-000000005001', 2, 'Bay exploration', 'Kayaking, cave visit, seafood lunch, free time on deck.', '["breakfast","lunch","dinner"]'::jsonb, 'Overnight cruise cabin', 'Cruise boat'),
  ('00000000-0000-0000-0000-000000005503', '00000000-0000-0000-0000-000000005001', 3, 'Return to Ha Noi', 'Morning brunch on board and transfer back to Ha Noi.', '["breakfast","brunch"]'::jsonb, null, 'Cruise + limousine'),

  ('00000000-0000-0000-0000-000000005504', '00000000-0000-0000-0000-000000005002', 1, 'Arrival in Da Nang', 'Airport meet-up, city highlights, beachfront free time.', '["dinner"]'::jsonb, '4-star hotel', 'Private transfer'),
  ('00000000-0000-0000-0000-000000005505', '00000000-0000-0000-0000-000000005002', 2, 'Ba Na Hills', 'Cable car, Golden Bridge, leisure at Ba Na complex.', '["breakfast"]'::jsonb, '4-star hotel', 'Coach'),
  ('00000000-0000-0000-0000-000000005506', '00000000-0000-0000-0000-000000005002', 3, 'Hoi An old town', 'Ancient town walking tour and lantern evening.', '["breakfast"]'::jsonb, '4-star hotel', 'Coach'),
  ('00000000-0000-0000-0000-000000005507', '00000000-0000-0000-0000-000000005002', 4, 'Departure day', 'Shopping stop and airport drop-off.', '["breakfast"]'::jsonb, null, 'Private transfer'),

  ('00000000-0000-0000-0000-000000005508', '00000000-0000-0000-0000-000000005003', 1, 'Overnight bus to Sa Pa', 'Depart from Ha Noi, early arrival in Sa Pa, check-in and free walk.', '["lunch"]'::jsonb, 'Mountain hotel', 'Sleeper bus'),
  ('00000000-0000-0000-0000-000000005509', '00000000-0000-0000-0000-000000005003', 2, 'Fansipan day', 'Cable car to Fansipan and village visit.', '["breakfast"]'::jsonb, 'Mountain hotel', 'Cable car + van'),
  ('00000000-0000-0000-0000-000000005510', '00000000-0000-0000-0000-000000005003', 3, 'Market and return', 'Local market stop then bus back to Ha Noi.', '["breakfast"]'::jsonb, null, 'Sleeper bus'),

  ('00000000-0000-0000-0000-000000005511', '00000000-0000-0000-0000-000000005004', 1, 'Resort check-in', 'Flight arrival, private transfer, sunset chill.', '["dinner"]'::jsonb, 'Beach resort', 'Private transfer'),
  ('00000000-0000-0000-0000-000000005512', '00000000-0000-0000-0000-000000005004', 2, 'Island hopping', 'Speedboat island route with swimming and lunch.', '["breakfast","lunch"]'::jsonb, 'Beach resort', 'Speedboat'),
  ('00000000-0000-0000-0000-000000005513', '00000000-0000-0000-0000-000000005004', 3, 'Leisure and Grand World', 'Half-day resort leisure and evening entertainment.', '["breakfast"]'::jsonb, 'Beach resort', 'Coach'),
  ('00000000-0000-0000-0000-000000005514', '00000000-0000-0000-0000-000000005004', 4, 'Departure', 'Breakfast and airport drop.', '["breakfast"]'::jsonb, null, 'Private transfer'),

  ('00000000-0000-0000-0000-000000005515', '00000000-0000-0000-0000-000000005005', 1, 'Arrive Nha Trang', 'Hotel check-in and beach leisure.', '["dinner"]'::jsonb, 'Seaside hotel', 'Coach'),
  ('00000000-0000-0000-0000-000000005516', '00000000-0000-0000-0000-000000005005', 2, 'Island boat trip', 'Boat route, snorkeling stop, seafood lunch.', '["breakfast","lunch"]'::jsonb, 'Seaside hotel', 'Boat'),
  ('00000000-0000-0000-0000-000000005517', '00000000-0000-0000-0000-000000005005', 3, 'Free morning and return', 'Coffee stop and transfer home.', '["breakfast"]'::jsonb, null, 'Coach'),

  ('00000000-0000-0000-0000-000000005518', '00000000-0000-0000-0000-000000005006', 1, 'Hue heritage walk', 'Imperial city and local cuisine discovery.', '["lunch"]'::jsonb, 'Boutique hotel', 'Coach'),
  ('00000000-0000-0000-0000-000000005519', '00000000-0000-0000-0000-000000005006', 2, 'Hai Van pass to Da Nang', 'Scenic route and free evening in Da Nang.', '["breakfast"]'::jsonb, 'City hotel', 'Coach'),
  ('00000000-0000-0000-0000-000000005520', '00000000-0000-0000-0000-000000005006', 3, 'Museum and departure', 'Museum stop and transfer to airport.', '["breakfast"]'::jsonb, null, 'Private transfer')
on conflict do nothing;

insert into public.departure_schedules (
  id,
  tour_id,
  departure_date,
  return_date,
  meeting_point,
  meeting_at,
  capacity,
  cutoff_at,
  status,
  currency,
  notes,
  created_by,
  updated_by
)
values
  ('00000000-0000-0000-0000-000000006001', '00000000-0000-0000-0000-000000005001', current_date + 10, current_date + 12, 'Opera House, Ha Noi', (current_date + 10)::timestamp + interval '7 hours', 24, (current_date + 8)::timestamp, 'open', 'VND', 'High demand weekend departure', '00000000-0000-0000-0000-000000000201', '00000000-0000-0000-0000-000000000201'),
  ('00000000-0000-0000-0000-000000006002', '00000000-0000-0000-0000-000000005001', current_date - 40, current_date - 38, 'Opera House, Ha Noi', (current_date - 40)::timestamp + interval '7 hours', 20, (current_date - 42)::timestamp, 'completed', 'VND', 'Past departure for completed booking demo', '00000000-0000-0000-0000-000000000201', '00000000-0000-0000-0000-000000000201'),
  ('00000000-0000-0000-0000-000000006003', '00000000-0000-0000-0000-000000005002', current_date + 18, current_date + 21, 'Tan Son Nhat Airport', (current_date + 18)::timestamp + interval '8 hours', 28, (current_date + 16)::timestamp, 'open', 'VND', 'Most booked central route', '00000000-0000-0000-0000-000000000201', '00000000-0000-0000-0000-000000000201'),
  ('00000000-0000-0000-0000-000000006004', '00000000-0000-0000-0000-000000005002', current_date - 55, current_date - 52, 'Tan Son Nhat Airport', (current_date - 55)::timestamp + interval '8 hours', 26, (current_date - 57)::timestamp, 'completed', 'VND', 'Past departure for review demo', '00000000-0000-0000-0000-000000000201', '00000000-0000-0000-0000-000000000201'),
  ('00000000-0000-0000-0000-000000006005', '00000000-0000-0000-0000-000000005003', current_date + 12, current_date + 14, 'Gate 2, My Dinh', (current_date + 12)::timestamp + interval '22 hours', 22, (current_date + 10)::timestamp, 'open', 'VND', 'Cool weather season', '00000000-0000-0000-0000-000000000201', '00000000-0000-0000-0000-000000000201'),
  ('00000000-0000-0000-0000-000000006006', '00000000-0000-0000-0000-000000005003', current_date - 20, current_date - 18, 'Gate 2, My Dinh', (current_date - 20)::timestamp + interval '22 hours', 20, (current_date - 22)::timestamp, 'completed', 'VND', 'Past departure with sold seats', '00000000-0000-0000-0000-000000000201', '00000000-0000-0000-0000-000000000201'),
  ('00000000-0000-0000-0000-000000006007', '00000000-0000-0000-0000-000000005004', current_date + 25, current_date + 28, 'Tan Son Nhat Airport', (current_date + 25)::timestamp + interval '9 hours', 18, (current_date + 22)::timestamp, 'open', 'VND', 'Luxury cabin upgrade available', '00000000-0000-0000-0000-000000000201', '00000000-0000-0000-0000-000000000201'),
  ('00000000-0000-0000-0000-000000006008', '00000000-0000-0000-0000-000000005004', current_date + 60, current_date + 63, 'Tan Son Nhat Airport', (current_date + 60)::timestamp + interval '9 hours', 18, (current_date + 57)::timestamp, 'open', 'VND', 'Long-range departure for search filter demo', '00000000-0000-0000-0000-000000000201', '00000000-0000-0000-0000-000000000201'),
  ('00000000-0000-0000-0000-000000006009', '00000000-0000-0000-0000-000000005005', current_date + 30, current_date + 32, 'Tan Son Nhat Airport', (current_date + 30)::timestamp + interval '6 hours', 30, (current_date + 27)::timestamp, 'open', 'VND', 'Family summer route', '00000000-0000-0000-0000-000000000201', '00000000-0000-0000-0000-000000000201'),
  ('00000000-0000-0000-0000-000000006010', '00000000-0000-0000-0000-000000005005', current_date - 15, current_date - 13, 'Tan Son Nhat Airport', (current_date - 15)::timestamp + interval '6 hours', 26, (current_date - 18)::timestamp, 'completed', 'VND', 'Past summer route for completed review', '00000000-0000-0000-0000-000000000201', '00000000-0000-0000-0000-000000000201'),
  ('00000000-0000-0000-0000-000000006011', '00000000-0000-0000-0000-000000005006', current_date + 7, current_date + 9, 'Tan Son Nhat Airport', (current_date + 7)::timestamp + interval '7 hours', 20, (current_date + 5)::timestamp, 'open', 'VND', 'Fast-converting short trip schedule', '00000000-0000-0000-0000-000000000201', '00000000-0000-0000-0000-000000000201'),
  ('00000000-0000-0000-0000-000000006012', '00000000-0000-0000-0000-000000005006', current_date - 70, current_date - 68, 'Tan Son Nhat Airport', (current_date - 70)::timestamp + interval '7 hours', 20, (current_date - 72)::timestamp, 'completed', 'VND', 'Older completed route', '00000000-0000-0000-0000-000000000201', '00000000-0000-0000-0000-000000000201')
on conflict do nothing;

insert into public.schedule_price_tiers (id, schedule_id, traveler_type, age_from, age_to, price, sale_price, currency)
values
  ('00000000-0000-0000-0000-000000007001', '00000000-0000-0000-0000-000000006001', 'adult', 12, 99, 4800000, null, 'VND'),
  ('00000000-0000-0000-0000-000000007002', '00000000-0000-0000-0000-000000006001', 'child', 5, 11, 3500000, null, 'VND'),
  ('00000000-0000-0000-0000-000000007003', '00000000-0000-0000-0000-000000006001', 'infant', 0, 4, 800000, null, 'VND'),
  ('00000000-0000-0000-0000-000000007004', '00000000-0000-0000-0000-000000006002', 'adult', 12, 99, 4500000, null, 'VND'),
  ('00000000-0000-0000-0000-000000007005', '00000000-0000-0000-0000-000000006002', 'child', 5, 11, 3200000, null, 'VND'),
  ('00000000-0000-0000-0000-000000007006', '00000000-0000-0000-0000-000000006002', 'infant', 0, 4, 700000, null, 'VND'),
  ('00000000-0000-0000-0000-000000007007', '00000000-0000-0000-0000-000000006003', 'adult', 12, 99, 6200000, null, 'VND'),
  ('00000000-0000-0000-0000-000000007008', '00000000-0000-0000-0000-000000006003', 'child', 5, 11, 4600000, null, 'VND'),
  ('00000000-0000-0000-0000-000000007009', '00000000-0000-0000-0000-000000006003', 'infant', 0, 4, 1200000, null, 'VND'),
  ('00000000-0000-0000-0000-000000007010', '00000000-0000-0000-0000-000000006004', 'adult', 12, 99, 5900000, null, 'VND'),
  ('00000000-0000-0000-0000-000000007011', '00000000-0000-0000-0000-000000006004', 'child', 5, 11, 4300000, null, 'VND'),
  ('00000000-0000-0000-0000-000000007012', '00000000-0000-0000-0000-000000006004', 'infant', 0, 4, 1000000, null, 'VND'),
  ('00000000-0000-0000-0000-000000007013', '00000000-0000-0000-0000-000000006005', 'adult', 12, 99, 3900000, null, 'VND'),
  ('00000000-0000-0000-0000-000000007014', '00000000-0000-0000-0000-000000006005', 'child', 5, 11, 2800000, null, 'VND'),
  ('00000000-0000-0000-0000-000000007015', '00000000-0000-0000-0000-000000006005', 'infant', 0, 4, 600000, null, 'VND'),
  ('00000000-0000-0000-0000-000000007016', '00000000-0000-0000-0000-000000006006', 'adult', 12, 99, 3600000, null, 'VND'),
  ('00000000-0000-0000-0000-000000007017', '00000000-0000-0000-0000-000000006006', 'child', 5, 11, 2500000, null, 'VND'),
  ('00000000-0000-0000-0000-000000007018', '00000000-0000-0000-0000-000000006006', 'infant', 0, 4, 500000, null, 'VND'),
  ('00000000-0000-0000-0000-000000007019', '00000000-0000-0000-0000-000000006007', 'adult', 12, 99, 7400000, null, 'VND'),
  ('00000000-0000-0000-0000-000000007020', '00000000-0000-0000-0000-000000006007', 'child', 5, 11, 5600000, null, 'VND'),
  ('00000000-0000-0000-0000-000000007021', '00000000-0000-0000-0000-000000006007', 'infant', 0, 4, 1500000, null, 'VND'),
  ('00000000-0000-0000-0000-000000007022', '00000000-0000-0000-0000-000000006008', 'adult', 12, 99, 7900000, null, 'VND'),
  ('00000000-0000-0000-0000-000000007023', '00000000-0000-0000-0000-000000006008', 'child', 5, 11, 5900000, null, 'VND'),
  ('00000000-0000-0000-0000-000000007024', '00000000-0000-0000-0000-000000006008', 'infant', 0, 4, 1600000, null, 'VND'),
  ('00000000-0000-0000-0000-000000007025', '00000000-0000-0000-0000-000000006009', 'adult', 12, 99, 5100000, null, 'VND'),
  ('00000000-0000-0000-0000-000000007026', '00000000-0000-0000-0000-000000006009', 'child', 5, 11, 3700000, null, 'VND'),
  ('00000000-0000-0000-0000-000000007027', '00000000-0000-0000-0000-000000006009', 'infant', 0, 4, 900000, null, 'VND'),
  ('00000000-0000-0000-0000-000000007028', '00000000-0000-0000-0000-000000006010', 'adult', 12, 99, 4800000, null, 'VND'),
  ('00000000-0000-0000-0000-000000007029', '00000000-0000-0000-0000-000000006010', 'child', 5, 11, 3500000, null, 'VND'),
  ('00000000-0000-0000-0000-000000007030', '00000000-0000-0000-0000-000000006010', 'infant', 0, 4, 800000, null, 'VND'),
  ('00000000-0000-0000-0000-000000007031', '00000000-0000-0000-0000-000000006011', 'adult', 12, 99, 4900000, null, 'VND'),
  ('00000000-0000-0000-0000-000000007032', '00000000-0000-0000-0000-000000006011', 'child', 5, 11, 3600000, null, 'VND'),
  ('00000000-0000-0000-0000-000000007033', '00000000-0000-0000-0000-000000006011', 'infant', 0, 4, 850000, null, 'VND'),
  ('00000000-0000-0000-0000-000000007034', '00000000-0000-0000-0000-000000006012', 'adult', 12, 99, 4500000, null, 'VND'),
  ('00000000-0000-0000-0000-000000007035', '00000000-0000-0000-0000-000000006012', 'child', 5, 11, 3300000, null, 'VND'),
  ('00000000-0000-0000-0000-000000007036', '00000000-0000-0000-0000-000000006012', 'infant', 0, 4, 700000, null, 'VND')
on conflict do nothing;

insert into public.coupons (
  id,
  code,
  name,
  description,
  discount_type,
  discount_value,
  min_order_amount,
  max_discount_amount,
  start_at,
  end_at,
  usage_limit,
  usage_per_user_limit,
  used_count,
  is_active,
  created_by
)
values
  ('00000000-0000-0000-0000-000000007701', 'SUMMER10', 'Summer 10%', '10 percent discount for selected summer tours', 'percentage', 10, 3000000, 1500000, now() - interval '5 days', now() + interval '90 days', 300, 2, 0, true, '00000000-0000-0000-0000-000000000301'),
  ('00000000-0000-0000-0000-000000007702', 'FAMILY500', 'Family 500K', 'Fixed 500,000 VND off for family trips', 'fixed_amount', 500000, 5000000, 500000, now() - interval '3 days', now() + interval '60 days', 200, 1, 0, true, '00000000-0000-0000-0000-000000000301'),
  ('00000000-0000-0000-0000-000000007703', 'LUXURY7', 'Luxury 7%', 'Premium discount for luxury tours', 'percentage', 7, 7000000, 2000000, now() - interval '3 days', now() + interval '45 days', 50, 1, 0, true, '00000000-0000-0000-0000-000000000301')
on conflict do nothing;

insert into public.coupon_categories (id, coupon_id, category_id)
values
  ('00000000-0000-0000-0000-000000007721', '00000000-0000-0000-0000-000000007702', '00000000-0000-0000-0000-000000002004')
on conflict do nothing;

insert into public.coupon_tours (id, coupon_id, tour_id)
values
  ('00000000-0000-0000-0000-000000007711', '00000000-0000-0000-0000-000000007703', '00000000-0000-0000-0000-000000005004')
on conflict do nothing;

insert into public.saved_travelers (id, user_id, full_name, phone, email, date_of_birth, gender, id_number, passport_number, nationality, traveler_type, notes)
values
  ('00000000-0000-0000-0000-000000007401', '00000000-0000-0000-0000-000000000101', 'Duc Tran', '0907000001', 'duc.tran@tourbook.demo', date '1991-05-12', 'male', '079091001111', null, 'Vietnam', 'adult', 'Spouse profile'),
  ('00000000-0000-0000-0000-000000007402', '00000000-0000-0000-0000-000000000101', 'Mia Tran', null, null, date '2018-08-20', 'female', null, null, 'Vietnam', 'child', 'Child traveler profile'),
  ('00000000-0000-0000-0000-000000007403', '00000000-0000-0000-0000-000000000102', 'Dat Tran', '0907000002', null, date '1994-11-02', 'male', '079091002222', null, 'Vietnam', 'adult', 'Brother'),
  ('00000000-0000-0000-0000-000000007404', '00000000-0000-0000-0000-000000000103', 'Huong Pham', '0907000003', null, date '1996-02-17', 'female', '079091003333', null, 'Vietnam', 'adult', 'Friend profile'),
  ('00000000-0000-0000-0000-000000007405', '00000000-0000-0000-0000-000000000104', 'Bao Le', null, null, date '2016-01-21', 'male', null, null, 'Vietnam', 'child', 'Child traveler profile'),
  ('00000000-0000-0000-0000-000000007406', '00000000-0000-0000-0000-000000000104', 'Mai Le', '0907000004', null, date '1992-04-18', 'female', '079091004444', null, 'Vietnam', 'adult', 'Partner profile')
on conflict do nothing;

insert into public.user_addresses (id, user_id, label, full_name, phone, address_line, province, district, ward, postal_code, country_code, is_default)
values
  ('00000000-0000-0000-0000-000000007501', '00000000-0000-0000-0000-000000000101', 'Home', 'Anna Nguyen', '0901000001', '12 Nguyen Trai', 'Ha Noi', 'Thanh Xuan', 'Thuong Dinh', '100000', 'VN', true),
  ('00000000-0000-0000-0000-000000007502', '00000000-0000-0000-0000-000000000102', 'Home', 'Minh Tran', '0901000002', '28 Dien Bien Phu', 'Ho Chi Minh City', 'Binh Thanh', 'Ward 15', '700000', 'VN', true),
  ('00000000-0000-0000-0000-000000007503', '00000000-0000-0000-0000-000000000103', 'Office', 'Linh Pham', '0901000003', '9 Bach Dang', 'Da Nang', 'Hai Chau', 'Hai Chau 1', '550000', 'VN', true),
  ('00000000-0000-0000-0000-000000007504', '00000000-0000-0000-0000-000000000104', 'Home', 'Quan Le', '0901000004', '101 Vo Van Ngan', 'Ho Chi Minh City', 'Thu Duc', 'Linh Chieu', '700000', 'VN', true)
on conflict do nothing;

insert into public.wishlist (id, user_id, tour_id)
values
  ('00000000-0000-0000-0000-000000007601', '00000000-0000-0000-0000-000000000101', '00000000-0000-0000-0000-000000005004'),
  ('00000000-0000-0000-0000-000000007602', '00000000-0000-0000-0000-000000000101', '00000000-0000-0000-0000-000000005002'),
  ('00000000-0000-0000-0000-000000007603', '00000000-0000-0000-0000-000000000102', '00000000-0000-0000-0000-000000005001'),
  ('00000000-0000-0000-0000-000000007604', '00000000-0000-0000-0000-000000000103', '00000000-0000-0000-0000-000000005005'),
  ('00000000-0000-0000-0000-000000007605', '00000000-0000-0000-0000-000000000104', '00000000-0000-0000-0000-000000005003'),
  ('00000000-0000-0000-0000-000000007606', '00000000-0000-0000-0000-000000000104', '00000000-0000-0000-0000-000000005006')
on conflict do nothing;

insert into public.bookings (
  id,
  booking_code,
  user_id,
  tour_id,
  schedule_id,
  contact_name,
  contact_phone,
  contact_email,
  adult_count,
  child_count,
  infant_count,
  subtotal_amount,
  discount_amount,
  tax_amount,
  service_fee_amount,
  total_amount,
  currency,
  booking_status,
  payment_status,
  expires_at,
  confirmed_at,
  completed_at,
  cancelled_at,
  cancel_reason,
  customer_note,
  snapshot_jsonb
)
values
  ('00000000-0000-0000-0000-000000008001', 'TBK-1001', '00000000-0000-0000-0000-000000000101', '00000000-0000-0000-0000-000000005001', '00000000-0000-0000-0000-000000006001', 'Anna Nguyen', '0901000001', 'anna.nguyen@tourbook.demo', 2, 1, 0, 13100000, 500000, 0, 0, 12600000, 'VND', 'confirmed', 'paid', null, now() - interval '2 days', null, null, null, 'Need vegetarian option for one traveler.', '{"tour_name":"Ha Long Bay Cruise 3N2D","schedule_label":"Weekend departure","lead_traveler":"Anna Nguyen"}'::jsonb),
  ('00000000-0000-0000-0000-000000008002', 'TBK-1002', '00000000-0000-0000-0000-000000000102', '00000000-0000-0000-0000-000000005002', '00000000-0000-0000-0000-000000006003', 'Minh Tran', '0901000002', 'minh.tran@tourbook.demo', 1, 0, 0, 6200000, 0, 0, 0, 6200000, 'VND', 'awaiting_payment', 'pending', now() + interval '12 hours', null, null, null, null, 'Please keep room on high floor if possible.', '{"tour_name":"Da Nang - Hoi An - Ba Na 4N3D","payment_deadline_hours":12}'::jsonb),
  ('00000000-0000-0000-0000-000000008003', 'TBK-1003', '00000000-0000-0000-0000-000000000103', '00000000-0000-0000-0000-000000005002', '00000000-0000-0000-0000-000000006004', 'Linh Pham', '0901000003', 'linh.pham@tourbook.demo', 2, 0, 0, 11800000, 1180000, 0, 0, 10620000, 'VND', 'completed', 'paid', null, now() - interval '60 days', now() - interval '50 days', null, null, 'Smooth trip, want to book again for family.', '{"tour_name":"Da Nang - Hoi An - Ba Na 4N3D","completed_trip":true}'::jsonb),
  ('00000000-0000-0000-0000-000000008004', 'TBK-1004', '00000000-0000-0000-0000-000000000104', '00000000-0000-0000-0000-000000005004', '00000000-0000-0000-0000-000000006007', 'Quan Le', '0901000004', 'quan.le@tourbook.demo', 2, 0, 0, 14800000, 0, 0, 0, 14800000, 'VND', 'cancelled', 'refunded', null, now() - interval '5 days', null, now() - interval '1 day', 'Customer changed travel plan.', 'Need support on refund ETA.', '{"tour_name":"Phu Quoc Luxury Retreat 4N3D","refund_case":true}'::jsonb),
  ('00000000-0000-0000-0000-000000008005', 'TBK-1005', '00000000-0000-0000-0000-000000000101', '00000000-0000-0000-0000-000000005005', '00000000-0000-0000-0000-000000006009', 'Anna Nguyen', '0901000001', 'anna.nguyen@tourbook.demo', 1, 1, 0, 8800000, 0, 0, 0, 8800000, 'VND', 'cancel_requested', 'partially_paid', null, now() - interval '1 day', null, null, 'Waiting for cancellation approval after deposit.', 'Customer asked if child can switch to another departure.', '{"tour_name":"Nha Trang Island Explorer 3N2D","deposit_paid":4400000}'::jsonb),
  ('00000000-0000-0000-0000-000000008006', 'TBK-1006', '00000000-0000-0000-0000-000000000102', '00000000-0000-0000-0000-000000005006', '00000000-0000-0000-0000-000000006011', 'Minh Tran', '0901000002', 'minh.tran@tourbook.demo', 2, 0, 0, 9800000, 0, 0, 0, 9800000, 'VND', 'pending', 'unpaid', now() + interval '30 minutes', null, null, null, null, 'Holding seats while waiting for family confirmation.', '{"tour_name":"Hue - Da Nang Heritage 3N2D","temporary_hold":true}'::jsonb),
  ('00000000-0000-0000-0000-000000008007', 'TBK-1007', '00000000-0000-0000-0000-000000000104', '00000000-0000-0000-0000-000000005005', '00000000-0000-0000-0000-000000006010', 'Quan Le', '0901000004', 'quan.le@tourbook.demo', 1, 1, 0, 8300000, 0, 0, 0, 8300000, 'VND', 'completed', 'paid', null, now() - interval '20 days', now() - interval '12 days', null, null, 'Trip was easy and family-friendly.', '{"tour_name":"Nha Trang Island Explorer 3N2D","completed_trip":true}'::jsonb)
on conflict do nothing;

insert into public.booking_travelers (
  id,
  booking_id,
  saved_traveler_id,
  full_name,
  phone,
  email,
  date_of_birth,
  gender,
  id_number,
  passport_number,
  nationality,
  traveler_type,
  price_amount,
  special_request
)
values
  ('00000000-0000-0000-0000-000000008101', '00000000-0000-0000-0000-000000008001', null, 'Anna Nguyen', '0901000001', 'anna.nguyen@tourbook.demo', date '1992-03-10', 'female', '079091010101', null, 'Vietnam', 'adult', 4800000, null),
  ('00000000-0000-0000-0000-000000008102', '00000000-0000-0000-0000-000000008001', '00000000-0000-0000-0000-000000007401', 'Duc Tran', '0907000001', 'duc.tran@tourbook.demo', date '1991-05-12', 'male', '079091001111', null, 'Vietnam', 'adult', 4800000, 'Vegetarian meal'),
  ('00000000-0000-0000-0000-000000008103', '00000000-0000-0000-0000-000000008001', '00000000-0000-0000-0000-000000007402', 'Mia Tran', null, null, date '2018-08-20', 'female', null, null, 'Vietnam', 'child', 3500000, null),
  ('00000000-0000-0000-0000-000000008104', '00000000-0000-0000-0000-000000008002', null, 'Minh Tran', '0901000002', 'minh.tran@tourbook.demo', date '1993-09-09', 'male', '079091020202', null, 'Vietnam', 'adult', 6200000, 'Need airport pickup confirmation'),
  ('00000000-0000-0000-0000-000000008105', '00000000-0000-0000-0000-000000008003', null, 'Linh Pham', '0901000003', 'linh.pham@tourbook.demo', date '1994-12-01', 'female', '079091030303', null, 'Vietnam', 'adult', 5900000, null),
  ('00000000-0000-0000-0000-000000008106', '00000000-0000-0000-0000-000000008003', '00000000-0000-0000-0000-000000007404', 'Huong Pham', '0907000003', null, date '1996-02-17', 'female', '079091003333', null, 'Vietnam', 'adult', 5900000, null),
  ('00000000-0000-0000-0000-000000008107', '00000000-0000-0000-0000-000000008004', null, 'Quan Le', '0901000004', 'quan.le@tourbook.demo', date '1990-06-15', 'male', '079091040404', null, 'Vietnam', 'adult', 7400000, null),
  ('00000000-0000-0000-0000-000000008108', '00000000-0000-0000-0000-000000008004', '00000000-0000-0000-0000-000000007406', 'Mai Le', '0907000004', null, date '1992-04-18', 'female', '079091004444', null, 'Vietnam', 'adult', 7400000, null),
  ('00000000-0000-0000-0000-000000008109', '00000000-0000-0000-0000-000000008005', null, 'Anna Nguyen', '0901000001', 'anna.nguyen@tourbook.demo', date '1992-03-10', 'female', '079091010101', null, 'Vietnam', 'adult', 5100000, null),
  ('00000000-0000-0000-0000-000000008110', '00000000-0000-0000-0000-000000008005', '00000000-0000-0000-0000-000000007402', 'Mia Tran', null, null, date '2018-08-20', 'female', null, null, 'Vietnam', 'child', 3700000, null),
  ('00000000-0000-0000-0000-000000008111', '00000000-0000-0000-0000-000000008006', null, 'Minh Tran', '0901000002', 'minh.tran@tourbook.demo', date '1993-09-09', 'male', '079091020202', null, 'Vietnam', 'adult', 4900000, null),
  ('00000000-0000-0000-0000-000000008112', '00000000-0000-0000-0000-000000008006', '00000000-0000-0000-0000-000000007403', 'Dat Tran', '0907000002', null, date '1994-11-02', 'male', '079091002222', null, 'Vietnam', 'adult', 4900000, null),
  ('00000000-0000-0000-0000-000000008113', '00000000-0000-0000-0000-000000008007', null, 'Quan Le', '0901000004', 'quan.le@tourbook.demo', date '1990-06-15', 'male', '079091040404', null, 'Vietnam', 'adult', 4800000, null),
  ('00000000-0000-0000-0000-000000008114', '00000000-0000-0000-0000-000000008007', '00000000-0000-0000-0000-000000007405', 'Bao Le', null, null, date '2016-01-21', 'male', null, null, 'Vietnam', 'child', 3500000, 'Need child life vest size small')
on conflict do nothing;

insert into public.booking_price_lines (id, booking_id, line_type, label, quantity, unit_amount, total_amount, metadata_jsonb)
values
  ('00000000-0000-0000-0000-000000008201', '00000000-0000-0000-0000-000000008001', 'fare', 'Adult fare', 2, 4800000, 9600000, '{}'::jsonb),
  ('00000000-0000-0000-0000-000000008202', '00000000-0000-0000-0000-000000008001', 'fare', 'Child fare', 1, 3500000, 3500000, '{}'::jsonb),
  ('00000000-0000-0000-0000-000000008203', '00000000-0000-0000-0000-000000008001', 'coupon', 'FAMILY500', 1, 500000, 500000, '{}'::jsonb),
  ('00000000-0000-0000-0000-000000008204', '00000000-0000-0000-0000-000000008002', 'fare', 'Adult fare', 1, 6200000, 6200000, '{}'::jsonb),
  ('00000000-0000-0000-0000-000000008205', '00000000-0000-0000-0000-000000008003', 'fare', 'Adult fare', 2, 5900000, 11800000, '{}'::jsonb),
  ('00000000-0000-0000-0000-000000008206', '00000000-0000-0000-0000-000000008003', 'coupon', 'SUMMER10', 1, 1180000, 1180000, '{}'::jsonb),
  ('00000000-0000-0000-0000-000000008207', '00000000-0000-0000-0000-000000008004', 'fare', 'Adult fare', 2, 7400000, 14800000, '{}'::jsonb),
  ('00000000-0000-0000-0000-000000008208', '00000000-0000-0000-0000-000000008005', 'fare', 'Adult fare', 1, 5100000, 5100000, '{}'::jsonb),
  ('00000000-0000-0000-0000-000000008209', '00000000-0000-0000-0000-000000008005', 'fare', 'Child fare', 1, 3700000, 3700000, '{}'::jsonb),
  ('00000000-0000-0000-0000-000000008210', '00000000-0000-0000-0000-000000008006', 'fare', 'Adult fare', 2, 4900000, 9800000, '{}'::jsonb),
  ('00000000-0000-0000-0000-000000008211', '00000000-0000-0000-0000-000000008007', 'fare', 'Adult fare', 1, 4800000, 4800000, '{}'::jsonb),
  ('00000000-0000-0000-0000-000000008212', '00000000-0000-0000-0000-000000008007', 'fare', 'Child fare', 1, 3500000, 3500000, '{}'::jsonb)
on conflict do nothing;

insert into public.coupon_usages (id, coupon_id, booking_id, user_id, discount_amount)
values
  ('00000000-0000-0000-0000-000000008301', '00000000-0000-0000-0000-000000007702', '00000000-0000-0000-0000-000000008001', '00000000-0000-0000-0000-000000000101', 500000),
  ('00000000-0000-0000-0000-000000008302', '00000000-0000-0000-0000-000000007701', '00000000-0000-0000-0000-000000008003', '00000000-0000-0000-0000-000000000103', 1180000)
on conflict do nothing;

insert into public.booking_events (id, booking_id, actor_id, event_type, note, event_data)
values
  ('00000000-0000-0000-0000-000000008401', '00000000-0000-0000-0000-000000008001', '00000000-0000-0000-0000-000000000101', 'booking_created', 'Customer created booking from tour detail page.', '{"channel":"web"}'::jsonb),
  ('00000000-0000-0000-0000-000000008402', '00000000-0000-0000-0000-000000008001', '00000000-0000-0000-0000-000000000201', 'booking_confirmed', 'Staff confirmed after successful payment.', '{}'::jsonb),
  ('00000000-0000-0000-0000-000000008403', '00000000-0000-0000-0000-000000008002', '00000000-0000-0000-0000-000000000102', 'booking_created', 'Customer reserved 1 seat.', '{"channel":"web"}'::jsonb),
  ('00000000-0000-0000-0000-000000008404', '00000000-0000-0000-0000-000000008002', '00000000-0000-0000-0000-000000000201', 'payment_pending', 'Awaiting payment gateway callback.', '{}'::jsonb),
  ('00000000-0000-0000-0000-000000008405', '00000000-0000-0000-0000-000000008003', '00000000-0000-0000-0000-000000000103', 'booking_completed', 'Trip completed successfully.', '{}'::jsonb),
  ('00000000-0000-0000-0000-000000008406', '00000000-0000-0000-0000-000000008004', '00000000-0000-0000-0000-000000000104', 'cancellation_requested', 'Customer requested cancellation.', '{}'::jsonb),
  ('00000000-0000-0000-0000-000000008407', '00000000-0000-0000-0000-000000008004', '00000000-0000-0000-0000-000000000201', 'refund_processed', 'Full refund approved and processed.', '{"refund_percent":100}'::jsonb),
  ('00000000-0000-0000-0000-000000008408', '00000000-0000-0000-0000-000000008005', '00000000-0000-0000-0000-000000000101', 'cancel_requested', 'Customer asked to cancel after deposit.', '{}'::jsonb),
  ('00000000-0000-0000-0000-000000008409', '00000000-0000-0000-0000-000000008006', '00000000-0000-0000-0000-000000000102', 'booking_created', 'Temporary hold before payment.', '{"hold_minutes":30}'::jsonb),
  ('00000000-0000-0000-0000-000000008410', '00000000-0000-0000-0000-000000008007', '00000000-0000-0000-0000-000000000104', 'booking_completed', 'Family trip finished.', '{}'::jsonb)
on conflict do nothing;

insert into public.booking_notes (id, booking_id, author_id, note, is_private)
values
  ('00000000-0000-0000-0000-000000008501', '00000000-0000-0000-0000-000000008001', '00000000-0000-0000-0000-000000000201', 'Arrange one vegetarian meal and family room nearby.', true),
  ('00000000-0000-0000-0000-000000008502', '00000000-0000-0000-0000-000000008002', '00000000-0000-0000-0000-000000000201', 'Call customer if payment not completed within 6 hours.', true),
  ('00000000-0000-0000-0000-000000008503', '00000000-0000-0000-0000-000000008004', '00000000-0000-0000-0000-000000000201', 'Refund approved due to plan change before cutoff date.', true),
  ('00000000-0000-0000-0000-000000008504', '00000000-0000-0000-0000-000000008005', '00000000-0000-0000-0000-000000000201', 'Pending review by operations manager.', true)
on conflict do nothing;

insert into public.payments (
  id,
  booking_id,
  payment_method_id,
  provider_name,
  provider_order_id,
  provider_payment_id,
  transaction_code,
  amount,
  currency,
  status,
  requested_at,
  paid_at,
  failed_at,
  failure_reason,
  raw_response
)
values
  ('00000000-0000-0000-0000-000000008601', '00000000-0000-0000-0000-000000008001', (select id from public.payment_methods where lower(code) = 'vnpay' limit 1), 'VNPay', 'VNP-ORDER-1001', 'VNP-PAY-1001', 'TXN1001', 12600000, 'VND', 'paid', now() - interval '2 days', now() - interval '2 days', null, null, '{"message":"success"}'::jsonb),
  ('00000000-0000-0000-0000-000000008602', '00000000-0000-0000-0000-000000008002', (select id from public.payment_methods where lower(code) = 'momo' limit 1), 'MoMo', 'MOMO-ORDER-1002', null, 'TXN1002', 6200000, 'VND', 'pending', now() - interval '2 hours', null, null, null, '{"message":"awaiting callback"}'::jsonb),
  ('00000000-0000-0000-0000-000000008603', '00000000-0000-0000-0000-000000008003', (select id from public.payment_methods where lower(code) = 'bank_transfer' limit 1), 'Bank Transfer', 'BANK-ORDER-1003', 'BANK-PAY-1003', 'TXN1003', 10620000, 'VND', 'paid', now() - interval '58 days', now() - interval '58 days', null, null, '{"message":"manual reconciliation success"}'::jsonb),
  ('00000000-0000-0000-0000-000000008604', '00000000-0000-0000-0000-000000008004', (select id from public.payment_methods where lower(code) = 'vnpay' limit 1), 'VNPay', 'VNP-ORDER-1004', 'VNP-PAY-1004', 'TXN1004', 14800000, 'VND', 'refunded', now() - interval '7 days', now() - interval '7 days', null, null, '{"message":"refunded in full"}'::jsonb),
  ('00000000-0000-0000-0000-000000008605', '00000000-0000-0000-0000-000000008005', (select id from public.payment_methods where lower(code) = 'bank_transfer' limit 1), 'Bank Transfer', 'BANK-ORDER-1005', 'BANK-PAY-1005', 'TXN1005', 4400000, 'VND', 'paid', now() - interval '1 day', now() - interval '1 day', null, null, '{"message":"deposit paid"}'::jsonb),
  ('00000000-0000-0000-0000-000000008607', '00000000-0000-0000-0000-000000008007', (select id from public.payment_methods where lower(code) = 'cash' limit 1), 'Cash', 'CASH-ORDER-1007', 'CASH-PAY-1007', 'TXN1007', 8300000, 'VND', 'paid', now() - interval '16 days', now() - interval '16 days', null, null, '{"message":"cash collected by staff"}'::jsonb)
on conflict do nothing;

insert into public.payment_events (id, payment_id, event_name, payload, status, received_at, processed_at)
values
  ('00000000-0000-0000-0000-000000008701', '00000000-0000-0000-0000-000000008601', 'payment_succeeded', '{"gateway":"vnpay"}'::jsonb, 'processed', now() - interval '2 days', now() - interval '2 days'),
  ('00000000-0000-0000-0000-000000008702', '00000000-0000-0000-0000-000000008602', 'payment_pending', '{"gateway":"momo"}'::jsonb, 'received', now() - interval '2 hours', null),
  ('00000000-0000-0000-0000-000000008703', '00000000-0000-0000-0000-000000008603', 'payment_reconciled', '{"source":"bank_transfer"}'::jsonb, 'processed', now() - interval '58 days', now() - interval '58 days'),
  ('00000000-0000-0000-0000-000000008704', '00000000-0000-0000-0000-000000008604', 'refund_completed', '{"gateway":"vnpay"}'::jsonb, 'processed', now() - interval '1 day', now() - interval '1 day'),
  ('00000000-0000-0000-0000-000000008705', '00000000-0000-0000-0000-000000008605', 'deposit_paid', '{"source":"bank_transfer"}'::jsonb, 'processed', now() - interval '1 day', now() - interval '1 day'),
  ('00000000-0000-0000-0000-000000008706', '00000000-0000-0000-0000-000000008607', 'cash_collected', '{"collector":"staff"}'::jsonb, 'processed', now() - interval '16 days', now() - interval '16 days')
on conflict do nothing;

insert into public.refunds (id, payment_id, amount, reason, status, requested_by, approved_by, refunded_at)
values
  ('00000000-0000-0000-0000-000000008801', '00000000-0000-0000-0000-000000008604', 14800000, 'Customer cancelled before free cancellation cutoff.', 'refunded', '00000000-0000-0000-0000-000000000104', '00000000-0000-0000-0000-000000000201', now() - interval '1 day')
on conflict do nothing;

insert into public.invoices (id, booking_id, invoice_number, company_name, tax_code, billing_email, billing_address, issued_at, status)
values
  ('00000000-0000-0000-0000-000000008901', '00000000-0000-0000-0000-000000008001', 'INV-DEMO-1001', 'Anna Nguyen', null, 'anna.nguyen@tourbook.demo', '12 Nguyen Trai, Thanh Xuan, Ha Noi', now() - interval '2 days', 'issued'),
  ('00000000-0000-0000-0000-000000008902', '00000000-0000-0000-0000-000000008003', 'INV-DEMO-1002', 'Linh Pham', null, 'linh.pham@tourbook.demo', '9 Bach Dang, Hai Chau, Da Nang', now() - interval '58 days', 'issued'),
  ('00000000-0000-0000-0000-000000008903', '00000000-0000-0000-0000-000000008007', 'INV-DEMO-1003', 'Quan Le', null, 'quan.le@tourbook.demo', '101 Vo Van Ngan, Thu Duc, Ho Chi Minh City', now() - interval '16 days', 'issued')
on conflict do nothing;

insert into public.reviews (id, tour_id, booking_id, user_id, rating, comment, status)
values
  ('00000000-0000-0000-0000-000000009001', '00000000-0000-0000-0000-000000005002', '00000000-0000-0000-0000-000000008003', '00000000-0000-0000-0000-000000000103', 5, 'Everything was smooth, hotel was clean, and Hoi An at night was beautiful. Would book again.', 'approved'),
  ('00000000-0000-0000-0000-000000009002', '00000000-0000-0000-0000-000000005005', '00000000-0000-0000-0000-000000008007', '00000000-0000-0000-0000-000000000104', 4, 'Good family trip and boat route was fun. Would prefer more free beach time on day two.', 'approved')
on conflict do nothing;

insert into public.review_replies (id, review_id, replied_by, reply_text)
values
  ('00000000-0000-0000-0000-000000009011', '00000000-0000-0000-0000-000000009001', '00000000-0000-0000-0000-000000000201', 'Thank you for traveling with us. We are glad your Hoi An experience was memorable.'),
  ('00000000-0000-0000-0000-000000009012', '00000000-0000-0000-0000-000000009002', '00000000-0000-0000-0000-000000000201', 'Thanks for the feedback. We will review the timing on day two for future departures.')
on conflict do nothing;

insert into public.notifications (id, user_id, title, content, notification_type, reference_type, reference_id, is_read, read_at, created_at)
values
  ('00000000-0000-0000-0000-000000009101', '00000000-0000-0000-0000-000000000101', 'Booking confirmed', 'Your booking TBK-1001 has been confirmed.', 'booking', 'booking', '00000000-0000-0000-0000-000000008001', true, now() - interval '1 day', now() - interval '2 days'),
  ('00000000-0000-0000-0000-000000009102', '00000000-0000-0000-0000-000000000101', 'Partial payment received', 'Deposit for TBK-1005 has been recorded.', 'payment', 'booking', '00000000-0000-0000-0000-000000008005', false, null, now() - interval '1 day'),
  ('00000000-0000-0000-0000-000000009103', '00000000-0000-0000-0000-000000000102', 'Payment pending', 'Please complete payment for booking TBK-1002 before the deadline.', 'payment', 'booking', '00000000-0000-0000-0000-000000008002', false, null, now() - interval '2 hours'),
  ('00000000-0000-0000-0000-000000009104', '00000000-0000-0000-0000-000000000102', 'Booking hold expires soon', 'Temporary hold for TBK-1006 will expire in 30 minutes.', 'booking', 'booking', '00000000-0000-0000-0000-000000008006', false, null, now()),
  ('00000000-0000-0000-0000-000000009105', '00000000-0000-0000-0000-000000000103', 'Thank you for your review', 'Your review for Da Nang - Hoi An - Ba Na is now visible.', 'review', 'review', '00000000-0000-0000-0000-000000009001', true, now() - interval '10 days', now() - interval '10 days'),
  ('00000000-0000-0000-0000-000000009106', '00000000-0000-0000-0000-000000000104', 'Refund completed', 'Refund for booking TBK-1004 has been completed.', 'refund', 'booking', '00000000-0000-0000-0000-000000008004', true, now() - interval '1 day', now() - interval '1 day'),
  ('00000000-0000-0000-0000-000000009107', '00000000-0000-0000-0000-000000000104', 'Share your trip review', 'Tell us how you liked Nha Trang Island Explorer.', 'review', 'booking', '00000000-0000-0000-0000-000000008007', false, null, now() - interval '5 days')
on conflict do nothing;

insert into public.support_tickets (id, ticket_code, user_id, booking_id, subject, status, priority, assigned_to, created_at, updated_at, closed_at)
values
  ('00000000-0000-0000-0000-000000009201', 'TKT-1001', '00000000-0000-0000-0000-000000000101', '00000000-0000-0000-0000-000000008001', 'Vegetarian meal confirmation', 'open', 'normal', '00000000-0000-0000-0000-000000000201', now() - interval '1 day', now() - interval '10 hours', null),
  ('00000000-0000-0000-0000-000000009202', 'TKT-1002', '00000000-0000-0000-0000-000000000104', '00000000-0000-0000-0000-000000008004', 'Refund status for cancelled booking', 'resolved', 'high', '00000000-0000-0000-0000-000000000201', now() - interval '2 days', now() - interval '1 day', now() - interval '1 day')
on conflict do nothing;

insert into public.support_ticket_messages (id, ticket_id, sender_id, sender_type, message, attachments_jsonb, created_at)
values
  ('00000000-0000-0000-0000-000000009211', '00000000-0000-0000-0000-000000009201', '00000000-0000-0000-0000-000000000101', 'customer', 'Please confirm if one traveler can get a vegetarian menu.', '[]'::jsonb, now() - interval '1 day'),
  ('00000000-0000-0000-0000-000000009212', '00000000-0000-0000-0000-000000009201', '00000000-0000-0000-0000-000000000201', 'staff', 'Yes, we added your meal request to the operator note.', '[]'::jsonb, now() - interval '10 hours'),
  ('00000000-0000-0000-0000-000000009213', '00000000-0000-0000-0000-000000009202', '00000000-0000-0000-0000-000000000104', 'customer', 'Can you update the refund timeline for my cancelled booking?', '[]'::jsonb, now() - interval '2 days'),
  ('00000000-0000-0000-0000-000000009214', '00000000-0000-0000-0000-000000009202', '00000000-0000-0000-0000-000000000201', 'staff', 'Refund was approved and should appear in your account shortly.', '[]'::jsonb, now() - interval '1 day'),
  ('00000000-0000-0000-0000-000000009215', '00000000-0000-0000-0000-000000009202', null, 'system', 'Ticket marked as resolved.', '[]'::jsonb, now() - interval '1 day')
on conflict do nothing;

insert into public.activity_logs (id, actor_id, action, entity_type, entity_id, old_data, new_data, ip_address, created_at)
values
  ('00000000-0000-0000-0000-000000009301', '00000000-0000-0000-0000-000000000201', 'booking_confirmed', 'bookings', '00000000-0000-0000-0000-000000008001', '{"booking_status":"pending"}'::jsonb, '{"booking_status":"confirmed"}'::jsonb, '127.0.0.1', now() - interval '2 days'),
  ('00000000-0000-0000-0000-000000009302', '00000000-0000-0000-0000-000000000201', 'refund_approved', 'refunds', '00000000-0000-0000-0000-000000008801', '{"status":"pending"}'::jsonb, '{"status":"refunded"}'::jsonb, '127.0.0.1', now() - interval '1 day'),
  ('00000000-0000-0000-0000-000000009303', '00000000-0000-0000-0000-000000000301', 'coupon_created', 'coupons', '00000000-0000-0000-0000-000000007703', null, '{"code":"LUXURY7"}'::jsonb, '127.0.0.1', now() - interval '3 days'),
  ('00000000-0000-0000-0000-000000009304', '00000000-0000-0000-0000-000000000201', 'review_replied', 'reviews', '00000000-0000-0000-0000-000000009001', null, '{"reply_added":true}'::jsonb, '127.0.0.1', now() - interval '9 days'),
  ('00000000-0000-0000-0000-000000009305', '00000000-0000-0000-0000-000000000301', 'banner_updated', 'banners', '00000000-0000-0000-0000-000000009401', '{"title":"Old banner"}'::jsonb, '{"title":"Summer escapes"}'::jsonb, '127.0.0.1', now() - interval '4 days')
on conflict do nothing;

insert into public.banners (id, title, image_url, link_url, placement, sort_order, is_active, start_at, end_at)
values
  ('00000000-0000-0000-0000-000000009401', 'Summer escapes', 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1600&q=80', '/tours/phu-quoc-luxury-4n3d', 'home', 1, true, now() - interval '7 days', now() + interval '30 days'),
  ('00000000-0000-0000-0000-000000009402', 'Best seller weekend trips', 'https://images.unsplash.com/photo-1500375592092-40eb2168fd21?auto=format&fit=crop&w=1600&q=80', '/tours/ha-long-bay-cruise-3n2d', 'home', 2, true, now() - interval '7 days', now() + interval '45 days'),
  ('00000000-0000-0000-0000-000000009403', 'Culture and family favorites', 'https://images.unsplash.com/photo-1523050854058-8df90110c9f1?auto=format&fit=crop&w=1600&q=80', '/tours/da-nang-hoi-an-ba-na-4n3d', 'home', 3, true, now() - interval '7 days', now() + interval '45 days')
on conflict do nothing;

insert into public.cms_pages (id, slug, title, content, meta_title, meta_description, is_published, published_at, created_by, updated_by)
values
  ('00000000-0000-0000-0000-000000009501', 'about-us', 'About TourBook', 'TourBook helps travelers compare, book, and manage tours across Vietnam with transparent departures and live status updates.', 'About TourBook', 'Learn about TourBook and our travel mission.', true, now() - interval '15 days', '00000000-0000-0000-0000-000000000301', '00000000-0000-0000-0000-000000000301'),
  ('00000000-0000-0000-0000-000000009502', 'terms-and-conditions', 'Terms and Conditions', 'Booking terms, payment policies, cancellation conditions, and service commitments for TourBook.', 'Terms and Conditions', 'Booking terms and conditions for TourBook.', true, now() - interval '15 days', '00000000-0000-0000-0000-000000000301', '00000000-0000-0000-0000-000000000301'),
  ('00000000-0000-0000-0000-000000009503', 'privacy-policy', 'Privacy Policy', 'This page describes how personal and booking information is stored and processed in the TourBook system.', 'Privacy Policy', 'Privacy policy for TourBook users.', true, now() - interval '15 days', '00000000-0000-0000-0000-000000000301', '00000000-0000-0000-0000-000000000301')
on conflict do nothing;

insert into public.system_settings (id, setting_key, setting_value, description, updated_by)
values
  ('00000000-0000-0000-0000-000000009601', 'site_name', '"TourBook"'::jsonb, 'Display site name', '00000000-0000-0000-0000-000000000301'),
  ('00000000-0000-0000-0000-000000009602', 'default_currency', '"VND"'::jsonb, 'Base currency for pricing', '00000000-0000-0000-0000-000000000301'),
  ('00000000-0000-0000-0000-000000009603', 'support_hotline', '"1900 2345"'::jsonb, 'Customer support hotline', '00000000-0000-0000-0000-000000000301'),
  ('00000000-0000-0000-0000-000000009604', 'booking_hold_minutes', '30'::jsonb, 'Minutes to keep pending booking hold', '00000000-0000-0000-0000-000000000301')
on conflict do nothing;

update public.coupons c
set used_count = coalesce(u.total_used, 0)
from (
  select coupon_id, count(*)::integer as total_used
  from public.coupon_usages
  group by coupon_id
) u
where c.id = u.coupon_id;

drop function if exists public.seed_demo_user(uuid, text, text, text, text);

commit;


