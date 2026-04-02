-- Clean showcase seed for TourBook / The Horizon
-- Run after: supabase/reset_all_data.sql
-- Demo password for all seeded users: Demo@123456
-- Image URLs use Unsplash so they render with the current Next.js image config.

begin;

insert into public.roles (id, name, description)
values
  ('00000000-0000-0000-0000-000000000001', 'customer', 'Khách hàng đặt tour trên website.'),
  ('00000000-0000-0000-0000-000000000002', 'staff', 'Nhân sự vận hành, chăm sóc khách hàng và xử lý booking.'),
  ('00000000-0000-0000-0000-000000000003', 'admin', 'Quản trị viên quản lý nội dung và vận hành.'),
  ('00000000-0000-0000-0000-000000000004', 'super_admin', 'Toàn quyền cấu hình hệ thống và dữ liệu.');

insert into public.permissions (id, code, description)
values
  ('00000000-0000-0000-0000-000000000011', 'view_admin_dashboard', 'Xem dashboard quản trị.'),
  ('00000000-0000-0000-0000-000000000012', 'manage_tours', 'Quản lý tour và lịch khởi hành.'),
  ('00000000-0000-0000-0000-000000000013', 'manage_bookings', 'Quản lý booking và khách hàng.'),
  ('00000000-0000-0000-0000-000000000014', 'manage_payments', 'Quản lý thanh toán và hoàn tiền.'),
  ('00000000-0000-0000-0000-000000000015', 'manage_reviews', 'Duyệt và phản hồi đánh giá.'),
  ('00000000-0000-0000-0000-000000000016', 'manage_support', 'Xử lý ticket hỗ trợ.'),
  ('00000000-0000-0000-0000-000000000017', 'manage_content', 'Quản lý banner và CMS.'),
  ('00000000-0000-0000-0000-000000000018', 'manage_users', 'Quản lý hồ sơ và phân quyền.'),
  ('00000000-0000-0000-0000-000000000019', 'manage_settings', 'Cấu hình hệ thống.');

insert into public.role_permissions (role_id, permission_id)
select role_id, permission_id
from (
  values
    ('staff', 'view_admin_dashboard'),
    ('staff', 'manage_tours'),
    ('staff', 'manage_bookings'),
    ('staff', 'manage_payments'),
    ('staff', 'manage_reviews'),
    ('staff', 'manage_support'),
    ('admin', 'view_admin_dashboard'),
    ('admin', 'manage_tours'),
    ('admin', 'manage_bookings'),
    ('admin', 'manage_payments'),
    ('admin', 'manage_reviews'),
    ('admin', 'manage_support'),
    ('admin', 'manage_content'),
    ('admin', 'manage_users'),
    ('super_admin', 'view_admin_dashboard'),
    ('super_admin', 'manage_tours'),
    ('super_admin', 'manage_bookings'),
    ('super_admin', 'manage_payments'),
    ('super_admin', 'manage_reviews'),
    ('super_admin', 'manage_support'),
    ('super_admin', 'manage_content'),
    ('super_admin', 'manage_users'),
    ('super_admin', 'manage_settings')
) mappings(role_name, permission_code)
cross join lateral (
  select id as role_id from public.roles where lower(name) = mappings.role_name
) role_lookup
cross join lateral (
  select id as permission_id from public.permissions where lower(code) = mappings.permission_code
) permission_lookup;

insert into public.payment_methods (id, code, name, method_type, provider_name, description, settings_jsonb)
values
  ('00000000-0000-0000-0000-000000007001', 'vnpay', 'VNPay', 'gateway', 'VNPay', 'Thanh toán trực tuyến qua cổng VNPay.', '{"highlight": true}'::jsonb),
  ('00000000-0000-0000-0000-000000007002', 'momo', 'MoMo', 'gateway', 'MoMo', 'Ví điện tử MoMo cho thanh toán nhanh.', '{"highlight": true}'::jsonb),
  ('00000000-0000-0000-0000-000000007003', 'bank_transfer', 'Chuyển khoản ngân hàng', 'bank_transfer', 'Vietcombank', 'Chuyển khoản thủ công và xác nhận bởi nhân viên.', '{"bank_name": "Vietcombank", "account_no": "0123456789"}'::jsonb),
  ('00000000-0000-0000-0000-000000007004', 'cash', 'Giữ chỗ và thanh toán tại văn phòng', 'cash', 'The Horizon', 'Phù hợp với khách muốn tư vấn trực tiếp trước khi thanh toán.', '{}'::jsonb);

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

  if to_regclass('auth.identities') is not null then
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
  end if;

  return p_user_id;
end;
$$;
select public.seed_demo_user(
  '00000000-0000-0000-0000-000000000101',
  'anna.nguyen@tourbook.demo',
  'Demo@123456',
  'Anna Nguyễn',
  'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=400&q=80'
);

select public.seed_demo_user(
  '00000000-0000-0000-0000-000000000102',
  'minh.tran@tourbook.demo',
  'Demo@123456',
  'Minh Trần',
  'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=400&q=80'
);

select public.seed_demo_user(
  '00000000-0000-0000-0000-000000000103',
  'linh.pham@tourbook.demo',
  'Demo@123456',
  'Linh Phạm',
  'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=400&q=80'
);

select public.seed_demo_user(
  '00000000-0000-0000-0000-000000000104',
  'quan.le@tourbook.demo',
  'Demo@123456',
  'Quân Lê',
  'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=400&q=80'
);

select public.seed_demo_user(
  '00000000-0000-0000-0000-000000000201',
  'thao.staff@tourbook.demo',
  'Demo@123456',
  'Thảo Lê',
  'https://images.unsplash.com/photo-1488426862026-3ee34a7d66df?auto=format&fit=crop&w=400&q=80'
);

select public.seed_demo_user(
  '00000000-0000-0000-0000-000000000301',
  'huy.admin@tourbook.demo',
  'Demo@123456',
  'Huy Võ',
  'https://images.unsplash.com/photo-1502685104226-ee32379fefbe?auto=format&fit=crop&w=400&q=80'
);

update public.profiles
set
  phone = case id
    when '00000000-0000-0000-0000-000000000101' then '0909 111 101'
    when '00000000-0000-0000-0000-000000000102' then '0909 111 102'
    when '00000000-0000-0000-0000-000000000103' then '0909 111 103'
    when '00000000-0000-0000-0000-000000000104' then '0909 111 104'
    when '00000000-0000-0000-0000-000000000201' then '0909 111 201'
    when '00000000-0000-0000-0000-000000000301' then '0909 111 301'
    when '00000000-0000-0000-0000-000000000401' then '0909 111 401'
    else phone
  end,
  address = case id
    when '00000000-0000-0000-0000-000000000101' then 'Quận 3, TP. Hồ Chí Minh'
    when '00000000-0000-0000-0000-000000000102' then 'Quận Hải Châu, Đà Nẵng'
    when '00000000-0000-0000-0000-000000000103' then 'Quận Ba Đình, Hà Nội'
    when '00000000-0000-0000-0000-000000000104' then 'TP. Thủ Đức, TP. Hồ Chí Minh'
    when '00000000-0000-0000-0000-000000000201' then 'Quận Bình Thạnh, TP. Hồ Chí Minh'
    when '00000000-0000-0000-0000-000000000301' then 'Quận 1, TP. Hồ Chí Minh'
    when '00000000-0000-0000-0000-000000000401' then 'Quận 7, TP. Hồ Chí Minh'
    else address
  end,
  customer_level = case id
    when '00000000-0000-0000-0000-000000000101' then 'gold'
    when '00000000-0000-0000-0000-000000000102' then 'silver'
    when '00000000-0000-0000-0000-000000000103' then 'platinum'
    when '00000000-0000-0000-0000-000000000104' then 'gold'
    else customer_level
  end,
  updated_at = now();

delete from public.user_roles
where user_id in (
  '00000000-0000-0000-0000-000000000201',
  '00000000-0000-0000-0000-000000000301',
  '00000000-0000-0000-0000-000000000401'
);

insert into public.user_roles (user_id, role_id, assigned_by)
values
  ('00000000-0000-0000-0000-000000000201', '00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000401'),
  ('00000000-0000-0000-0000-000000000301', '00000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000401'),
  ('00000000-0000-0000-0000-000000000401', '00000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000401')
on conflict (user_id, role_id) do nothing;

insert into public.user_addresses (id, user_id, label, full_name, phone, address_line, province, district, ward, postal_code, country_code, is_default)
values
  ('00000000-0000-0000-0000-000000001101', '00000000-0000-0000-0000-000000000101', 'Nhà riêng', 'Anna Nguyễn', '0909 111 101', '28 Võ Văn Tần', 'TP. Hồ Chí Minh', 'Quận 3', 'Phường Võ Thị Sáu', '700000', 'VN', true),
  ('00000000-0000-0000-0000-000000001102', '00000000-0000-0000-0000-000000000102', 'Nhà riêng', 'Minh Trần', '0909 111 102', '102 Bạch Đằng', 'Đà Nẵng', 'Hải Châu', 'Phường Bình Hiên', '550000', 'VN', true),
  ('00000000-0000-0000-0000-000000001103', '00000000-0000-0000-0000-000000000103', 'Văn phòng', 'Linh Phạm', '0909 111 103', '19 Kim Mã', 'Hà Nội', 'Ba Đình', 'Phường Kim Mã', '100000', 'VN', true),
  ('00000000-0000-0000-0000-000000001104', '00000000-0000-0000-0000-000000000104', 'Nhà riêng', 'Quân Lê', '0909 111 104', '77 Xa lộ Hà Nội', 'TP. Hồ Chí Minh', 'TP. Thủ Đức', 'Phường An Phú', '700000', 'VN', true);

insert into public.saved_travelers (id, user_id, full_name, phone, email, date_of_birth, gender, id_number, passport_number, nationality, traveler_type, notes)
values
  ('00000000-0000-0000-0000-000000002101', '00000000-0000-0000-0000-000000000101', 'Anna Nguyễn', '0909 111 101', 'anna.nguyen@tourbook.demo', '1993-05-14', 'female', '079193000101', 'N1234501', 'Việt Nam', 'adult', 'Ưa phòng yên tĩnh, gần cửa sổ.'),
  ('00000000-0000-0000-0000-000000002102', '00000000-0000-0000-0000-000000000101', 'Gia Hân Nguyễn', '0909 111 101', 'anna.family@tourbook.demo', '2016-08-21', 'female', null, 'C1234501', 'Việt Nam', 'child', 'Bé thích suất ăn ít cay.'),
  ('00000000-0000-0000-0000-000000002103', '00000000-0000-0000-0000-000000000102', 'Minh Trần', '0909 111 102', 'minh.tran@tourbook.demo', '1990-11-02', 'male', '079190000102', 'M1234502', 'Việt Nam', 'adult', 'Cần hóa đơn công ty.'),
  ('00000000-0000-0000-0000-000000002104', '00000000-0000-0000-0000-000000000103', 'Linh Phạm', '0909 111 103', 'linh.pham@tourbook.demo', '1989-02-17', 'female', '079189000103', 'L1234503', 'Việt Nam', 'adult', 'Thích trải nghiệm wellness và yoga.'),
  ('00000000-0000-0000-0000-000000002105', '00000000-0000-0000-0000-000000000104', 'Quân Lê', '0909 111 104', 'quan.le@tourbook.demo', '1988-09-09', 'male', '079188000104', 'Q1234504', 'Việt Nam', 'adult', 'Ưu tiên chỗ ngồi phía trước xe.'),
  ('00000000-0000-0000-0000-000000002106', '00000000-0000-0000-0000-000000000104', 'Bảo Ngọc Lê', '0909 111 104', 'quan.family@tourbook.demo', '2017-01-12', 'female', null, 'QK123004', 'Việt Nam', 'child', 'Bé dị ứng đậu phộng.');
