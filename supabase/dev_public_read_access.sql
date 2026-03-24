-- Development helper: make public catalog tables readable by anon/authenticated.
-- Use this on DEV/TEST only.
-- If your app still shows empty data after seeding, run this file and hard refresh the app.

begin;

grant usage on schema public to anon, authenticated;

grant select on table
  public.tours,
  public.tour_images,
  public.tour_destinations,
  public.locations,
  public.categories,
  public.tour_categories,
  public.tags,
  public.tour_tags,
  public.departure_schedules,
  public.schedule_price_tiers,
  public.reviews,
  public.review_replies,
  public.profiles,
  public.banners,
  public.cms_pages,
  public.payment_methods,
  public.coupons,
  public.coupon_tours,
  public.coupon_categories,
  public.cancellation_policies,
  public.schedule_availability
to anon, authenticated;

alter table public.tours disable row level security;
alter table public.tour_images disable row level security;
alter table public.tour_destinations disable row level security;
alter table public.locations disable row level security;
alter table public.categories disable row level security;
alter table public.tour_categories disable row level security;
alter table public.tags disable row level security;
alter table public.tour_tags disable row level security;
alter table public.departure_schedules disable row level security;
alter table public.schedule_price_tiers disable row level security;
alter table public.reviews disable row level security;
alter table public.review_replies disable row level security;
alter table public.profiles disable row level security;
alter table public.banners disable row level security;
alter table public.cms_pages disable row level security;
alter table public.payment_methods disable row level security;
alter table public.coupons disable row level security;
alter table public.coupon_tours disable row level security;
alter table public.coupon_categories disable row level security;
alter table public.cancellation_policies disable row level security;

commit;
