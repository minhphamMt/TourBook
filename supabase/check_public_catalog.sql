-- Quick diagnostics for empty public pages.
-- Run in Supabase SQL Editor on the SAME project your app is pointing to.

select current_database() as database_name;

select
  'tours_published' as metric,
  count(*) as total
from public.tours
where status = 'published'
union all
select
  'reviews_approved' as metric,
  count(*) as total
from public.reviews
where status = 'approved'
union all
select
  'banners_active' as metric,
  count(*) as total
from public.banners
where is_active = true;

select
  schemaname,
  tablename,
  rowsecurity
from pg_tables
where schemaname = 'public'
  and tablename in (
    'tours',
    'tour_images',
    'tour_destinations',
    'locations',
    'categories',
    'tour_categories',
    'tags',
    'tour_tags',
    'departure_schedules',
    'schedule_price_tiers',
    'reviews',
    'review_replies',
    'profiles',
    'banners',
    'cms_pages',
    'payment_methods',
    'coupons',
    'coupon_tours',
    'coupon_categories',
    'cancellation_policies'
  )
order by tablename;