insert into public.locations (id, parent_id, name, slug, location_type, description, image_url, sort_order)
values
  ('00000000-0000-0000-0000-000000003001', null, 'Châu Á', 'chau-a', 'continent', 'Khu vực sôi động với nhịp sống hiện đại và nền văn hóa đa sắc màu.', 'https://images.unsplash.com/photo-1467269204594-9661b134dd2b?auto=format&fit=crop&w=1200&q=80', 1),
  ('00000000-0000-0000-0000-000000003002', null, 'Châu Âu', 'chau-au', 'continent', 'Nơi giao thoa của di sản, nghệ thuật và những hành trình đẳng cấp.', 'https://images.unsplash.com/photo-1491557345352-5929e343eb89?auto=format&fit=crop&w=1200&q=80', 2),
  ('00000000-0000-0000-0000-000000003003', null, 'Trung Đông', 'trung-dong', 'region', 'Vùng đất xa hoa với sa mạc, kiến trúc hiện đại và dịch vụ cao cấp.', 'https://images.unsplash.com/photo-1518684079-3c830dcef090?auto=format&fit=crop&w=1200&q=80', 3),
  ('00000000-0000-0000-0000-000000003004', '00000000-0000-0000-0000-000000003001', 'Việt Nam', 'viet-nam', 'country', 'Điểm đến đa trải nghiệm với biển xanh, ẩm thực và văn hóa bản địa phong phú.', 'https://images.unsplash.com/photo-1528127269322-539801943592?auto=format&fit=crop&w=1200&q=80', 10),
  ('00000000-0000-0000-0000-000000003005', '00000000-0000-0000-0000-000000003001', 'Indonesia', 'indonesia', 'country', 'Quốc đảo nổi tiếng với resort xanh và trải nghiệm nghỉ dưỡng cân bằng.', 'https://images.unsplash.com/photo-1537996194471-e657df975ab4?auto=format&fit=crop&w=1200&q=80', 11),
  ('00000000-0000-0000-0000-000000003006', '00000000-0000-0000-0000-000000003001', 'Nhật Bản', 'nhat-ban', 'country', 'Vẻ đẹp tinh tế giữa truyền thống và hiện đại, lý tưởng cho hành trình theo mùa.', 'https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?auto=format&fit=crop&w=1200&q=80', 12),
  ('00000000-0000-0000-0000-000000003007', '00000000-0000-0000-0000-000000003002', 'Thụy Sĩ', 'thuy-si', 'country', 'Thiên đường Alps với cảnh quan ngoạn mục, tàu toàn cảnh và khách sạn chuẩn mực.', 'https://images.unsplash.com/photo-1502602898657-3e91760cbb34?auto=format&fit=crop&w=1200&q=80', 20),
  ('00000000-0000-0000-0000-000000003008', '00000000-0000-0000-0000-000000003003', 'UAE', 'uae', 'country', 'Điểm đến sang trọng với skyline biểu tượng và trải nghiệm sa mạc đặc biệt.', 'https://images.unsplash.com/photo-1512453979798-5ea266f8880c?auto=format&fit=crop&w=1200&q=80', 30),
  ('00000000-0000-0000-0000-000000003010', '00000000-0000-0000-0000-000000003004', 'TP. Hồ Chí Minh', 'tp-ho-chi-minh', 'city', 'Trung tâm khởi hành năng động cho các hành trình quốc tế và cao cấp.', 'https://images.unsplash.com/photo-1583417319070-4a69db38a482?auto=format&fit=crop&w=1200&q=80', 100),
  ('00000000-0000-0000-0000-000000003011', '00000000-0000-0000-0000-000000003004', 'Hà Nội', 'ha-noi', 'city', 'Thủ đô thanh lịch với các tour văn hóa, lịch sử và khởi hành miền Bắc.', 'https://images.unsplash.com/photo-1509030450996-dd1a26dda07a?auto=format&fit=crop&w=1200&q=80', 101),
  ('00000000-0000-0000-0000-000000003012', '00000000-0000-0000-0000-000000003004', 'Vịnh Hạ Long', 'vinh-ha-long', 'bay', 'Biểu tượng du lịch biển Việt Nam với du thuyền sang trọng và vịnh đá vôi hùng vĩ.', 'https://images.unsplash.com/photo-1528127269322-539801943592?auto=format&fit=crop&w=1200&q=80', 102),
  ('00000000-0000-0000-0000-000000003013', '00000000-0000-0000-0000-000000003004', 'Phú Quốc', 'phu-quoc', 'island', 'Đảo ngọc thích hợp cho kỳ nghỉ riêng tư, hoàng hôn đẹp và resort biển.', 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1200&q=80', 103),
  ('00000000-0000-0000-0000-000000003014', '00000000-0000-0000-0000-000000003005', 'Bali', 'bali', 'island', 'Điểm đến nghỉ dưỡng mang tinh thần chữa lành với villa, biển và spa.', 'https://images.unsplash.com/photo-1537953773345-d172ccf13cf1?auto=format&fit=crop&w=1200&q=80', 104),
  ('00000000-0000-0000-0000-000000003015', '00000000-0000-0000-0000-000000003006', 'Kyoto', 'kyoto', 'city', 'Cố đô Nhật Bản nổi bật với lá đỏ, đền chùa và trải nghiệm văn hóa tinh tế.', 'https://images.unsplash.com/photo-1545569341-9eb8b30979d9?auto=format&fit=crop&w=1200&q=80', 105),
  ('00000000-0000-0000-0000-000000003016', '00000000-0000-0000-0000-000000003007', 'Zermatt', 'zermatt', 'mountain-town', 'Thị trấn biểu tượng của Alps, nơi mở ra tầm nhìn Matterhorn ngoạn mục.', 'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1200&q=80', 106),
  ('00000000-0000-0000-0000-000000003017', '00000000-0000-0000-0000-000000003008', 'Dubai', 'dubai', 'city', 'Thành phố của trải nghiệm xa hoa, shopping, ẩm thực và giải trí đẳng cấp.', 'https://images.unsplash.com/photo-1512453979798-5ea266f8880c?auto=format&fit=crop&w=1200&q=80', 107),
  ('00000000-0000-0000-0000-000000003018', '00000000-0000-0000-0000-000000003007', 'Lucerne', 'lucerne', 'city', 'Thành phố ven hồ dịu dàng, kết hợp hoàn hảo giữa cổ điển và nghỉ dưỡng.', 'https://images.unsplash.com/photo-1500534623283-312aade485b7?auto=format&fit=crop&w=1200&q=80', 108),
  ('00000000-0000-0000-0000-000000003019', '00000000-0000-0000-0000-000000003007', 'Interlaken', 'interlaken', 'city', 'Điểm dừng lý tưởng cho hành trình giữa hồ và núi tuyết Thụy Sĩ.', 'https://images.unsplash.com/photo-1501785888041-af3ef285b470?auto=format&fit=crop&w=1200&q=80', 109);

insert into public.categories (id, name, slug, description)
values
  ('00000000-0000-0000-0000-000000003101', 'Luxury Escape', 'luxury-escape', 'Những hành trình cao cấp với dịch vụ tinh tuyển.'),
  ('00000000-0000-0000-0000-000000003102', 'Beach Retreat', 'beach-retreat', 'Nghỉ dưỡng biển, resort đẹp và không gian thư giãn.'),
  ('00000000-0000-0000-0000-000000003103', 'Cultural Journey', 'cultural-journey', 'Tour giàu trải nghiệm văn hóa và câu chuyện địa phương.'),
  ('00000000-0000-0000-0000-000000003104', 'Family Friendly', 'family-friendly', 'Lịch trình cân bằng, phù hợp gia đình có trẻ nhỏ.'),
  ('00000000-0000-0000-0000-000000003105', 'Wellness', 'wellness', 'Hành trình phục hồi năng lượng và chăm sóc bản thân.'),
  ('00000000-0000-0000-0000-000000003106', 'Adventure Soft', 'adventure-soft', 'Khám phá vừa đủ, vẫn giữ nhịp nghỉ dưỡng thoải mái.');

insert into public.tags (id, name, slug)
values
  ('00000000-0000-0000-0000-000000003201', 'Bán chạy', 'ban-chay'),
  ('00000000-0000-0000-0000-000000003202', 'Honeymoon', 'honeymoon'),
  ('00000000-0000-0000-0000-000000003203', 'Nhóm nhỏ', 'nhom-nho'),
  ('00000000-0000-0000-0000-000000003204', 'Wellness', 'wellness'),
  ('00000000-0000-0000-0000-000000003205', 'Mùa hè', 'mua-he'),
  ('00000000-0000-0000-0000-000000003206', 'Check-in đẹp', 'check-in-dep'),
  ('00000000-0000-0000-0000-000000003207', 'Ẩm thực tinh chọn', 'am-thuc-tinh-chon'),
  ('00000000-0000-0000-0000-000000003208', 'Gia đình yêu thích', 'gia-dinh-yeu-thich');

insert into public.cancellation_policies (id, name, description, rules_jsonb)
values
  (
    '00000000-0000-0000-0000-000000004001',
    'Linh hoạt 7 ngày',
    'Phù hợp cho tour cao cấp, hoàn tiền tốt nếu khách hủy sớm.',
    '[{"days_before":30,"refund_percent":95},{"days_before":15,"refund_percent":70},{"days_before":7,"refund_percent":40},{"days_before":3,"refund_percent":20}]'::jsonb
  ),
  (
    '00000000-0000-0000-0000-000000004002',
    'Tiêu chuẩn 14 ngày',
    'Chính sách phổ biến cho tour ghép đoàn và tour ngắn ngày.',
    '[{"days_before":21,"refund_percent":90},{"days_before":14,"refund_percent":60},{"days_before":7,"refund_percent":30},{"days_before":3,"refund_percent":10}]'::jsonb
  );
insert into public.tours (
  id, slug, name, short_description, description, departure_location_id,
  duration_days, duration_nights, base_currency, is_featured,
  included_text, excluded_text, terms_text, important_notes,
  cancellation_policy_id, status, created_by, updated_by, published_at
)
values
  (
    '00000000-0000-0000-0000-000000005001',
    'hanh-trinh-thuy-si-alps',
    'Hành Trình Qua Dãy Alps: Thụy Sĩ Huyền Diệu',
    'Hành trình cao cấp qua Zermatt, Lucerne và Interlaken với tàu toàn cảnh, khách sạn đẹp và nhịp nghỉ dưỡng vừa vặn.',
    'Một chuyến đi dành cho những ai muốn ngắm trọn vẻ đẹp Thụy Sĩ trong trạng thái thư thái nhất. Bạn sẽ đi qua các hồ nước trong xanh, thị trấn vùng núi thanh lịch và những cung tàu đẹp bậc nhất châu Âu. Mọi điểm chạm từ khách sạn, ẩm thực đến nhịp di chuyển đều được chọn để tạo cảm giác tinh gọn nhưng vẫn thật đáng nhớ.',
    '00000000-0000-0000-0000-000000003010',
    8,
    7,
    'VND',
    true,
    'Vé máy bay khứ hồi tiêu chuẩn
Khách sạn 4 sao và 5 sao trung tâm
Bữa sáng hằng ngày và 4 bữa tối đặc sắc
Tàu ngắm cảnh Glacier Express và local pass
Hướng dẫn viên đồng hành từ Việt Nam',
    'Chi tiêu cá nhân
Phí làm hộ chiếu và visa
Nâng hạng vé máy bay theo yêu cầu
Đồ uống ngoài thực đơn kèm bữa chính',
    'Giá áp dụng cho khách khởi hành từ TP. Hồ Chí Minh
Cần hộ chiếu còn hạn trên 6 tháng
The Horizon giữ quyền điều chỉnh khách sạn tương đương khi cần',
    'Nên chuẩn bị áo khoác ấm và giày đi bộ chống trượt
Tour phù hợp cho cặp đôi, gia đình và nhóm bạn thích cảnh đẹp
Có thể thiết kế thêm dịch vụ chụp ảnh riêng tại Zermatt',
    '00000000-0000-0000-0000-000000004001',
    'published',
    '00000000-0000-0000-0000-000000000301',
    '00000000-0000-0000-0000-000000000301',
    now() - interval '25 days'
  ),
  (
    '00000000-0000-0000-0000-000000005002',
    'du-thuyen-ha-long-5-sao',
    'Du Thuyền Hạ Long 5 Sao 3 Ngày 2 Đêm',
    'Kỳ nghỉ ngắn ngày trên du thuyền sang trọng với lịch trình vừa chill vừa đẹp ảnh giữa di sản thiên nhiên thế giới.',
    'Tour Hạ Long này được thiết kế để lên hình đẹp, ăn ngon và nghỉ đúng nghĩa. Ban ngày là các điểm tham quan biểu tượng cùng hoạt động nhẹ nhàng như chèo kayak, ngắm hoàng hôn và lớp cooking class. Ban đêm là cabin rộng, boong tàu yên tĩnh và trải nghiệm bữa tối chỉn chu trên vịnh.',
    '00000000-0000-0000-0000-000000003011',
    3,
    2,
    'VND',
    true,
    'Xe đưa đón khứ hồi Hà Nội và Hạ Long
2 đêm du thuyền 5 sao cabin ban công
Tất cả bữa ăn theo lịch trình
Vé tham quan vịnh và kayak
Trà chiều và chương trình ngắm hoàng hôn',
    'Đồ uống gọi thêm tại quầy bar
Phụ thu phòng đơn
Chi phí spa và dịch vụ cá nhân
Tiền tip cho thủy thủ đoàn',
    'Khuyến nghị đặt trước tối thiểu 10 ngày
Chính sách trẻ em áp dụng theo năm sinh thực tế
Có thể chọn cabin cao cấp hơn với phụ thu',
    'Rất phù hợp cho cặp đôi hoặc gia đình muốn nghỉ cuối tuần thật đẹp
Lịch trình nhẹ và ít di chuyển
Có hỗ trợ set up kỷ niệm riêng trên boong tàu',
    '00000000-0000-0000-0000-000000004002',
    'published',
    '00000000-0000-0000-0000-000000000201',
    '00000000-0000-0000-0000-000000000201',
    now() - interval '18 days'
  ),
  (
    '00000000-0000-0000-0000-000000005003',
    'retreat-bali-thu-gian',
    'Bali Retreat: Sống Chậm Giữa Biển Xanh Và Villa Rừng Nhiệt Đới',
    'Hành trình wellness tinh tế kết hợp biển, spa, yoga và những khoảng nghỉ thực sự cho người cần nạp lại năng lượng.',
    'Bali luôn đẹp theo một cách rất mềm mại và giàu cảm hứng. Tour này đưa bạn đi qua những bãi biển dễ chịu, villa nhiều cây xanh và các trải nghiệm chữa lành có chọn lọc như yoga sáng, massage và bữa ăn lành mạnh. Mọi chi tiết đều ưu tiên cảm giác thư thái và riêng tư thay vì chạy theo lịch trình dày đặc.',
    '00000000-0000-0000-0000-000000003010',
    5,
    4,
    'VND',
    true,
    'Vé máy bay khứ hồi và hành lý ký gửi
4 đêm villa và resort 5 sao
2 buổi yoga nhẹ nhàng và 1 liệu trình spa
Xe riêng đón tiễn sân bay và di chuyển nội đảo
Bữa sáng hằng ngày cùng 2 bữa tối đặc biệt',
    'Chi tiêu cá nhân và đồ uống có cồn
Phí phụ thu lễ hội địa phương nếu phát sinh
Các hoạt động mạo hiểm tự chọn',
    'Phù hợp cho khách từ 12 tuổi trở lên
The Horizon có thể hỗ trợ honeymoon setup theo yêu cầu
Cần cung cấp hộ chiếu đúng chuẩn trước ngày khởi hành',
    'Nên chuẩn bị đồ bơi, kem chống nắng và trang phục nhẹ
Tour ưu tiên không gian riêng, phù hợp cặp đôi và nhóm bạn nữ
Có thể nối thêm 2 đêm Ubud nếu bạn muốn trải nghiệm sâu hơn',
    '00000000-0000-0000-0000-000000004001',
    'published',
    '00000000-0000-0000-0000-000000000301',
    '00000000-0000-0000-0000-000000000201',
    now() - interval '14 days'
  ),
  (
    '00000000-0000-0000-0000-000000005004',
    'kyoto-mua-la-do',
    'Kyoto Mùa Lá Đỏ: Di Sản, Trà Đạo Và Những Góc Phố Tĩnh Lặng',
    'Hành trình mùa thu chuẩn aesthetic với Kyoto, đền chùa, ryokan và những trải nghiệm văn hóa dịu dàng đúng tinh thần Nhật Bản.',
    'Kyoto đẹp nhất khi bạn đi chậm. Tour này tập trung vào những lớp trải nghiệm tinh tế như dạo đền vào buổi sớm, thưởng trà, ở ryokan và khám phá khu phố cổ bằng nhịp đi bộ thư thả. Đây là hành trình dành cho người thích cái đẹp kín đáo, giàu chiều sâu và muốn mang về nhiều xúc cảm hơn là danh sách check-in dày đặc.',
    '00000000-0000-0000-0000-000000003010',
    6,
    5,
    'VND',
    false,
    'Vé máy bay khứ hồi và tàu nhanh nội địa
3 đêm khách sạn trung tâm và 2 đêm ryokan
Vé tham quan các điểm chính theo lịch trình
1 buổi trải nghiệm trà đạo
Bữa sáng hằng ngày và 2 bữa tối Kaiseki',
    'Phụ phí phòng đơn
Chi tiêu cá nhân và mua sắm
Chi phí vận chuyển ngoài lịch trình riêng',
    'Cần chuẩn bị visa Nhật Bản trước ngày khởi hành
Lịch lá đỏ có thể thay đổi tùy thời tiết từng năm
Có thể nâng hạng phòng ryokan theo yêu cầu',
    'Rất phù hợp cho khách yêu văn hóa và chụp ảnh
Mức đi bộ mỗi ngày vừa phải
Ưu tiên trang phục gọn nhẹ và giày thoải mái',
    '00000000-0000-0000-0000-000000004001',
    'published',
    '00000000-0000-0000-0000-000000000201',
    '00000000-0000-0000-0000-000000000301',
    now() - interval '10 days'
  ),
  (
    '00000000-0000-0000-0000-000000005005',
    'dubai-xa-hoa',
    'Dubai Xa Hoa: Sa Mạc, Skyline Và Những Trải Nghiệm Không Giới Hạn',
    'Combo city break cao cấp với khách sạn sang, safari sa mạc, rooftop dinner và lịch trình vừa đủ để tận hưởng.',
    'Dubai mang tới cảm giác phóng khoáng và nhiều năng lượng. Hành trình này kết hợp giữa những điểm biểu tượng như Burj Khalifa, khu mua sắm lớn, beach club và một buổi safari sa mạc được dàn dựng chỉn chu. Đây là tour dành cho người thích trải nghiệm dịch vụ cao cấp, không gian hiện đại và mọi thứ đều sáng sủa, trơn tru.',
    '00000000-0000-0000-0000-000000003010',
    5,
    4,
    'VND',
    true,
    'Vé máy bay khứ hồi và hành lý ký gửi
4 đêm khách sạn 5 sao tại Downtown Dubai
Vé Burj Khalifa tầng quan sát
Safari sa mạc kèm dinner show
Xe đón tiễn và city tour nửa ngày',
    'Chi tiêu cá nhân
Mua sắm ngoài chương trình
Bảo hiểm du lịch mở rộng theo nhu cầu riêng',
    'Hộ chiếu cần còn hạn trên 6 tháng
Trang phục lịch sự cho một số điểm tham quan và bữa tối
Có thể nâng hạng phòng view đài phun nước',
    'Tour phù hợp khách thích mua sắm, nghỉ dưỡng ngắn ngày và trải nghiệm mới lạ
Mùa đẹp nhất từ tháng 10 đến tháng 3
Có thể thêm combo Abu Dhabi nếu đi nhóm riêng',
    '00000000-0000-0000-0000-000000004002',
    'published',
    '00000000-0000-0000-0000-000000000301',
    '00000000-0000-0000-0000-000000000301',
    now() - interval '8 days'
  ),
  (
    '00000000-0000-0000-0000-000000005006',
    'phu-quoc-sunset-retreat',
    'Phú Quốc Sunset Retreat: Kỳ Nghỉ Biển Êm Và Riêng Tư',
    'Kỳ nghỉ biển cân bằng giữa nghỉ dưỡng, vui chơi nhẹ và những buổi chiều ngắm hoàng hôn cực đẹp tại đảo ngọc.',
    'Đây là lựa chọn hoàn hảo khi bạn cần một kỳ nghỉ dễ chịu mà không phải bay quá xa. Tour đưa bạn đến resort ven biển, các bãi tắm đẹp, một ngày du ngoạn nhẹ nhàng và nhiều khoảng trống để tự tận hưởng hồ bơi, spa hoặc beach bar. Tổng thể hành trình nhẹ, gọn, phù hợp cho cặp đôi và gia đình trẻ.',
    '00000000-0000-0000-0000-000000003010',
    4,
    3,
    'VND',
    false,
    'Vé máy bay khứ hồi nội địa
3 đêm resort biển 5 sao
Ăn sáng hằng ngày và 1 bữa tối hải sản
Xe đưa đón sân bay và tham quan Nam đảo
Vé cáp treo Hòn Thơm',
    'Chi phí minibar và chi tiêu cá nhân
Các hoạt động thể thao nước tự chọn
Nâng hạng villa có hồ bơi riêng',
    'Có thể xuất vé từ Hà Nội hoặc TP. Hồ Chí Minh
Giá trẻ em áp dụng khi ngủ chung giường với bố mẹ
Nên đặt sớm vào mùa cao điểm hè',
    'Phù hợp nhất với khách tìm kỳ nghỉ thư giãn thật sự
Có thể thêm combo chụp ảnh sunset riêng
Ưu tiên kem chống nắng và dép đi biển thoải mái',
    '00000000-0000-0000-0000-000000004002',
    'published',
    '00000000-0000-0000-0000-000000000201',
    '00000000-0000-0000-0000-000000000201',
    now() - interval '5 days'
  );
insert into public.tour_destinations (tour_id, location_id, sort_order, is_primary)
values
  ('00000000-0000-0000-0000-000000005001', '00000000-0000-0000-0000-000000003016', 1, true),
  ('00000000-0000-0000-0000-000000005001', '00000000-0000-0000-0000-000000003018', 2, false),
  ('00000000-0000-0000-0000-000000005001', '00000000-0000-0000-0000-000000003019', 3, false),
  ('00000000-0000-0000-0000-000000005002', '00000000-0000-0000-0000-000000003012', 1, true),
  ('00000000-0000-0000-0000-000000005003', '00000000-0000-0000-0000-000000003014', 1, true),
  ('00000000-0000-0000-0000-000000005004', '00000000-0000-0000-0000-000000003015', 1, true),
  ('00000000-0000-0000-0000-000000005005', '00000000-0000-0000-0000-000000003017', 1, true),
  ('00000000-0000-0000-0000-000000005006', '00000000-0000-0000-0000-000000003013', 1, true);

insert into public.tour_categories (tour_id, category_id)
values
  ('00000000-0000-0000-0000-000000005001', '00000000-0000-0000-0000-000000003101'),
  ('00000000-0000-0000-0000-000000005001', '00000000-0000-0000-0000-000000003106'),
  ('00000000-0000-0000-0000-000000005002', '00000000-0000-0000-0000-000000003101'),
  ('00000000-0000-0000-0000-000000005002', '00000000-0000-0000-0000-000000003102'),
  ('00000000-0000-0000-0000-000000005002', '00000000-0000-0000-0000-000000003104'),
  ('00000000-0000-0000-0000-000000005003', '00000000-0000-0000-0000-000000003101'),
  ('00000000-0000-0000-0000-000000005003', '00000000-0000-0000-0000-000000003102'),
  ('00000000-0000-0000-0000-000000005003', '00000000-0000-0000-0000-000000003105'),
  ('00000000-0000-0000-0000-000000005004', '00000000-0000-0000-0000-000000003101'),
  ('00000000-0000-0000-0000-000000005004', '00000000-0000-0000-0000-000000003103'),
  ('00000000-0000-0000-0000-000000005005', '00000000-0000-0000-0000-000000003101'),
  ('00000000-0000-0000-0000-000000005005', '00000000-0000-0000-0000-000000003104'),
  ('00000000-0000-0000-0000-000000005006', '00000000-0000-0000-0000-000000003102'),
  ('00000000-0000-0000-0000-000000005006', '00000000-0000-0000-0000-000000003104'),
  ('00000000-0000-0000-0000-000000005006', '00000000-0000-0000-0000-000000003105');

insert into public.tour_tags (tour_id, tag_id)
values
  ('00000000-0000-0000-0000-000000005001', '00000000-0000-0000-0000-000000003201'),
  ('00000000-0000-0000-0000-000000005001', '00000000-0000-0000-0000-000000003202'),
  ('00000000-0000-0000-0000-000000005001', '00000000-0000-0000-0000-000000003206'),
  ('00000000-0000-0000-0000-000000005002', '00000000-0000-0000-0000-000000003201'),
  ('00000000-0000-0000-0000-000000005002', '00000000-0000-0000-0000-000000003208'),
  ('00000000-0000-0000-0000-000000005003', '00000000-0000-0000-0000-000000003204'),
  ('00000000-0000-0000-0000-000000005003', '00000000-0000-0000-0000-000000003202'),
  ('00000000-0000-0000-0000-000000005003', '00000000-0000-0000-0000-000000003206'),
  ('00000000-0000-0000-0000-000000005004', '00000000-0000-0000-0000-000000003203'),
  ('00000000-0000-0000-0000-000000005004', '00000000-0000-0000-0000-000000003206'),
  ('00000000-0000-0000-0000-000000005005', '00000000-0000-0000-0000-000000003201'),
  ('00000000-0000-0000-0000-000000005005', '00000000-0000-0000-0000-000000003207'),
  ('00000000-0000-0000-0000-000000005006', '00000000-0000-0000-0000-000000003205'),
  ('00000000-0000-0000-0000-000000005006', '00000000-0000-0000-0000-000000003208');
insert into public.tour_images (tour_id, image_url, alt_text, is_cover, sort_order)
values
  ('00000000-0000-0000-0000-000000005001', 'https://images.unsplash.com/photo-1501785888041-af3ef285b470?auto=format&fit=crop&w=1600&q=80', 'Khung cảnh núi Alps hùng vĩ', true, 1),
  ('00000000-0000-0000-0000-000000005001', 'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1200&q=80', 'Thị trấn vùng núi Thụy Sĩ', false, 2),
  ('00000000-0000-0000-0000-000000005001', 'https://images.unsplash.com/photo-1500534623283-312aade485b7?auto=format&fit=crop&w=1200&q=80', 'Tàu toàn cảnh băng qua vùng núi', false, 3),
  ('00000000-0000-0000-0000-000000005001', 'https://images.unsplash.com/photo-1516483638261-f4dbaf036963?auto=format&fit=crop&w=1200&q=80', 'Hồ nước xanh trong tại Thụy Sĩ', false, 4),

  ('00000000-0000-0000-0000-000000005002', 'https://images.unsplash.com/photo-1528127269322-539801943592?auto=format&fit=crop&w=1600&q=80', 'Du thuyền trên vịnh Hạ Long', true, 1),
  ('00000000-0000-0000-0000-000000005002', 'https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=1200&q=80', 'Cabin du thuyền cao cấp', false, 2),
  ('00000000-0000-0000-0000-000000005002', 'https://images.unsplash.com/photo-1500375592092-40eb2168fd21?auto=format&fit=crop&w=1200&q=80', 'Bữa tối trên boong tàu lãng mạn', false, 3),
  ('00000000-0000-0000-0000-000000005002', 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1200&q=80', 'Hoàng hôn trên mặt biển êm', false, 4),

  ('00000000-0000-0000-0000-000000005003', 'https://images.unsplash.com/photo-1537953773345-d172ccf13cf1?auto=format&fit=crop&w=1600&q=80', 'Biển xanh và resort tại Bali', true, 1),
  ('00000000-0000-0000-0000-000000005003', 'https://images.unsplash.com/photo-1519046904884-53103b34b206?auto=format&fit=crop&w=1200&q=80', 'Villa nhiệt đới giữa nhiều cây xanh', false, 2),
  ('00000000-0000-0000-0000-000000005003', 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=1200&q=80', 'Không gian yoga và thư giãn', false, 3),
  ('00000000-0000-0000-0000-000000005003', 'https://images.unsplash.com/photo-1501554728187-ce583db33af7?auto=format&fit=crop&w=1200&q=80', 'Bữa sáng nổi phong cách nghỉ dưỡng', false, 4);
insert into public.tour_images (tour_id, image_url, alt_text, is_cover, sort_order)
values
  ('00000000-0000-0000-0000-000000005004', 'https://images.unsplash.com/photo-1545569341-9eb8b30979d9?auto=format&fit=crop&w=1600&q=80', 'Đường phố Kyoto mùa lá đỏ', true, 1),
  ('00000000-0000-0000-0000-000000005004', 'https://images.unsplash.com/photo-1492571350019-22de08371fd3?auto=format&fit=crop&w=1200&q=80', 'Đền chùa Nhật Bản trong nắng sớm', false, 2),
  ('00000000-0000-0000-0000-000000005004', 'https://images.unsplash.com/photo-1528360983277-13d401cdc186?auto=format&fit=crop&w=1200&q=80', 'Phòng ryokan tinh tế', false, 3),
  ('00000000-0000-0000-0000-000000005004', 'https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?auto=format&fit=crop&w=1200&q=80', 'Tách trà và không gian văn hóa Kyoto', false, 4),

  ('00000000-0000-0000-0000-000000005005', 'https://images.unsplash.com/photo-1512453979798-5ea266f8880c?auto=format&fit=crop&w=1600&q=80', 'Skyline Dubai về đêm', true, 1),
  ('00000000-0000-0000-0000-000000005005', 'https://images.unsplash.com/photo-1518684079-3c830dcef090?auto=format&fit=crop&w=1200&q=80', 'Sa mạc và xe địa hình', false, 2),
  ('00000000-0000-0000-0000-000000005005', 'https://images.unsplash.com/photo-1499092346589-b9b6be3e94b2?auto=format&fit=crop&w=1200&q=80', 'Bữa tối rooftop sang trọng', false, 3),
  ('00000000-0000-0000-0000-000000005005', 'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1200&q=80', 'Hồ bơi khách sạn nhìn ra thành phố', false, 4),

  ('00000000-0000-0000-0000-000000005006', 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1600&q=80', 'Biển Phú Quốc xanh trong', true, 1),
  ('00000000-0000-0000-0000-000000005006', 'https://images.unsplash.com/photo-1518509562904-e7ef99cdcc86?auto=format&fit=crop&w=1200&q=80', 'Resort biển với hồ bơi đẹp', false, 2),
  ('00000000-0000-0000-0000-000000005006', 'https://images.unsplash.com/photo-1500534314209-a25ddb2bd429?auto=format&fit=crop&w=1200&q=80', 'Bữa tối hải sản bên bờ biển', false, 3),
  ('00000000-0000-0000-0000-000000005006', 'https://images.unsplash.com/photo-1500375592092-40eb2168fd21?auto=format&fit=crop&w=1200&q=80', 'Hoàng hôn biển vàng dịu', false, 4);
insert into public.tour_itinerary_days (tour_id, day_number, title, description, meals, accommodation, transportation)
values
  ('00000000-0000-0000-0000-000000005001', 1, 'Chào mừng đến Zurich', 'Đón đoàn tại sân bay, nhận phòng và dạo khu phố cổ trước bữa tối chào mừng.', '["Bữa tối"]'::jsonb, 'Khách sạn trung tâm Zurich', 'Xe riêng'),
  ('00000000-0000-0000-0000-000000005001', 2, 'Lucerne và hồ nước xanh', 'Di chuyển đến Lucerne, dạo cầu Chapel và lên du thuyền ngắm hồ.', '["Bữa sáng"]'::jsonb, 'Khách sạn ven hồ Lucerne', 'Tàu cao tốc'),
  ('00000000-0000-0000-0000-000000005001', 3, 'Đỉnh Pilatus', 'Trải nghiệm cáp treo và tàu răng cưa, ngắm trọn phong cảnh Alps mùa đẹp.', '["Bữa sáng"]'::jsonb, 'Khách sạn ven hồ Lucerne', 'Cáp treo và tàu leo núi'),
  ('00000000-0000-0000-0000-000000005001', 4, 'Interlaken giữa hai hồ', 'Khám phá Interlaken, tự do chụp ảnh và uống cà phê với view núi tuyết.', '["Bữa sáng","Bữa tối"]'::jsonb, 'Boutique hotel tại Interlaken', 'Tàu ngắm cảnh'),
  ('00000000-0000-0000-0000-000000005001', 5, 'Làng Grindelwald', 'Ngày nhẹ nhàng tại Grindelwald với các điểm ngắm cảnh đẹp và thời gian tự do.', '["Bữa sáng"]'::jsonb, 'Boutique hotel tại Interlaken', 'Xe riêng'),
  ('00000000-0000-0000-0000-000000005001', 6, 'Glacier Express đến Zermatt', 'Hành trình tàu toàn cảnh đẹp nhất tour, check in với những khung hình biểu tượng.', '["Bữa sáng"]'::jsonb, 'Mountain lodge tại Zermatt', 'Glacier Express'),
  ('00000000-0000-0000-0000-000000005001', 7, 'Matterhorn và thời gian riêng', 'Tự do mua sắm, chụp ảnh và thưởng thức bữa tối chia tay ở thị trấn vùng núi.', '["Bữa sáng","Bữa tối"]'::jsonb, 'Mountain lodge tại Zermatt', 'Đi bộ và tàu nội vùng'),
  ('00000000-0000-0000-0000-000000005001', 8, 'Tạm biệt Thụy Sĩ', 'Ra sân bay theo lịch bay, kết thúc hành trình với nhiều ảnh đẹp và trải nghiệm trọn vẹn.', '["Bữa sáng"]'::jsonb, null, 'Tàu và xe riêng'),

  ('00000000-0000-0000-0000-000000005002', 1, 'Rời Hà Nội đến bến du thuyền', 'Đón khách tại Hà Nội, nhận cabin, ăn trưa và bắt đầu hải trình ngắm vịnh.', '["Bữa trưa","Bữa tối"]'::jsonb, 'Du thuyền 5 sao', 'Xe limousine'),
  ('00000000-0000-0000-0000-000000005002', 2, 'Kayak và hoàng hôn trên vịnh', 'Tham quan hang, chèo kayak nhẹ và thư giãn với sunset party trên boong tàu.', '["Bữa sáng","Bữa trưa","Bữa tối"]'::jsonb, 'Du thuyền 5 sao', 'Tender boat'),
  ('00000000-0000-0000-0000-000000005002', 3, 'Bữa sáng giữa di sản', 'Ngắm bình minh, ăn sáng rồi trở về Hà Nội vào đầu giờ chiều.', '["Bữa sáng","Brunch"]'::jsonb, null, 'Xe limousine'),

  ('00000000-0000-0000-0000-000000005003', 1, 'Đến Bali và về villa', 'Đón sân bay, nghỉ ngơi tại villa riêng và thưởng thức bữa tối nhẹ nhàng.', '["Bữa tối"]'::jsonb, 'Villa xanh tại Seminyak', 'Xe riêng'),
  ('00000000-0000-0000-0000-000000005003', 2, 'Yoga sáng và beach club', 'Bắt đầu bằng yoga mềm, sau đó tự do nghỉ biển và ngắm hoàng hôn.', '["Bữa sáng"]'::jsonb, 'Villa xanh tại Seminyak', 'Xe riêng'),
  ('00000000-0000-0000-0000-000000005003', 3, 'Spa và Ubud thư thái', 'Liệu trình spa phục hồi, ghé Ubud và trải nghiệm không gian nhiều cây xanh.', '["Bữa sáng","Bữa tối"]'::jsonb, 'Resort nghỉ dưỡng tại Ubud', 'Xe riêng'),
  ('00000000-0000-0000-0000-000000005003', 4, 'Ngày sống chậm', 'Tự do tận hưởng hồ bơi, cafe đẹp và những khoảng nghỉ đúng nghĩa.', '["Bữa sáng"]'::jsonb, 'Resort nghỉ dưỡng tại Ubud', 'Tự do'),
  ('00000000-0000-0000-0000-000000005003', 5, 'Tạm biệt đảo ngọc', 'Bữa sáng thong thả và ra sân bay theo giờ bay về Việt Nam.', '["Bữa sáng"]'::jsonb, null, 'Xe riêng');
insert into public.tour_itinerary_days (tour_id, day_number, title, description, meals, accommodation, transportation)
values
  ('00000000-0000-0000-0000-000000005004', 1, 'Bay đến Osaka và về Kyoto', 'Đón sân bay, chuyển về Kyoto và tản bộ nhẹ ở Gion khi phố vừa lên đèn.', '["Bữa tối"]'::jsonb, 'Khách sạn boutique tại Kyoto', 'Xe riêng'),
  ('00000000-0000-0000-0000-000000005004', 2, 'Đền cổ và lá đỏ', 'Tham quan đền nổi tiếng vào sáng sớm, buổi chiều tự do săn ảnh mùa thu.', '["Bữa sáng"]'::jsonb, 'Khách sạn boutique tại Kyoto', 'Xe và đi bộ'),
  ('00000000-0000-0000-0000-000000005004', 3, 'Trà đạo và phố cổ', 'Buổi trà đạo riêng, sau đó khám phá các con phố nhỏ mang nét Kyoto nguyên bản.', '["Bữa sáng"]'::jsonb, 'Ryokan truyền thống', 'Đi bộ'),
  ('00000000-0000-0000-0000-000000005004', 4, 'Arashiyama yên bình', 'Dạo rừng tre, ngắm sông và thưởng thức bữa tối Kaiseki tinh tế.', '["Bữa sáng","Bữa tối"]'::jsonb, 'Ryokan truyền thống', 'Tàu nội đô'),
  ('00000000-0000-0000-0000-000000005004', 5, 'Tự do mua sắm và cafe', 'Ngày thảnh thơi để chọn quà, ghé cafe đẹp hoặc chụp ảnh cặp đôi.', '["Bữa sáng"]'::jsonb, 'Khách sạn boutique tại Kyoto', 'Tự do'),
  ('00000000-0000-0000-0000-000000005004', 6, 'Trở về Việt Nam', 'Ra sân bay và kết thúc hành trình mùa thu đầy cảm xúc.', '["Bữa sáng"]'::jsonb, null, 'Xe riêng'),

  ('00000000-0000-0000-0000-000000005005', 1, 'Đến Dubai', 'Check in khách sạn trung tâm, nghỉ ngơi và ngắm skyline về đêm.', '["Bữa tối"]'::jsonb, 'Khách sạn 5 sao Downtown', 'Xe riêng'),
  ('00000000-0000-0000-0000-000000005005', 2, 'Burj Khalifa và city icons', 'Tham quan khu trung tâm, lên đài quan sát và dùng bữa tại nhà hàng có view đẹp.', '["Bữa sáng"]'::jsonb, 'Khách sạn 5 sao Downtown', 'Xe riêng'),
  ('00000000-0000-0000-0000-000000005005', 3, 'Safari sa mạc', 'Buổi sáng tự do mua sắm, chiều đi safari và thưởng thức dinner show trong sa mạc.', '["Bữa sáng","Bữa tối"]'::jsonb, 'Khách sạn 5 sao Downtown', 'Xe 4x4'),
  ('00000000-0000-0000-0000-000000005005', 4, 'Beach club và thư giãn', 'Dành trọn ngày cho nghỉ dưỡng, beach club hoặc spa tùy sở thích.', '["Bữa sáng"]'::jsonb, 'Khách sạn 5 sao Downtown', 'Tự do'),
  ('00000000-0000-0000-0000-000000005005', 5, 'Kết thúc city break', 'Ra sân bay và kết thúc kỳ nghỉ ngắn ngày đầy năng lượng.', '["Bữa sáng"]'::jsonb, null, 'Xe riêng'),

  ('00000000-0000-0000-0000-000000005006', 1, 'Chạm biển Phú Quốc', 'Bay đến đảo ngọc, nhận phòng resort và thư giãn bên hồ bơi hoặc biển riêng.', '["Bữa tối"]'::jsonb, 'Resort biển 5 sao', 'Máy bay và xe riêng'),
  ('00000000-0000-0000-0000-000000005006', 2, 'Nam đảo và cáp treo', 'Khám phá Nam đảo, đi cáp treo và chụp ảnh biển trời trong trẻo.', '["Bữa sáng"]'::jsonb, 'Resort biển 5 sao', 'Xe riêng'),
  ('00000000-0000-0000-0000-000000005006', 3, 'Ngày nghỉ dưỡng tự do', 'Tự do spa, hồ bơi hoặc thưởng thức hải sản và ngắm hoàng hôn bên bờ biển.', '["Bữa sáng","Bữa tối"]'::jsonb, 'Resort biển 5 sao', 'Tự do'),
  ('00000000-0000-0000-0000-000000005006', 4, 'Trở về thành phố', 'Ăn sáng chậm, mua quà và ra sân bay kết thúc kỳ nghỉ.', '["Bữa sáng"]'::jsonb, null, 'Xe riêng');
insert into public.departure_schedules (
  id, tour_id, departure_date, return_date, meeting_point, meeting_at, capacity, cutoff_at, status, currency, notes, created_by, updated_by
)
values
  ('00000000-0000-0000-0000-000000006001', '00000000-0000-0000-0000-000000005001', '2026-06-12', '2026-06-19', 'Sân bay Tân Sơn Nhất', '2026-06-12 05:30:00+07', 18, '2026-06-01 23:59:00+07', 'open', 'VND', 'Đoàn đẹp cho mùa hè, số chỗ giới hạn.', '00000000-0000-0000-0000-000000000301', '00000000-0000-0000-0000-000000000301'),
  ('00000000-0000-0000-0000-000000006002', '00000000-0000-0000-0000-000000005001', '2025-12-05', '2025-12-12', 'Sân bay Tân Sơn Nhất', '2025-12-05 05:30:00+07', 18, '2025-11-24 23:59:00+07', 'completed', 'VND', 'Đoàn mùa tuyết đã hoàn thành xuất sắc.', '00000000-0000-0000-0000-000000000301', '00000000-0000-0000-0000-000000000301'),
  ('00000000-0000-0000-0000-000000006003', '00000000-0000-0000-0000-000000005002', '2026-05-22', '2026-05-24', 'Nhà hát lớn Hà Nội', '2026-05-22 07:00:00+07', 30, '2026-05-18 23:59:00+07', 'open', 'VND', 'Cabin đẹp đang bán nhanh.', '00000000-0000-0000-0000-000000000201', '00000000-0000-0000-0000-000000000201'),
  ('00000000-0000-0000-0000-000000006004', '00000000-0000-0000-0000-000000005002', '2025-11-14', '2025-11-16', 'Nhà hát lớn Hà Nội', '2025-11-14 07:00:00+07', 30, '2025-11-10 23:59:00+07', 'completed', 'VND', 'Đoàn đã có phản hồi rất tốt.', '00000000-0000-0000-0000-000000000201', '00000000-0000-0000-0000-000000000201'),
  ('00000000-0000-0000-0000-000000006005', '00000000-0000-0000-0000-000000005003', '2026-07-08', '2026-07-12', 'Sân bay Tân Sơn Nhất', '2026-07-08 06:00:00+07', 16, '2026-06-28 23:59:00+07', 'open', 'VND', 'Wellness retreat rất phù hợp mùa hè.', '00000000-0000-0000-0000-000000000301', '00000000-0000-0000-0000-000000000201'),
  ('00000000-0000-0000-0000-000000006006', '00000000-0000-0000-0000-000000005003', '2025-10-09', '2025-10-13', 'Sân bay Tân Sơn Nhất', '2025-10-09 06:00:00+07', 16, '2025-09-28 23:59:00+07', 'completed', 'VND', 'Đoàn hồi phục và nghỉ dưỡng rất được yêu thích.', '00000000-0000-0000-0000-000000000301', '00000000-0000-0000-0000-000000000201'),
  ('00000000-0000-0000-0000-000000006007', '00000000-0000-0000-0000-000000005004', '2026-11-18', '2026-11-23', 'Sân bay Tân Sơn Nhất', '2026-11-18 06:30:00+07', 20, '2026-11-05 23:59:00+07', 'open', 'VND', 'Khởi hành đẹp cho mùa lá đỏ.', '00000000-0000-0000-0000-000000000201', '00000000-0000-0000-0000-000000000301'),
  ('00000000-0000-0000-0000-000000006008', '00000000-0000-0000-0000-000000005004', '2025-11-20', '2025-11-25', 'Sân bay Tân Sơn Nhất', '2025-11-20 06:30:00+07', 20, '2025-11-07 23:59:00+07', 'completed', 'VND', 'Đoàn mùa thu có tỷ lệ hài lòng rất cao.', '00000000-0000-0000-0000-000000000201', '00000000-0000-0000-0000-000000000301'),
  ('00000000-0000-0000-0000-000000006009', '00000000-0000-0000-0000-000000005005', '2026-09-10', '2026-09-14', 'Sân bay Tân Sơn Nhất', '2026-09-10 07:00:00+07', 24, '2026-08-30 23:59:00+07', 'open', 'VND', 'City break cao cấp đang được quan tâm nhiều.', '00000000-0000-0000-0000-000000000301', '00000000-0000-0000-0000-000000000301'),
  ('00000000-0000-0000-0000-000000006010', '00000000-0000-0000-0000-000000005005', '2025-12-18', '2025-12-22', 'Sân bay Tân Sơn Nhất', '2025-12-18 07:00:00+07', 24, '2025-12-08 23:59:00+07', 'completed', 'VND', 'Đoàn cuối năm đã full sớm.', '00000000-0000-0000-0000-000000000301', '00000000-0000-0000-0000-000000000301'),
  ('00000000-0000-0000-0000-000000006011', '00000000-0000-0000-0000-000000005006', '2026-06-27', '2026-06-30', 'Sân bay Tân Sơn Nhất', '2026-06-27 08:00:00+07', 26, '2026-06-20 23:59:00+07', 'open', 'VND', 'Lịch đẹp cho gia đình và cặp đôi.', '00000000-0000-0000-0000-000000000201', '00000000-0000-0000-0000-000000000201'),
  ('00000000-0000-0000-0000-000000006012', '00000000-0000-0000-0000-000000005006', '2025-08-21', '2025-08-24', 'Sân bay Tân Sơn Nhất', '2025-08-21 08:00:00+07', 26, '2025-08-14 23:59:00+07', 'completed', 'VND', 'Đoàn hè có nhiều gia đình nhỏ tham gia.', '00000000-0000-0000-0000-000000000201', '00000000-0000-0000-0000-000000000201');
insert into public.schedule_price_tiers (schedule_id, traveler_type, age_from, age_to, price, sale_price, currency)
values
  ('00000000-0000-0000-0000-000000006001', 'adult', 12, 99, 45500000, 42900000, 'VND'),
  ('00000000-0000-0000-0000-000000006001', 'child', 2, 11, 38900000, 35900000, 'VND'),
  ('00000000-0000-0000-0000-000000006001', 'infant', 0, 1, 12500000, 9900000, 'VND'),
  ('00000000-0000-0000-0000-000000006002', 'adult', 12, 99, 44500000, 41900000, 'VND'),
  ('00000000-0000-0000-0000-000000006002', 'child', 2, 11, 37900000, 34900000, 'VND'),
  ('00000000-0000-0000-0000-000000006002', 'infant', 0, 1, 11900000, 9500000, 'VND'),
  ('00000000-0000-0000-0000-000000006003', 'adult', 12, 99, 6900000, 6200000, 'VND'),
  ('00000000-0000-0000-0000-000000006003', 'child', 2, 11, 5200000, 4800000, 'VND'),
  ('00000000-0000-0000-0000-000000006003', 'infant', 0, 1, 1900000, 1500000, 'VND'),
  ('00000000-0000-0000-0000-000000006004', 'adult', 12, 99, 6500000, 6000000, 'VND'),
  ('00000000-0000-0000-0000-000000006004', 'child', 2, 11, 5000000, 4500000, 'VND'),
  ('00000000-0000-0000-0000-000000006004', 'infant', 0, 1, 1700000, 1400000, 'VND'),
  ('00000000-0000-0000-0000-000000006005', 'adult', 12, 99, 31000000, 28500000, 'VND'),
  ('00000000-0000-0000-0000-000000006005', 'child', 2, 11, 26800000, 24500000, 'VND'),
  ('00000000-0000-0000-0000-000000006005', 'infant', 0, 1, 9800000, 8200000, 'VND'),
  ('00000000-0000-0000-0000-000000006006', 'adult', 12, 99, 29800000, 27400000, 'VND'),
  ('00000000-0000-0000-0000-000000006006', 'child', 2, 11, 25500000, 23200000, 'VND'),
  ('00000000-0000-0000-0000-000000006006', 'infant', 0, 1, 9400000, 7900000, 'VND');
insert into public.schedule_price_tiers (schedule_id, traveler_type, age_from, age_to, price, sale_price, currency)
values
  ('00000000-0000-0000-0000-000000006007', 'adult', 12, 99, 26000000, 24500000, 'VND'),
  ('00000000-0000-0000-0000-000000006007', 'child', 2, 11, 21900000, 20500000, 'VND'),
  ('00000000-0000-0000-0000-000000006007', 'infant', 0, 1, 8500000, 6900000, 'VND'),
  ('00000000-0000-0000-0000-000000006008', 'adult', 12, 99, 24800000, 23200000, 'VND'),
  ('00000000-0000-0000-0000-000000006008', 'child', 2, 11, 20800000, 19400000, 'VND'),
  ('00000000-0000-0000-0000-000000006008', 'infant', 0, 1, 7900000, 6500000, 'VND'),
  ('00000000-0000-0000-0000-000000006009', 'adult', 12, 99, 33500000, 31900000, 'VND'),
  ('00000000-0000-0000-0000-000000006009', 'child', 2, 11, 27900000, 26400000, 'VND'),
  ('00000000-0000-0000-0000-000000006009', 'infant', 0, 1, 9900000, 8200000, 'VND'),
  ('00000000-0000-0000-0000-000000006010', 'adult', 12, 99, 32000000, 30500000, 'VND'),
  ('00000000-0000-0000-0000-000000006010', 'child', 2, 11, 26500000, 24900000, 'VND'),
  ('00000000-0000-0000-0000-000000006010', 'infant', 0, 1, 9500000, 7800000, 'VND'),
  ('00000000-0000-0000-0000-000000006011', 'adult', 12, 99, 12500000, 11200000, 'VND'),
  ('00000000-0000-0000-0000-000000006011', 'child', 2, 11, 9800000, 8700000, 'VND'),
  ('00000000-0000-0000-0000-000000006011', 'infant', 0, 1, 3200000, 2500000, 'VND'),
  ('00000000-0000-0000-0000-000000006012', 'adult', 12, 99, 11900000, 10600000, 'VND'),
  ('00000000-0000-0000-0000-000000006012', 'child', 2, 11, 9300000, 8200000, 'VND'),
  ('00000000-0000-0000-0000-000000006012', 'infant', 0, 1, 3000000, 2300000, 'VND');
insert into public.coupons (
  id, code, name, description, discount_type, discount_value, min_order_amount, max_discount_amount,
  start_at, end_at, usage_limit, usage_per_user_limit, used_count, is_active, created_by
)
values
  ('00000000-0000-0000-0000-000000006101', 'HORIZON10', 'Giảm 10% hành trình cao cấp', 'Áp dụng cho các tour luxury và honeymoon được chọn.', 'percentage', 10, 10000000, 3000000, '2026-01-01 00:00:00+07', '2026-12-31 23:59:00+07', 200, 2, 2, true, '00000000-0000-0000-0000-000000000301'),
  ('00000000-0000-0000-0000-000000006102', 'SUMMER500', 'Giảm 500.000đ mùa hè', 'Ưu đãi nhanh cho lịch biển và nghỉ dưỡng trong nước.', 'fixed_amount', 500000, 5000000, null, '2026-04-01 00:00:00+07', '2026-09-30 23:59:00+07', 300, 3, 1, true, '00000000-0000-0000-0000-000000000201'),
  ('00000000-0000-0000-0000-000000006103', 'FAMILY1500', 'Ưu đãi gia đình 1.500.000đ', 'Dành cho booking gia đình có giá trị từ 20 triệu đồng.', 'fixed_amount', 1500000, 20000000, null, '2026-01-01 00:00:00+07', '2026-12-31 23:59:00+07', 150, 1, 0, true, '00000000-0000-0000-0000-000000000301');

insert into public.coupon_categories (coupon_id, category_id)
values
  ('00000000-0000-0000-0000-000000006101', '00000000-0000-0000-0000-000000003101'),
  ('00000000-0000-0000-0000-000000006103', '00000000-0000-0000-0000-000000003104');

insert into public.coupon_tours (coupon_id, tour_id)
values
  ('00000000-0000-0000-0000-000000006102', '00000000-0000-0000-0000-000000005002'),
  ('00000000-0000-0000-0000-000000006102', '00000000-0000-0000-0000-000000005006');

insert into public.banners (id, title, image_url, link_url, placement, sort_order, is_active, start_at, end_at)
values
  ('00000000-0000-0000-0000-000000006201', 'Bộ sưu tập mùa hè 2026', 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1800&q=80', '/tours', 'home_hero', 1, true, '2026-01-01 00:00:00+07', '2026-12-31 23:59:00+07'),
  ('00000000-0000-0000-0000-000000006202', 'Khởi hành đẹp cho Thụy Sĩ', 'https://images.unsplash.com/photo-1501785888041-af3ef285b470?auto=format&fit=crop&w=1800&q=80', '/tours/hanh-trinh-thuy-si-alps', 'home_secondary', 2, true, '2026-01-01 00:00:00+07', '2026-12-31 23:59:00+07'),
  ('00000000-0000-0000-0000-000000006203', 'Wellness tại Bali', 'https://images.unsplash.com/photo-1537953773345-d172ccf13cf1?auto=format&fit=crop&w=1800&q=80', '/tours/retreat-bali-thu-gian', 'home_secondary', 3, true, '2026-01-01 00:00:00+07', '2026-12-31 23:59:00+07');

insert into public.cms_pages (id, slug, title, content, meta_title, meta_description, is_published, published_at, created_by, updated_by)
values
  ('00000000-0000-0000-0000-000000006301', 'about-us', 'Về The Horizon', 'The Horizon xây dựng những hành trình có gu, có nhịp nghỉ hợp lý và chú trọng chất lượng từng điểm chạm. Chúng tôi tin rằng du lịch đẹp là khi mọi thứ vận hành nhẹ nhàng để khách có thể thật sự tận hưởng.', 'Về The Horizon', 'Câu chuyện thương hiệu The Horizon và triết lý thiết kế hành trình.', true, now() - interval '20 days', '00000000-0000-0000-0000-000000000301', '00000000-0000-0000-0000-000000000301'),
  ('00000000-0000-0000-0000-000000006302', 'privacy-policy', 'Chính sách bảo mật', 'Chúng tôi chỉ thu thập thông tin cần thiết để tư vấn, xác nhận dịch vụ và chăm sóc khách hàng. Mọi dữ liệu cá nhân đều được lưu trữ có kiểm soát trong môi trường nội bộ của hệ thống.', 'Chính sách bảo mật | The Horizon', 'Thông tin về cách The Horizon thu thập và bảo vệ dữ liệu khách hàng.', true, now() - interval '20 days', '00000000-0000-0000-0000-000000000301', '00000000-0000-0000-0000-000000000301'),
  ('00000000-0000-0000-0000-000000006303', 'terms-and-conditions', 'Điều khoản dịch vụ', 'Khi xác nhận booking, khách đồng ý với điều kiện thanh toán, chính sách hủy và quy định sử dụng dịch vụ được nêu trên từng tour. The Horizon luôn ưu tiên giải pháp rõ ràng và minh bạch trong mọi tình huống phát sinh.', 'Điều khoản dịch vụ | The Horizon', 'Điều khoản sử dụng dịch vụ và xác nhận booking của The Horizon.', true, now() - interval '20 days', '00000000-0000-0000-0000-000000000301', '00000000-0000-0000-0000-000000000301');

insert into public.system_settings (id, setting_key, setting_value, description, updated_by)
values
  ('00000000-0000-0000-0000-000000006401', 'booking_hold_minutes', '30'::jsonb, 'Số phút giữ chỗ cho booking chờ thanh toán.', '00000000-0000-0000-0000-000000000301'),
  ('00000000-0000-0000-0000-000000006402', 'contact_hotline', '"1900 1234"'::jsonb, 'Hotline hiển thị trên website.', '00000000-0000-0000-0000-000000000301'),
  ('00000000-0000-0000-0000-000000006403', 'homepage_hero_badge', '"Bộ sưu tập hành trình đẹp 2026"'::jsonb, 'Badge hiển thị ở phần hero của trang chủ.', '00000000-0000-0000-0000-000000000301');
insert into public.bookings (
  id, booking_code, user_id, tour_id, schedule_id,
  contact_name, contact_phone, contact_email,
  adult_count, child_count, infant_count,
  subtotal_amount, discount_amount, tax_amount, service_fee_amount, total_amount,
  currency, booking_status, payment_status,
  expires_at, confirmed_at, completed_at, cancelled_at, cancel_reason, customer_note,
  snapshot_jsonb, created_at, updated_at
)
values
  (
    '00000000-0000-0000-0000-000000009001', 'HZ-1001', '00000000-0000-0000-0000-000000000101', '00000000-0000-0000-0000-000000005001', '00000000-0000-0000-0000-000000006001',
    'Anna Nguyễn', '0909 111 101', 'anna.nguyen@tourbook.demo',
    2, 0, 0,
    85800000, 3000000, 0, 0, 82800000,
    'VND', 'confirmed', 'paid',
    null, '2026-03-12 10:15:00+07', null, null, null, 'Muốn phòng có view đẹp và ít tiếng ồn.',
    '{"tour_name":"Hành Trình Qua Dãy Alps: Thụy Sĩ Huyền Diệu","tour_slug":"hanh-trinh-thuy-si-alps","departure_date":"2026-06-12","selected_payment_method":"vnpay"}'::jsonb,
    '2026-03-10 09:00:00+07', '2026-03-12 10:15:00+07'
  ),
  (
    '00000000-0000-0000-0000-000000009002', 'HZ-1002', '00000000-0000-0000-0000-000000000102', '00000000-0000-0000-0000-000000005002', '00000000-0000-0000-0000-000000006003',
    'Minh Trần', '0909 111 102', 'minh.tran@tourbook.demo',
    2, 1, 0,
    17200000, 0, 0, 0, 17200000,
    'VND', 'awaiting_payment', 'pending',
    now() + interval '2 days', null, null, null, null, 'Ưu tiên cabin yên tĩnh cho gia đình.',
    '{"tour_name":"Du Thuyền Hạ Long 5 Sao 3 Ngày 2 Đêm","tour_slug":"du-thuyen-ha-long-5-sao","departure_date":"2026-05-22","selected_payment_method":"momo"}'::jsonb,
    now() - interval '1 day', now() - interval '1 day'
  ),
  (
    '00000000-0000-0000-0000-000000009003', 'HZ-1003', '00000000-0000-0000-0000-000000000103', '00000000-0000-0000-0000-000000005003', '00000000-0000-0000-0000-000000006006',
    'Linh Phạm', '0909 111 103', 'linh.pham@tourbook.demo',
    2, 0, 0,
    54800000, 3000000, 0, 0, 51800000,
    'VND', 'completed', 'paid',
    null, '2025-09-02 15:00:00+07', '2025-10-13 18:30:00+07', null, null, 'Muốn có thêm thời gian tự do tại Ubud.',
    '{"tour_name":"Bali Retreat: Sống Chậm Giữa Biển Xanh Và Villa Rừng Nhiệt Đới","tour_slug":"retreat-bali-thu-gian","departure_date":"2025-10-09","selected_payment_method":"vnpay"}'::jsonb,
    '2025-09-01 10:00:00+07', '2025-10-13 18:30:00+07'
  ),
  (
    '00000000-0000-0000-0000-000000009004', 'HZ-1004', '00000000-0000-0000-0000-000000000104', '00000000-0000-0000-0000-000000005006', '00000000-0000-0000-0000-000000006012',
    'Quân Lê', '0909 111 104', 'quan.le@tourbook.demo',
    2, 1, 0,
    29400000, 500000, 0, 0, 28900000,
    'VND', 'cancelled', 'refunded',
    null, null, null, '2025-08-05 14:00:00+07', 'Gia đình đổi lịch cá nhân nên xin hủy.', 'Mong được hỗ trợ hoàn tiền nhanh.',
    '{"tour_name":"Phú Quốc Sunset Retreat: Kỳ Nghỉ Biển Êm Và Riêng Tư","tour_slug":"phu-quoc-sunset-retreat","departure_date":"2025-08-21","selected_payment_method":"bank_transfer"}'::jsonb,
    '2025-07-18 09:30:00+07', '2025-08-06 09:00:00+07'
  ),
  (
    '00000000-0000-0000-0000-000000009005', 'HZ-1005', '00000000-0000-0000-0000-000000000101', '00000000-0000-0000-0000-000000005004', '00000000-0000-0000-0000-000000006007',
    'Anna Nguyễn', '0909 111 101', 'anna.nguyen@tourbook.demo',
    2, 0, 0,
    49000000, 0, 0, 0, 49000000,
    'VND', 'cancel_requested', 'partially_paid',
    null, '2026-02-20 11:00:00+07', null, null, null, 'Nếu được xin hỗ trợ đổi sang lịch mùa xuân.',
    '{"tour_name":"Kyoto Mùa Lá Đỏ: Di Sản, Trà Đạo Và Những Góc Phố Tĩnh Lặng","tour_slug":"kyoto-mua-la-do","departure_date":"2026-11-18","selected_payment_method":"bank_transfer"}'::jsonb,
    '2026-02-18 10:30:00+07', '2026-03-20 16:30:00+07'
  ),
  (
    '00000000-0000-0000-0000-000000009006', 'HZ-1006', '00000000-0000-0000-0000-000000000102', '00000000-0000-0000-0000-000000005005', '00000000-0000-0000-0000-000000006009',
    'Minh Trần', '0909 111 102', 'minh.tran@tourbook.demo',
    1, 0, 0,
    31900000, 0, 0, 0, 31900000,
    'VND', 'pending', 'unpaid',
    now() + interval '3 days', null, null, null, null, 'Đang cân nhắc nâng hạng phòng view đẹp.',
    '{"tour_name":"Dubai Xa Hoa: Sa Mạc, Skyline Và Những Trải Nghiệm Không Giới Hạn","tour_slug":"dubai-xa-hoa","departure_date":"2026-09-10","selected_payment_method":"momo"}'::jsonb,
    now() - interval '6 hours', now() - interval '6 hours'
  ),
  (
    '00000000-0000-0000-0000-000000009007', 'HZ-1007', '00000000-0000-0000-0000-000000000104', '00000000-0000-0000-0000-000000005002', '00000000-0000-0000-0000-000000006004',
    'Quân Lê', '0909 111 104', 'quan.le@tourbook.demo',
    2, 0, 0,
    12000000, 0, 0, 0, 12000000,
    'VND', 'completed', 'paid',
    null, '2025-10-30 09:15:00+07', '2025-11-16 18:00:00+07', null, null, 'Gia đình rất thích cabin có ban công riêng.',
    '{"tour_name":"Du Thuyền Hạ Long 5 Sao 3 Ngày 2 Đêm","tour_slug":"du-thuyen-ha-long-5-sao","departure_date":"2025-11-14","selected_payment_method":"vnpay"}'::jsonb,
    '2025-10-28 08:30:00+07', '2025-11-16 18:00:00+07'
  ),
  (
    '00000000-0000-0000-0000-000000009008', 'HZ-1008', '00000000-0000-0000-0000-000000000101', '00000000-0000-0000-0000-000000005001', '00000000-0000-0000-0000-000000006002',
    'Anna Nguyễn', '0909 111 101', 'anna.nguyen@tourbook.demo',
    2, 0, 0,
    83800000, 3000000, 0, 0, 80800000,
    'VND', 'completed', 'paid',
    null, '2025-11-01 13:00:00+07', '2025-12-12 20:30:00+07', null, null, 'Chuyến đi kỷ niệm ngày cưới rất trọn vẹn.',
    '{"tour_name":"Hành Trình Qua Dãy Alps: Thụy Sĩ Huyền Diệu","tour_slug":"hanh-trinh-thuy-si-alps","departure_date":"2025-12-05","selected_payment_method":"vnpay"}'::jsonb,
    '2025-10-26 13:00:00+07', '2025-12-12 20:30:00+07'
  );
insert into public.booking_travelers (
  booking_id, saved_traveler_id, full_name, phone, email, date_of_birth, gender, id_number, passport_number, nationality, traveler_type, price_amount, special_request
)
values
  ('00000000-0000-0000-0000-000000009001', '00000000-0000-0000-0000-000000002101', 'Anna Nguyễn', '0909 111 101', 'anna.nguyen@tourbook.demo', '1993-05-14', 'female', '079193000101', 'N1234501', 'Việt Nam', 'adult', 42900000, 'Phòng view đẹp'),
  ('00000000-0000-0000-0000-000000009001', null, 'Ngọc Anh Trần', '0909 222 001', 'ngocanh@example.com', '1991-10-22', 'male', '079191000501', 'T1234509', 'Việt Nam', 'adult', 42900000, 'Ăn ít ngọt'),

  ('00000000-0000-0000-0000-000000009002', '00000000-0000-0000-0000-000000002103', 'Minh Trần', '0909 111 102', 'minh.tran@tourbook.demo', '1990-11-02', 'male', '079190000102', 'M1234502', 'Việt Nam', 'adult', 6200000, 'Cabin yên tĩnh'),
  ('00000000-0000-0000-0000-000000009002', null, 'Thu Hà Trần', '0909 222 102', 'thuha@example.com', '1992-04-09', 'female', '079192000102', 'T2234502', 'Việt Nam', 'adult', 6200000, 'Ưu tiên giường đôi'),
  ('00000000-0000-0000-0000-000000009002', null, 'Bảo Nam Trần', null, null, '2016-09-18', 'male', null, 'C2234502', 'Việt Nam', 'child', 4800000, 'Ăn không cay'),

  ('00000000-0000-0000-0000-000000009003', '00000000-0000-0000-0000-000000002104', 'Linh Phạm', '0909 111 103', 'linh.pham@tourbook.demo', '1989-02-17', 'female', '079189000103', 'L1234503', 'Việt Nam', 'adult', 27400000, 'Thích lớp yoga sáng'),
  ('00000000-0000-0000-0000-000000009003', null, 'Mai Chi Vũ', '0909 333 103', 'maichi@example.com', '1990-06-27', 'female', '079190000903', 'V1234599', 'Việt Nam', 'adult', 27400000, 'Phòng twin'),

  ('00000000-0000-0000-0000-000000009004', '00000000-0000-0000-0000-000000002105', 'Quân Lê', '0909 111 104', 'quan.le@tourbook.demo', '1988-09-09', 'male', '079188000104', 'Q1234504', 'Việt Nam', 'adult', 10600000, 'Cần xác nhận hoàn tiền sớm'),
  ('00000000-0000-0000-0000-000000009004', null, 'Thu Trang Lê', '0909 222 104', 'thutrang@example.com', '1989-12-12', 'female', '079189000904', 'T5234504', 'Việt Nam', 'adult', 10600000, 'Phòng gần thang máy'),
  ('00000000-0000-0000-0000-000000009004', '00000000-0000-0000-0000-000000002106', 'Bảo Ngọc Lê', null, null, '2017-01-12', 'female', null, 'QK123004', 'Việt Nam', 'child', 8200000, 'Dị ứng đậu phộng'),

  ('00000000-0000-0000-0000-000000009005', '00000000-0000-0000-0000-000000002101', 'Anna Nguyễn', '0909 111 101', 'anna.nguyen@tourbook.demo', '1993-05-14', 'female', '079193000101', 'N1234501', 'Việt Nam', 'adult', 24500000, 'Có thể đổi lịch nếu còn chỗ'),
  ('00000000-0000-0000-0000-000000009005', null, 'Hà Minh Trần', '0909 333 005', 'haminh@example.com', '1992-03-12', 'male', '079192000905', 'H1234510', 'Việt Nam', 'adult', 24500000, 'Muốn ở ryokan đêm thứ ba'),

  ('00000000-0000-0000-0000-000000009006', '00000000-0000-0000-0000-000000002103', 'Minh Trần', '0909 111 102', 'minh.tran@tourbook.demo', '1990-11-02', 'male', '079190000102', 'M1234502', 'Việt Nam', 'adult', 31900000, 'Có thể nâng hạng nếu còn phòng'),

  ('00000000-0000-0000-0000-000000009007', '00000000-0000-0000-0000-000000002105', 'Quân Lê', '0909 111 104', 'quan.le@tourbook.demo', '1988-09-09', 'male', '079188000104', 'Q1234504', 'Việt Nam', 'adult', 6000000, 'Thích boong tàu yên tĩnh'),
  ('00000000-0000-0000-0000-000000009007', null, 'Thu Trang Lê', '0909 222 104', 'thutrang@example.com', '1989-12-12', 'female', '079189000904', 'T5234504', 'Việt Nam', 'adult', 6000000, 'Kỷ niệm ngày cưới'),

  ('00000000-0000-0000-0000-000000009008', '00000000-0000-0000-0000-000000002101', 'Anna Nguyễn', '0909 111 101', 'anna.nguyen@tourbook.demo', '1993-05-14', 'female', '079193000101', 'N1234501', 'Việt Nam', 'adult', 41900000, 'Ưu tiên ảnh đẹp'),
  ('00000000-0000-0000-0000-000000009008', null, 'Ngọc Anh Trần', '0909 222 001', 'ngocanh@example.com', '1991-10-22', 'male', '079191000501', 'T1234509', 'Việt Nam', 'adult', 41900000, 'Ăn tối ít gluten');

insert into public.booking_price_lines (booking_id, line_type, label, quantity, unit_amount, total_amount, metadata_jsonb)
values
  ('00000000-0000-0000-0000-000000009001', 'fare', 'Người lớn', 2, 42900000, 85800000, '{}'::jsonb),
  ('00000000-0000-0000-0000-000000009001', 'coupon', 'Mã HORIZON10', 1, 3000000, -3000000, '{}'::jsonb),
  ('00000000-0000-0000-0000-000000009002', 'fare', 'Người lớn', 2, 6200000, 12400000, '{}'::jsonb),
  ('00000000-0000-0000-0000-000000009002', 'fare', 'Trẻ em', 1, 4800000, 4800000, '{}'::jsonb),
  ('00000000-0000-0000-0000-000000009003', 'fare', 'Người lớn', 2, 27400000, 54800000, '{}'::jsonb),
  ('00000000-0000-0000-0000-000000009003', 'coupon', 'Mã HORIZON10', 1, 3000000, -3000000, '{}'::jsonb),
  ('00000000-0000-0000-0000-000000009004', 'fare', 'Người lớn', 2, 10600000, 21200000, '{}'::jsonb),
  ('00000000-0000-0000-0000-000000009004', 'fare', 'Trẻ em', 1, 8200000, 8200000, '{}'::jsonb),
  ('00000000-0000-0000-0000-000000009004', 'coupon', 'Mã SUMMER500', 1, 500000, -500000, '{}'::jsonb),
  ('00000000-0000-0000-0000-000000009005', 'fare', 'Người lớn', 2, 24500000, 49000000, '{}'::jsonb),
  ('00000000-0000-0000-0000-000000009006', 'fare', 'Người lớn', 1, 31900000, 31900000, '{}'::jsonb),
  ('00000000-0000-0000-0000-000000009007', 'fare', 'Người lớn', 2, 6000000, 12000000, '{}'::jsonb),
  ('00000000-0000-0000-0000-000000009008', 'fare', 'Người lớn', 2, 41900000, 83800000, '{}'::jsonb),
  ('00000000-0000-0000-0000-000000009008', 'coupon', 'Mã HORIZON10', 1, 3000000, -3000000, '{}'::jsonb);

insert into public.coupon_usages (coupon_id, booking_id, user_id, discount_amount)
values
  ('00000000-0000-0000-0000-000000006101', '00000000-0000-0000-0000-000000009001', '00000000-0000-0000-0000-000000000101', 3000000),
  ('00000000-0000-0000-0000-000000006101', '00000000-0000-0000-0000-000000009003', '00000000-0000-0000-0000-000000000103', 3000000),
  ('00000000-0000-0000-0000-000000006102', '00000000-0000-0000-0000-000000009004', '00000000-0000-0000-0000-000000000104', 500000);
insert into public.booking_events (booking_id, actor_id, event_type, note, event_data, created_at)
values
  ('00000000-0000-0000-0000-000000009001', '00000000-0000-0000-0000-000000000101', 'booking_created', 'Khách tạo booking trên website.', '{}'::jsonb, '2026-03-10 09:00:00+07'),
  ('00000000-0000-0000-0000-000000009001', '00000000-0000-0000-0000-000000000201', 'payment_confirmed', 'Đã xác nhận thanh toán VNPay và giữ chỗ thành công.', '{}'::jsonb, '2026-03-12 10:15:00+07'),
  ('00000000-0000-0000-0000-000000009002', '00000000-0000-0000-0000-000000000102', 'booking_created', 'Booking đang chờ thanh toán MoMo.', '{}'::jsonb, now() - interval '1 day'),
  ('00000000-0000-0000-0000-000000009003', '00000000-0000-0000-0000-000000000103', 'booking_created', 'Đặt chỗ Bali Retreat.', '{}'::jsonb, '2025-09-01 10:00:00+07'),
  ('00000000-0000-0000-0000-000000009003', '00000000-0000-0000-0000-000000000201', 'tour_completed', 'Tour đã hoàn thành và khách gửi đánh giá tích cực.', '{}'::jsonb, '2025-10-13 18:30:00+07'),
  ('00000000-0000-0000-0000-000000009004', '00000000-0000-0000-0000-000000000104', 'booking_created', 'Gia đình đặt kỳ nghỉ Phú Quốc.', '{}'::jsonb, '2025-07-18 09:30:00+07'),
  ('00000000-0000-0000-0000-000000009004', '00000000-0000-0000-0000-000000000201', 'booking_cancelled', 'Đã duyệt hủy và hoàn tiền đầy đủ.', '{}'::jsonb, '2025-08-06 09:00:00+07'),
  ('00000000-0000-0000-0000-000000009005', '00000000-0000-0000-0000-000000000101', 'booking_created', 'Khách giữ chỗ Kyoto và chuyển cọc.', '{}'::jsonb, '2026-02-18 10:30:00+07'),
  ('00000000-0000-0000-0000-000000009005', '00000000-0000-0000-0000-000000000101', 'cancel_requested', 'Khách xin đổi lịch hoặc hỗ trợ hủy.', '{}'::jsonb, '2026-03-20 16:30:00+07'),
  ('00000000-0000-0000-0000-000000009006', '00000000-0000-0000-0000-000000000102', 'booking_created', 'Booking Dubai đang ở trạng thái tạm giữ.', '{}'::jsonb, now() - interval '6 hours'),
  ('00000000-0000-0000-0000-000000009007', '00000000-0000-0000-0000-000000000104', 'booking_created', 'Đặt tour Hạ Long mùa cuối năm.', '{}'::jsonb, '2025-10-28 08:30:00+07'),
  ('00000000-0000-0000-0000-000000009007', '00000000-0000-0000-0000-000000000201', 'tour_completed', 'Khách hoàn thành chuyến đi và quay lại đánh giá.', '{}'::jsonb, '2025-11-16 18:00:00+07'),
  ('00000000-0000-0000-0000-000000009008', '00000000-0000-0000-0000-000000000101', 'booking_created', 'Đặt hành trình Thụy Sĩ mùa đông.', '{}'::jsonb, '2025-10-26 13:00:00+07'),
  ('00000000-0000-0000-0000-000000009008', '00000000-0000-0000-0000-000000000201', 'tour_completed', 'Khách hoàn thành hành trình kỷ niệm ngày cưới.', '{}'::jsonb, '2025-12-12 20:30:00+07');

insert into public.booking_notes (booking_id, author_id, note, is_private)
values
  ('00000000-0000-0000-0000-000000009001', '00000000-0000-0000-0000-000000000201', 'Khách ưu tiên phòng view đẹp, nên giữ phòng tầng cao nếu khách sạn còn trống.', true),
  ('00000000-0000-0000-0000-000000009004', '00000000-0000-0000-0000-000000000201', 'Đã xác nhận lý do hủy chính đáng, hỗ trợ hoàn tiền nhanh để giữ trải nghiệm tốt.', true),
  ('00000000-0000-0000-0000-000000009005', '00000000-0000-0000-0000-000000000201', 'Đang trao đổi thêm phương án dời sang lịch xuân 2027.', true);

insert into public.payments (
  id, booking_id, payment_method_id, provider_name, provider_order_id, provider_payment_id, transaction_code,
  amount, currency, status, requested_at, paid_at, failed_at, failure_reason, raw_response, created_at, updated_at
)
values
  ('00000000-0000-0000-0000-000000009101', '00000000-0000-0000-0000-000000009001', '00000000-0000-0000-0000-000000007001', 'VNPay', 'VNP-HZ1001', 'PAY-HZ1001', 'TXN-HZ1001', 82800000, 'VND', 'paid', '2026-03-10 09:05:00+07', '2026-03-12 10:10:00+07', null, null, '{"provider":"vnpay","status":"success"}'::jsonb, '2026-03-10 09:05:00+07', '2026-03-12 10:10:00+07'),
  ('00000000-0000-0000-0000-000000009102', '00000000-0000-0000-0000-000000009002', '00000000-0000-0000-0000-000000007002', 'MoMo', 'MOMO-HZ1002', null, 'TXN-HZ1002', 17200000, 'VND', 'pending', now() - interval '1 day', null, null, null, '{"provider":"momo","status":"pending"}'::jsonb, now() - interval '1 day', now() - interval '1 day'),
  ('00000000-0000-0000-0000-000000009103', '00000000-0000-0000-0000-000000009003', '00000000-0000-0000-0000-000000007001', 'VNPay', 'VNP-HZ1003', 'PAY-HZ1003', 'TXN-HZ1003', 51800000, 'VND', 'paid', '2025-09-01 10:05:00+07', '2025-09-02 14:55:00+07', null, null, '{"provider":"vnpay","status":"success"}'::jsonb, '2025-09-01 10:05:00+07', '2025-09-02 14:55:00+07'),
  ('00000000-0000-0000-0000-000000009104', '00000000-0000-0000-0000-000000009004', '00000000-0000-0000-0000-000000007003', 'Vietcombank', 'BANK-HZ1004', 'BANKPAY-HZ1004', 'TXN-HZ1004', 28900000, 'VND', 'refunded', '2025-07-18 09:35:00+07', '2025-07-18 16:20:00+07', null, null, '{"provider":"bank_transfer","status":"refunded"}'::jsonb, '2025-07-18 09:35:00+07', '2025-08-06 09:00:00+07'),
  ('00000000-0000-0000-0000-000000009105', '00000000-0000-0000-0000-000000009005', '00000000-0000-0000-0000-000000007003', 'Vietcombank', 'BANK-HZ1005', 'BANKPAY-HZ1005', 'TXN-HZ1005', 15000000, 'VND', 'paid', '2026-02-18 10:40:00+07', '2026-02-18 16:00:00+07', null, null, '{"provider":"bank_transfer","status":"deposit_paid"}'::jsonb, '2026-02-18 10:40:00+07', '2026-03-20 16:30:00+07'),
  ('00000000-0000-0000-0000-000000009106', '00000000-0000-0000-0000-000000009006', '00000000-0000-0000-0000-000000007002', 'MoMo', 'MOMO-HZ1006', null, 'TXN-HZ1006', 31900000, 'VND', 'pending', now() - interval '6 hours', null, null, null, '{"provider":"momo","status":"pending"}'::jsonb, now() - interval '6 hours', now() - interval '6 hours'),
  ('00000000-0000-0000-0000-000000009107', '00000000-0000-0000-0000-000000009007', '00000000-0000-0000-0000-000000007001', 'VNPay', 'VNP-HZ1007', 'PAY-HZ1007', 'TXN-HZ1007', 12000000, 'VND', 'paid', '2025-10-28 08:35:00+07', '2025-10-30 09:10:00+07', null, null, '{"provider":"vnpay","status":"success"}'::jsonb, '2025-10-28 08:35:00+07', '2025-10-30 09:10:00+07'),
  ('00000000-0000-0000-0000-000000009108', '00000000-0000-0000-0000-000000009008', '00000000-0000-0000-0000-000000007001', 'VNPay', 'VNP-HZ1008', 'PAY-HZ1008', 'TXN-HZ1008', 80800000, 'VND', 'paid', '2025-10-26 13:05:00+07', '2025-11-01 12:58:00+07', null, null, '{"provider":"vnpay","status":"success"}'::jsonb, '2025-10-26 13:05:00+07', '2025-11-01 12:58:00+07');

insert into public.payment_events (payment_id, event_name, payload, status, received_at, processed_at)
values
  ('00000000-0000-0000-0000-000000009101', 'payment_paid', '{"gateway":"vnpay"}'::jsonb, 'processed', '2026-03-12 10:10:00+07', '2026-03-12 10:10:10+07'),
  ('00000000-0000-0000-0000-000000009102', 'payment_pending', '{"gateway":"momo"}'::jsonb, 'received', now() - interval '1 day', null),
  ('00000000-0000-0000-0000-000000009103', 'payment_paid', '{"gateway":"vnpay"}'::jsonb, 'processed', '2025-09-02 14:55:00+07', '2025-09-02 14:55:10+07'),
  ('00000000-0000-0000-0000-000000009104', 'refund_completed', '{"provider":"bank_transfer"}'::jsonb, 'processed', '2025-08-06 09:00:00+07', '2025-08-06 09:05:00+07'),
  ('00000000-0000-0000-0000-000000009105', 'deposit_paid', '{"provider":"bank_transfer"}'::jsonb, 'processed', '2026-02-18 16:00:00+07', '2026-02-18 16:05:00+07'),
  ('00000000-0000-0000-0000-000000009106', 'payment_pending', '{"gateway":"momo"}'::jsonb, 'received', now() - interval '6 hours', null),
  ('00000000-0000-0000-0000-000000009107', 'payment_paid', '{"gateway":"vnpay"}'::jsonb, 'processed', '2025-10-30 09:10:00+07', '2025-10-30 09:10:10+07'),
  ('00000000-0000-0000-0000-000000009108', 'payment_paid', '{"gateway":"vnpay"}'::jsonb, 'processed', '2025-11-01 12:58:00+07', '2025-11-01 12:58:10+07');

insert into public.refunds (payment_id, amount, reason, status, requested_by, approved_by, refunded_at)
values
  ('00000000-0000-0000-0000-000000009104', 28900000, 'Khách hủy do thay đổi kế hoạch gia đình.', 'refunded', '00000000-0000-0000-0000-000000000104', '00000000-0000-0000-0000-000000000201', '2025-08-06 09:00:00+07');

insert into public.invoices (booking_id, invoice_number, company_name, tax_code, billing_email, billing_address, issued_at, status)
values
  ('00000000-0000-0000-0000-000000009001', 'INV-2026-1001', 'Anna Studio', '0319991001', 'anna.nguyen@tourbook.demo', '28 Võ Văn Tần, Quận 3, TP. Hồ Chí Minh', '2026-03-12 10:20:00+07', 'issued'),
  ('00000000-0000-0000-0000-000000009003', 'INV-2025-1003', 'Linh Wellness Co.', '0109991003', 'linh.pham@tourbook.demo', '19 Kim Mã, Ba Đình, Hà Nội', '2025-09-02 15:10:00+07', 'issued'),
  ('00000000-0000-0000-0000-000000009004', 'INV-2025-1004', 'Quan Family', '0319991004', 'quan.le@tourbook.demo', '77 Xa lộ Hà Nội, TP. Thủ Đức, TP. Hồ Chí Minh', '2025-07-18 16:30:00+07', 'issued'),
  ('00000000-0000-0000-0000-000000009007', 'INV-2025-1007', 'Le Home', '0319991007', 'quan.le@tourbook.demo', '77 Xa lộ Hà Nội, TP. Thủ Đức, TP. Hồ Chí Minh', '2025-10-30 09:20:00+07', 'issued'),
  ('00000000-0000-0000-0000-000000009008', 'INV-2025-1008', 'Anna Studio', '0319991001', 'anna.nguyen@tourbook.demo', '28 Võ Văn Tần, Quận 3, TP. Hồ Chí Minh', '2025-11-01 13:10:00+07', 'issued');
insert into public.wishlist (user_id, tour_id)
values
  ('00000000-0000-0000-0000-000000000101', '00000000-0000-0000-0000-000000005003'),
  ('00000000-0000-0000-0000-000000000101', '00000000-0000-0000-0000-000000005004'),
  ('00000000-0000-0000-0000-000000000102', '00000000-0000-0000-0000-000000005001'),
  ('00000000-0000-0000-0000-000000000104', '00000000-0000-0000-0000-000000005005');

insert into public.reviews (id, tour_id, booking_id, user_id, rating, comment, status, created_at, updated_at)
values
  ('00000000-0000-0000-0000-000000009301', '00000000-0000-0000-0000-000000005003', '00000000-0000-0000-0000-000000009003', '00000000-0000-0000-0000-000000000103', 5, 'Bali đúng kiểu nghỉ để hồi năng lượng. Villa đẹp, nhịp tour vừa phải và đội ngũ chăm sóc rất tinh tế.', 'approved', '2025-10-18 10:00:00+07', '2025-10-18 10:00:00+07'),
  ('00000000-0000-0000-0000-000000009302', '00000000-0000-0000-0000-000000005002', '00000000-0000-0000-0000-000000009007', '00000000-0000-0000-0000-000000000104', 5, 'Du thuyền đẹp hơn kỳ vọng, đồ ăn ổn và lịch trình rất hợp cho gia đình có trẻ nhỏ.', 'approved', '2025-11-20 09:00:00+07', '2025-11-20 09:00:00+07'),
  ('00000000-0000-0000-0000-000000009303', '00000000-0000-0000-0000-000000005001', '00000000-0000-0000-0000-000000009008', '00000000-0000-0000-0000-000000000101', 5, 'Thụy Sĩ quá đẹp và mọi điểm chạm đều mượt. Đây là chuyến đi kỷ niệm khiến mình rất muốn quay lại.', 'approved', '2025-12-20 15:30:00+07', '2025-12-20 15:30:00+07');

insert into public.review_replies (review_id, replied_by, reply_text, created_at, updated_at)
values
  ('00000000-0000-0000-0000-000000009301', '00000000-0000-0000-0000-000000000201', 'Cảm ơn Linh đã chọn Bali Retreat. Đội ngũ rất vui khi hành trình mang lại đúng cảm giác nghỉ ngơi mà bạn mong muốn.', '2025-10-18 13:00:00+07', '2025-10-18 13:00:00+07'),
  ('00000000-0000-0000-0000-000000009302', '00000000-0000-0000-0000-000000000201', 'Cảm ơn gia đình anh Quân. The Horizon sẽ tiếp tục giữ chuẩn dịch vụ này cho các chuyến đi biển ngắn ngày.', '2025-11-20 13:00:00+07', '2025-11-20 13:00:00+07'),
  ('00000000-0000-0000-0000-000000009303', '00000000-0000-0000-0000-000000000301', 'Cảm ơn Anna đã tin tưởng giao hành trình kỷ niệm cho The Horizon. Hẹn gặp lại ở một điểm đến còn đẹp hơn nữa.', '2025-12-20 18:00:00+07', '2025-12-20 18:00:00+07');

insert into public.notifications (user_id, title, content, notification_type, reference_type, reference_id, is_read, read_at, created_at)
values
  ('00000000-0000-0000-0000-000000000101', 'Booking HZ-1001 đã được xác nhận', 'Chúng tôi đã xác nhận thanh toán và giữ chỗ thành công cho hành trình Thụy Sĩ.', 'booking', 'booking', '00000000-0000-0000-0000-000000009001', true, '2026-03-12 11:00:00+07', '2026-03-12 10:20:00+07'),
  ('00000000-0000-0000-0000-000000000102', 'Booking HZ-1002 đang chờ thanh toán', 'Bạn còn 30 phút để hoàn tất thanh toán giữ chỗ cho lịch Hạ Long.', 'payment', 'booking', '00000000-0000-0000-0000-000000009002', false, null, now() - interval '1 day'),
  ('00000000-0000-0000-0000-000000000103', 'Cảm ơn bạn đã đánh giá Bali Retreat', 'Đánh giá của bạn đã được duyệt và hiển thị trên website.', 'review', 'review', '00000000-0000-0000-0000-000000009301', true, '2025-10-18 14:00:00+07', '2025-10-18 13:10:00+07'),
  ('00000000-0000-0000-0000-000000000104', 'Hoàn tiền booking HZ-1004 đã hoàn tất', 'Khoản hoàn tiền cho booking Phú Quốc đã được xử lý thành công.', 'refund', 'booking', '00000000-0000-0000-0000-000000009004', true, '2025-08-06 10:00:00+07', '2025-08-06 09:10:00+07'),
  ('00000000-0000-0000-0000-000000000101', 'Ticket hỗ trợ dời lịch Kyoto đang được xử lý', 'Nhân viên đã tiếp nhận yêu cầu và đang kiểm tra các lịch phù hợp cho bạn.', 'support', 'ticket', '00000000-0000-0000-0000-000000009401', false, null, '2026-03-20 17:00:00+07'),
  ('00000000-0000-0000-0000-000000000102', 'Bạn vừa thêm Hành Trình Thụy Sĩ vào wishlist', 'Hãy theo dõi để nhận khuyến mại phù hợp cho tour này.', 'wishlist', 'tour', '00000000-0000-0000-0000-000000005001', false, null, now() - interval '5 days');

insert into public.support_tickets (id, ticket_code, user_id, booking_id, subject, status, priority, assigned_to, created_at, updated_at, closed_at)
values
  ('00000000-0000-0000-0000-000000009401', 'TCK-1001', '00000000-0000-0000-0000-000000000101', '00000000-0000-0000-0000-000000009005', 'Hỗ trợ dời lịch tour Kyoto', 'in_progress', 'high', '00000000-0000-0000-0000-000000000201', '2026-03-20 16:45:00+07', '2026-03-20 17:15:00+07', null),
  ('00000000-0000-0000-0000-000000009402', 'TCK-1002', '00000000-0000-0000-0000-000000000102', '00000000-0000-0000-0000-000000009002', 'Xác nhận chính sách trẻ em cho Hạ Long', 'open', 'normal', '00000000-0000-0000-0000-000000000201', now() - interval '20 hours', now() - interval '20 hours', null),
  ('00000000-0000-0000-0000-000000009403', 'TCK-1003', '00000000-0000-0000-0000-000000000104', '00000000-0000-0000-0000-000000009004', 'Kiểm tra trạng thái hoàn tiền', 'resolved', 'high', '00000000-0000-0000-0000-000000000201', '2025-08-05 15:00:00+07', '2025-08-06 09:30:00+07', '2025-08-06 09:30:00+07');

insert into public.support_ticket_messages (ticket_id, sender_id, sender_type, message, attachments_jsonb, created_at)
values
  ('00000000-0000-0000-0000-000000009401', '00000000-0000-0000-0000-000000000101', 'customer', 'Mình muốn hỏi có thể đổi sang lịch Kyoto mùa xuân được không?', '[]'::jsonb, '2026-03-20 16:46:00+07'),
  ('00000000-0000-0000-0000-000000009401', '00000000-0000-0000-0000-000000000201', 'staff', 'Bên em đã ghi nhận yêu cầu và sẽ gửi lại các lịch phù hợp trong hôm nay.', '[]'::jsonb, '2026-03-20 17:10:00+07'),
  ('00000000-0000-0000-0000-000000009402', '00000000-0000-0000-0000-000000000102', 'customer', 'Bé sinh năm 2016 thì áp giá trẻ em đúng không ạ?', '[]'::jsonb, now() - interval '20 hours'),
  ('00000000-0000-0000-0000-000000009403', '00000000-0000-0000-0000-000000000104', 'customer', 'Nhờ kiểm tra giúp mình tiền hoàn đã chuyển chưa.', '[]'::jsonb, '2025-08-05 15:05:00+07'),
  ('00000000-0000-0000-0000-000000009403', '00000000-0000-0000-0000-000000000201', 'staff', 'Bên em đã hoàn tất chuyển khoản và gửi xác nhận qua email cho anh.', '[]'::jsonb, '2025-08-06 09:20:00+07');

insert into public.activity_logs (actor_id, action, entity_type, entity_id, old_data, new_data, ip_address, created_at)
values
  ('00000000-0000-0000-0000-000000000301', 'publish_tour', 'tour', '00000000-0000-0000-0000-000000005001', null, '{"status":"published"}'::jsonb, '127.0.0.1', now() - interval '25 days'),
  ('00000000-0000-0000-0000-000000000301', 'publish_tour', 'tour', '00000000-0000-0000-0000-000000005003', null, '{"status":"published"}'::jsonb, '127.0.0.1', now() - interval '14 days'),
  ('00000000-0000-0000-0000-000000000201', 'confirm_payment', 'booking', '00000000-0000-0000-0000-000000009001', '{"payment_status":"pending"}'::jsonb, '{"payment_status":"paid"}'::jsonb, '127.0.0.1', '2026-03-12 10:15:00+07'),
  ('00000000-0000-0000-0000-000000000201', 'resolve_ticket', 'support_ticket', '00000000-0000-0000-0000-000000009403', '{"status":"open"}'::jsonb, '{"status":"resolved"}'::jsonb, '127.0.0.1', '2025-08-06 09:30:00+07'),
  ('00000000-0000-0000-0000-000000000301', 'reply_review', 'review', '00000000-0000-0000-0000-000000009303', null, '{"reply":true}'::jsonb, '127.0.0.1', '2025-12-20 18:00:00+07'),
  ('00000000-0000-0000-0000-000000000301', 'update_banner', 'banner', '00000000-0000-0000-0000-000000006201', '{"title":"Summer banner"}'::jsonb, '{"title":"Bộ sưu tập mùa hè 2026"}'::jsonb, '127.0.0.1', now() - interval '3 days');

drop function if exists public.seed_demo_user(uuid, text, text, text, text);

commit;



