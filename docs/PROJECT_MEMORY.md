# Project Memory

Updated: 2026-03-24
Repo: `d:\TourBook`

## Muc tieu da chot
- Dung schema Supabase tour booking da tao truoc do va bo `seed.sql` de lam UI/UX hoan chinh cho website dat tour.
- Uu tien lam duoc luong that: xem tour, loc tour, chi tiet tour, checkout, tao booking, payment demo, huy booking, xem booking, login, account, admin, CMS pages.
- Giao dien theo huong hien dai, sang, bo cuc lon, rounded card, hero/banner va sticky panels.

## Su thay doi lon o frontend

### Ha tang va data layer
- Tao `lib/format.ts`:
  - `formatCurrency`, `formatShortDate`, `formatLongDate`, `formatDateTime`, `formatDuration`, `statusLabel`, `normalizeSearch`, ...
- Tao `lib/pricing.ts`:
  - `getEffectivePrice`, `computeSubtotal`, `computeCouponDiscount`
- Tach Supabase client:
  - `lib/supabase/browser-client.ts`
  - `lib/supabase/server-client.ts`
  - `lib/supabaseClient.ts` tro den browser client
- Tao `lib/site-data.ts`:
  - hop nhat doc du lieu tu `tours`, `tour_images`, `tour_destinations`, `locations`, `categories`, `tour_categories`, `tour_tags`, `departure_schedules`, `schedule_price_tiers`, `reviews`, `review_replies`, `banners`, `cms_pages`, `payment_methods`, `coupons`, `cancellation_policies`
  - tra ve `TourSummary`, `DestinationSpotlight`, `PaymentMethod`, `CouponPreview`, `CmsPageData`
  - helper: `getHomepageData`, `getToursPageData`, `getTourBySlug`, `getBookingReferenceData`, `getCmsPageBySlug`, `filterTours`

### Auth va layout
- Sua `app/layout.tsx`:
  - gan font `Plus Jakarta Sans` + `Manrope`
  - wrap `AuthProvider`
  - dung chung `SiteHeader` va `SiteFooter`
- Tao `components/providers/auth-provider.tsx`:
  - bootstrap session tu Supabase Auth
  - load `profiles` va `user_roles`
  - expose `signIn`, `signUp`, `signOut`, `refreshProfile`, `isAdmin`
- Sua `app/globals.css`:
  - theme sang, gradient/background, `surface-panel`, `page-container`, `hero-glow`, ...
- Sua `next.config.ts`:
  - them `images.unsplash.com` vao `remotePatterns`

### Components UI/site
- Tao:
  - `components/site/site-header.tsx`
  - `components/site/site-footer.tsx`
  - `components/site/tour-card.tsx`
  - `components/site/review-card.tsx`
  - `components/site/destination-card.tsx`
  - `components/site/section-heading.tsx`
  - `components/site/empty-state.tsx`
  - `components/site/status-pill.tsx`
  - `components/site/booking-wizard.tsx`
  - `components/site/booking-actions.tsx`
  - `components/site/login-panel.tsx`
  - `components/site/account-dashboard.tsx`
  - `components/site/admin-dashboard.tsx`

## Cac trang da tao / hoan thien
- `app/page.tsx`
  - homepage co hero banner, search, featured tours, destinations, reviews, newsletter CTA
- `app/tours/page.tsx`
  - danh sach tour + filter theo query string
- `app/tours/[slug]/page.tsx`
  - chi tiet tour, gallery, itinerary, reviews, sticky booking card
- `app/destinations/page.tsx`
- `app/reviews/page.tsx`
- `app/checkout/page.tsx`
  - dung `BookingWizard`
- `app/booking/[code]/page.tsx`
  - xem booking, hanh khach, line gia, payments, events, ticket/review/payment/cancel actions
- `app/login/page.tsx`
- `app/account/page.tsx`
- `app/admin/page.tsx`
- CMS:
  - `app/about-us/page.tsx`
  - `app/privacy-policy/page.tsx`
  - `app/terms-and-conditions/page.tsx`
- feedback pages:
  - `app/loading.tsx`
  - `app/not-found.tsx`

## API noi bo da tao
- `app/api/bookings/route.ts`
  - tao booking moi
  - validate tour, schedule, counts, coupon
  - insert `bookings`, `booking_travelers`, `booking_price_lines`, `coupon_usages`, `payments`, `booking_events`, `notifications`
- `app/api/bookings/payment/route.ts`
  - payment demo, mark `payments.status = paid`, dong bo `bookings.payment_status = paid`, `booking_status = confirmed`
- `app/api/bookings/cancel/route.ts`
  - huy booking hoac chuyen `cancel_requested`
- `app/api/profile/route.ts`
  - update `profiles`
- `app/api/wishlist/route.ts`
  - toggle wishlist
- `app/api/reviews/route.ts`
  - tao/cap nhat review cho booking `completed`
- `app/api/support-tickets/route.ts`
  - tao ticket ho tro + first message

## Chuc nang dang hoat dong
- Khach/guest:
  - xem homepage, tours, destinations, reviews, CMS pages
  - vao chi tiet tour
  - vao checkout va tao booking
- Auth:
  - login bang Supabase Auth
  - sign up user moi
  - demo account co san trong `seed.sql`
- Booking:
  - tao booking moi tu checkout
  - xem booking theo `booking_code`
  - payment demo
  - request cancel / cancel
  - xem timeline events
- Account:
  - xem danh sach booking
  - cap nhat profile
  - xem notifications
  - xem wishlist va bo luu
  - them saved traveler
  - tao support ticket moi
- Admin/Staff:
  - vao dashboard admin neu co role
  - xem recent bookings, payments, reviews, tickets, tours, activity logs
  - quick action mark paid

## Luu y quan trong ve Next.js 16
- Da doc local docs trong `node_modules/next/dist/docs/` truoc khi code.
- Dung convention moi cua App Router:
  - `params` la `Promise<...>` trong dynamic page server component
  - `searchParams` la `Promise<...>`
- Da sua cac page de `await params` / `await searchParams` dung cach.

## Loi da gap va da sua

### 1. Seed SQL: `gen_salt` khong ton tai
- Loi:
  - `function gen_salt(unknown) does not exist`
- Nguyen nhan:
  - project Supabase can goi ham thuoc schema `extensions`
- Cach sua trong `supabase/seed.sql`:
  - them `extensions` vao `search_path`
  - doi sang `extensions.crypt(...)` va `extensions.gen_salt('bf')`

### 2. Seed SQL: khong insert duoc `confirmed_at` vao `auth.users`
- Loi:
  - `cannot insert a non-DEFAULT value into column "confirmed_at"`
- Nguyen nhan:
  - `confirmed_at` la generated column trong version auth hien tai cua Supabase
- Cach sua:
  - bo cot `confirmed_at` khoi `insert into auth.users`
  - bo gia tri `now()` tuong ung
  - bo `confirmed_at = excluded.confirmed_at` trong `on conflict`

### 3. Build parser loi invalid UTF-8
- Loi xuat hien o:
  - `app/tours/page.tsx`
  - `app/tours/[slug]/page.tsx`
  - `components/site/review-card.tsx`
  - `components/site/site-footer.tsx`
- Nguyen nhan:
  - file bi ghi ra voi byte/encoding khong sach trong qua trinh ghi file bang shell tren Windows
- Cach sua:
  - rewrite lai file bang noi dung ASCII/UTF-8 ro rang
  - dung `Set-Content ... -Encoding utf8`

### 4. Build type error o `/api/bookings`
- Loi:
  - cast `CouponPreview` sang object co `usedCount`
- Cach sua:
  - query `coupons.used_count` tu DB roi tang len thay vi ep kieu sai

### 5. Lint React 19: `set-state-in-effect`
- Loi xuat hien trong dashboard account/admin
- Nguyen nhan:
  - goi ham fetch co `setState` ngay trong `useEffect`
- Cach sua:
  - doi logic bootstrap sang `setTimeout(() => void loadData(), 0)`
  - bo state sync truc tiep tu effect
  - profile form doi sang `defaultValue` + submit bang `FormData`

### 6. Lint khac
- `no-img-element` trong `booking-wizard`
  - sua sang `next/image`
- `react/no-unescaped-entities` trong `review-card`
  - doi quote sang `&ldquo;...&rdquo;`
- import thua trong mot so page
  - da bo

## Kiem thu da chay
- `npm run build`
  - PASS
- `cmd /c npm run lint`
  - PASS

## Route da build thanh cong
- `/`
- `/tours`
- `/tours/[slug]`
- `/checkout`
- `/booking/[code]`
- `/login`
- `/account`
- `/admin`
- `/destinations`
- `/reviews`
- `/about-us`
- `/privacy-policy`
- `/terms-and-conditions`
- cac API route noi bo trong `app/api/*`

## Gioi han va viec nen lam tiep
- Hien tai logic write duoc lam qua route handler + anon Supabase client/server client.
- Chua them RLS/policies cho prod.
- Chua dua logic transaction nghiep vu vao Postgres RPC, nen voi moi truong that nen viet:
  - `create_booking()` RPC
  - `cancel_booking()` RPC
  - webhook payment qua Edge Function
  - RLS cho guest/customer/staff/admin
- Chua co gateway thanh toan that, moi la payment demo.
- Chua co pagination that o account/admin, hien la dashboard MVP.

## Ghi chu thao tac
- Tren may nay `apply_patch` gap loi sandbox, nen da dung PowerShell `Set-Content` / replace file truc tiep.
- `npm run lint` qua PowerShell bi chan `npm.ps1`, nen chay bang `cmd /c npm run lint`.

## Cập nhật 2026-03-24 - Đồng bộ giao diện và sửa tiếng Việt

### Vấn đề người dùng báo
- Toàn site xuất hiện nhiều chữ tiếng Việt không dấu, nhìn giống lỗi font.
- Thực tế có 2 nguyên nhân cùng lúc:
  - Font Google trước đó chưa bật subset `vietnamese`.
  - Nhiều chuỗi UI đã bị viết ở dạng ASCII từ các lần chỉnh sửa trước, nên dù font đúng thì vẫn hiển thị không dấu.

### Đã sửa trong đợt này
- Cập nhật `app/layout.tsx`:
  - dùng `Plus_Jakarta_Sans` và `Manrope` với `subsets: ["latin", "vietnamese"]`
  - chuẩn hóa metadata và brand `The Horizon`
- Cập nhật `app/globals.css`:
  - tinh chỉnh palette, `surface-panel`, background và các class nền để gần bộ mẫu hơn
- Đồng bộ lại shell giao diện:
  - `components/site/site-header.tsx`
  - `components/site/site-footer.tsx`
- Đồng bộ lại các trang public theo visual mẫu The Horizon:
  - `app/page.tsx`
  - `app/tours/page.tsx`
  - `app/tours/[slug]/page.tsx`
  - `app/destinations/page.tsx`
  - `app/reviews/page.tsx`
  - `app/checkout/page.tsx`
  - `app/login/page.tsx`
  - `app/not-found.tsx`
- Đồng bộ tiếp các trang chức năng thật để không bị lệch phong cách so với trang public:
  - `app/booking/[code]/page.tsx`
  - `app/account/page.tsx` + `components/site/account-dashboard.tsx`
  - `app/admin/page.tsx` + `components/site/admin-dashboard.tsx`
  - `components/site/booking-actions.tsx`
  - `components/site/booking-wizard.tsx`
- Chuẩn hóa text/card dùng chung:
  - `components/site/tour-card.tsx`
  - `components/site/review-card.tsx`
  - `components/site/destination-card.tsx`
  - `lib/format.ts`
  - một phần fallback copy trong `lib/site-data.ts`
- Dọn lại message ở API nội bộ để tránh hiện lỗi không dấu ra UI:
  - `app/api/bookings/route.ts`
  - `app/api/bookings/payment/route.ts`
  - `app/api/bookings/cancel/route.ts`

### Lỗi phát sinh trong lúc sửa và cách xử lý
- `apply_patch` vẫn lỗi sandbox trên workspace này.
  - Tiếp tục dùng PowerShell `Get-Content` / `Set-Content -Encoding utf8` như các lần trước.
- Có một đợt replace chuỗi quá rộng làm hỏng identifier trong `components/site/booking-wizard.tsx`.
  - Ví dụ lỗi đã gặp:
    - `startTransition` -> `startoransition`
    - `TourSummary` -> `oourSummary`
    - `TravelerForm` -> `oravelerForm`
    - `travelerType` -> `traveleroype`
    - `createTravelers` -> `createoravelers`
    - `POST` -> `POSo`
    - `Content-Type` -> `Content-oype`
  - Cách sửa:
    - không replace hàng loạt nữa
    - phục hồi từng identifier một cách tường minh
    - quét lại file bằng `rg`
    - chạy lại build/lint đến khi sạch hoàn toàn
- Có một typo phụ ở API hủy booking:
  - `hhông thể huy booking.`
  - đã sửa thành `Không thể hủy booking.`

### Đã kiểm tra lại
- `cmd /c npm run build`
  - PASS
- `cmd /c npm run lint`
  - PASS

### Trạng thái hiện tại sau đợt này
- Toàn bộ các route chính đang có giao diện đồng bộ hơn với bộ mẫu The Horizon.
- Phần chữ tiếng Việt hiển thị đúng dấu ở lớp layout/theme và ở hầu hết các luồng thật: booking, account, admin, login, review, checkout.
- Bộ nhớ dự án cần lưu ý rằng lỗi “font” trước đó không chỉ do font, mà chủ yếu do copy ASCII + một phần cấu hình subset font.

## 2026-03-24 - Reset DB + showcase seed moi

### File moi cho database demo
- Tao `supabase/reset_all_data.sql`
  - truncate toan bo bang trong schema `public`
  - truncate cac bang auth dev quan trong neu ton tai: `users`, `identities`, `sessions`, `refresh_tokens`, `one_time_tokens`, `flow_state`
  - muc tieu: dua DB ve trang thai sach truoc khi seed lai
- Tao `supabase/seed_showcase.sql`
  - bo du lieu fake moi, clean, dong bo voi UI hien tai
  - giu lai he tai khoan demo de dang dang nhap/test role
  - dung link anh `images.unsplash.com` de khop `next.config.ts`

### Seed showcase hien tai gom
- roles, permissions, role_permissions
- auth users + profiles + user_roles
- user_addresses, saved_travelers
- locations, categories, tags, cancellation_policies
- tours, tour_destinations, tour_categories, tour_tags, tour_images, tour_itinerary_days
- departure_schedules, schedule_price_tiers
- coupons, coupon_tours, coupon_categories
- payment_methods
- banners, cms_pages, system_settings
- bookings, booking_travelers, booking_price_lines, coupon_usages
- booking_events, booking_notes
- payments, payment_events, refunds, invoices
- wishlist, reviews, review_replies, notifications
- support_tickets, support_ticket_messages, activity_logs

### Tai khoan demo giu nguyen
- Password chung: `Demo@123456`
- `anna.nguyen@tourbook.demo`
- `minh.tran@tourbook.demo`
- `linh.pham@tourbook.demo`
- `quan.le@tourbook.demo`
- `thao.staff@tourbook.demo`
- `huy.admin@tourbook.demo`

### Thu tu chay dung
1. `supabase/reset_all_data.sql`
2. `supabase/seed_showcase.sql`

### Luu y ky thuat
- Da gap loi Windows sandbox `CreateProcessAsUserW failed: 206` khi co gang ghi ca file SQL bang mot lenh PowerShell qua dai.
- Cach xu ly: ghi `seed_showcase.sql` theo nhieu khoi nho bang `Set-Content` / `Add-Content`.
- Chua co kha nang chay truc tiep SQL len Supabase tu workspace nay, nen can paste/chay 2 file tren trong SQL Editor cua project dev.

## 2026-03-24 - Fix trang Tours / Reviews bi rong du lieu
- Nguyen nhan nghi ngo chinh: `lib/site-data.ts` boc `getSiteCatalog()` bang `cache(...)`.
- Khi server da doc DB luc chua seed hoac seed cu chua co data phu hop, ket qua rong co the bi giu lai trong memory va hien tiep tren cac trang public.
- Da sua:
  - bo `cache` import khoi `lib/site-data.ts`
  - doi `getSiteCatalog()` thanh ham async thuong de doc data moi moi request
- Da kiem tra lai:
  - `cmd /c npm run lint` PASS
- Neu browser da giu route cache tu truoc, can hard refresh sau khi chay seed moi de thay du lieu moi nhat.
- Bo sung fallback cho `featuredTours` trong `lib/site-data.ts`:
  - neu DB khong co tour nao duoc danh dau `is_featured`, homepage van tu chon danh sach tour tot nhat theo review va gia de tranh section rong.

## 2026-03-24 - Empty public pages diagnostic
- Khi DB da co data nhung `Tours` / `Reviews` van rong, hai kha nang lon nhat la:
  - app dang tro sai Supabase project
  - `anon` bi chan boi RLS / grant nen select tra ve mang rong
- Da tao them:
  - `supabase/check_public_catalog.sql`
    - check nhanh so luong `tours published`, `reviews approved`, `banners active`
    - check trang thai `rowsecurity` cua cac bang public quan trong
  - `supabase/dev_public_read_access.sql`
    - grant `select` cho `anon`, `authenticated`
    - disable RLS tren cac bang public ma homepage / tours / reviews dang doc
    - chi dung cho DEV / TEST
- App local hien dang dung `NEXT_PUBLIC_SUPABASE_URL` trong `.env.local`.
  - Can chac chan project URL trong file env trung voi project ma ban vua seed du lieu.

## 2026-03-24 - Tach role quan tri + khoa public site cho management
- Da them `lib/roles.ts`
  - chuan hoa role theo thu tu uu tien: `super_admin`, `admin`, `staff`, `customer`
  - xac dinh `primaryRole`, `isManagement`, huong redirect sau login
- Da sua `components/providers/auth-provider.tsx`
  - context auth hien tra ve `roles` da normalize
  - bo sung `primaryRole` va `isManagement`
  - `isAdmin` hien duoc dung nhu alias cho nhom management
- Da them `components/providers/app-shell.tsx`
  - neu user co role `staff/admin/super_admin` va vao route ngoai `/admin`, tu dong `replace('/admin')`
  - neu user khong co quyen ma vao `/admin`, tu dong day ve `/account` hoac `/login?redirect=/admin`
- Da sua `app/layout.tsx`
  - root layout dung `AppShell` de route guard chay o cap ung dung
- Da sua `components/site/site-header.tsx`
  - management chi thay dieu huong `Admin Console`
  - avatar va nut chinh deu tro ve `/admin`
  - bo thanh search / nav public cho management
- Da sua `components/site/site-footer.tsx`
  - management dung footer rieng, khong con link ra public site
- Da sua `components/site/login-panel.tsx`
  - them demo account `ngoc.superadmin@tourbook.demo`
  - login effect redirect theo role, management vao thang `/admin`
- Da sua `components/site/admin-dashboard.tsx`
  - bo nut mo `/account`, `/tours` va link mo booking public
  - doi copy de ro rang tai khoan quan tri dang bi khoa trong khu noi bo
- Da sua `components/site/account-dashboard.tsx`
  - hien `Vai tro hien tai` bang `primaryRole`
- Da sua `supabase/seed_showcase.sql`
  - them user demo `super_admin`
  - xoa toan bo `user_roles` cua cac account management roi insert lai dung 1 role/account
- Da them `supabase/patch_single_role_management.sql`
  - dung cho DB da seed san
  - tao/cap nhat user `super_admin`
  - chuan hoa role cua `thao.staff`, `huy.admin`, `ngoc.superadmin`

### Tai khoan demo management moi
- `thao.staff@tourbook.demo` -> `staff`
- `huy.admin@tourbook.demo` -> `admin`
- `ngoc.superadmin@tourbook.demo` -> `super_admin`
- Password chung: `Demo@123456`

### Kiem tra sau thay doi
- `cmd /c npm run lint` -> PASS
- `cmd /c npm run build` -> PASS

## 2026-03-24 - Booking chi cho user da dang nhap
- Da khoa luong dat tour theo 2 lop:
  - UI checkout chi cho khach chua dang nhap xem thong tin, khong hien form tao booking thuc su
  - API `/api/bookings` bat buoc phai co `Authorization: Bearer <access_token>` hop le
- Da sua `components/site/booking-wizard.tsx`
  - neu chua dang nhap, hien block `Dang nhap de dat tour`
  - giu lai phan tom tat lich khoi hanh, gia, so hanh khach o che do xem
  - khi dang nhap, moi mo toan bo 3 buoc checkout va submit booking
  - request tao booking hien gui kem Supabase access token trong header `Authorization`
- Da sua `app/api/bookings/route.ts`
  - reject `401` neu thieu token hoac token het han
  - xac thuc user bang `supabase.auth.getUser(accessToken)`
  - bo khong tin `userId` tu client nua, thay vao do dung user xac thuc de tao booking / coupon_usage / notification / booking_event
- Da sua CTA booking chung:
  - `components/site/site-header.tsx`
  - `components/site/site-footer.tsx`
  - guest bam `Dat tour` se duoc dua qua login truoc
  - customer da dang nhap van vao `/checkout` binh thuong
- Da cap nhat copy:
  - `app/checkout/page.tsx`
  - `app/tours/[slug]/page.tsx`
  - lam ro rang guest chi xem thong tin, login moi dat duoc

### Kiem tra sau thay doi
- `cmd /c npm run lint` -> PASS
- `cmd /c npm run build` -> PASS

## 2026-03-24 - Fix treo auth sau khi dang xuat
- Trieu chung:
  - sau khi login roi logout, header chi hien vong tron loading
  - he thong khong xac dinh duoc dang dang nhap hay da dang xuat
  - khong nhan ra user hien tai, nhat la sau khi chuyen qua lai giua login / logout
- Nguyen nhan chinh:
  - `components/providers/auth-provider.tsx` bootstrap session bang `getSession()` va `getUser()` rieng biet
  - khi logout, mot request cu co the ve tre va ghi de state moi, hoac nem loi truoc khi `initialized` duoc bat lai
  - ket qua la UI mac ket o trang thai `initialized = false`
- Da sua:
  - bo `getUser()` khoi bootstrap auth, chi dong bo tu `getSession()` / `nextSession` cua `onAuthStateChange`
  - them `syncVersionRef` de huy ket qua cua nhung request auth cu khi co logout / state moi den sau
  - bao dam neu sync auth loi thi van roi ve `clearAuthState()` va bat `initialized = true`
  - `signOut()` gio clear state ngay lap tuc truoc, sau do moi goi Supabase signOut
  - neu signOut loi, he thong thu dong bo lai session hien tai thay vi de UI treo
  - `components/site/site-header.tsx` doi nut dang xuat thanh handler async, redirect ve `/` va `router.refresh()` sau logout
- Kiem tra sau thay doi:
  - `cmd /c npm run lint` -> PASS
  - `cmd /c npm run build` -> PASS

## 2026-03-24 - Tach khu quan tri thanh sidebar trai + module nho
- User yeu cau khong dồn tat ca booking / payments / reviews / support / tours / activity vao mot trang admin duy nhat nua.
- Da chuyen khu `/admin` sang mo hinh nested admin console voi sidebar trai rieng.

### Cau truc moi
- Them `app/admin/layout.tsx`
  - dung `AdminShell` de render sidebar trai co dinh
- Them `app/admin/[section]/page.tsx`
  - route dong cho tung module con
- Them `app/admin/loading.tsx`
  - loading state nhe cho khu admin
- `app/admin/page.tsx`
  - gio chi la trang overview (`section = overview`)

### Sidebar + phan quyen menu
- Them `components/site/admin/admin-config.ts`
  - dinh nghia menu group, role label, metadata tung module
- Them `components/site/admin/admin-shell.tsx`
  - sidebar trai theo nhom module
  - highlight item active tren cac route `/admin/*`
  - menu tu dong rut gon theo role
- Rule menu:
  - `staff`: dashboard, bookings, payments, reviews, support
  - `admin`: thay tat ca module cua staff + tours + activity + system
  - `super_admin`: dung cung bo module voi admin hien tai

### Module hoa admin page
- Them `components/site/admin/admin-console.tsx`
  - `AdminSectionPage(section)` render tung man hinh rieng:
    - `overview`
    - `bookings`
    - `payments`
    - `reviews`
    - `support`
    - `tours`
    - `activity`
    - `system`
- `overview` gio chi giu KPI va preview ngan gon, kem link di sau vao tung module
- `bookings` giu quick action `Danh dau da thanh toan`
- `tours`, `activity`, `system` la module admin-level, staff khong thay trong sidebar va khong vao duoc
- `components/site/admin-dashboard.tsx` da duoc rut gon thanh wrapper cua `overview` moi de tranh giu lai dashboard cu qua lon

### UI/UX lien quan
- `components/site/site-header.tsx`
  - nav `Admin Console` hien active cho ca `/admin` va `/admin/*`
- Overview da duoc role-aware:
  - staff khong con thay preview/link sang module `activity`
  - staff thay card `Nhip van hanh hom nay` thay the

### Kiem tra sau thay doi
- `cmd /c npm run lint` -> PASS
- `cmd /c npm run build` -> PASS
- Bo sung dieu chinh giao dien admin theo feedback sau do:
  - khu `/admin` khong con dung header/footer public nua
  - admin shell da doi sang kieu app noi bo full-screen
  - sidebar trai `fixed` full-height, menu luon hien ro rang thay vi panel trong `page-container`
  - topbar rieng cho admin voi breadcrumb va action chip
  - muc tieu la giong tinh than giao dien mau: sidebar co dinh, main content ben phai, nhin thay het menu ngay lap tuc

## 2026-03-24 - Sua logic booking / payment / cancel theo luong thuc te
- User bao 3 van de logic chinh:
  - booking `cancel_requested` dang bi coi nhu da huy xong, trong khi thuc te phai cho duyet huy
  - booking da huy / da hoan tien van con hien action `Danh dau da thanh toan` trong admin
  - nhieu API van tin `userId` / `actorId` tu client, de logic va quyen bi lech voi session dang nhap that

### Helper nghiep vu moi
- Them `lib/booking-logic.ts`
  - `canMarkBookingPaid()`
  - `getCancellationMode()`
  - `canResolveCancellationRequest()`
  - `getRejectedCancellationStatus()`
  - `getApprovedRefundPaymentStatus()`
  - `countsAsOpenBooking()`
  - `countsAsRecognizedSpend()`
- Muc tieu la de booking page, account dashboard va admin console deu doc cung 1 bo rule, tranh moi noi tu hieu trang thai theo cach khac nhau.

### Auth helper moi cho route handler
- Them `lib/request-auth.ts`
  - doc bearer token tu request
  - `supabase.auth.getUser(accessToken)`
  - nap roles thuc te tu `user_roles` + `roles`
  - tra ve `primaryRole`, `isManagement`
- Cac API user-facing moi khong con tin `userId` tu client lam nguon quyen chinh nua.

### API da sua
- `app/api/bookings/payment/route.ts`
  - bat buoc dang nhap
  - customer chi duoc thanh toan booking cua chinh minh; management duoc xu ly cho booking bat ky
  - chan thanh toan khi booking dang `cancel_requested`, `cancelled`, `expired`, ...
  - chan thanh toan khi payment record da `paid`, `failed`, `refunded`, `partially_refunded`, ...
  - `booking_events.actor_id` gio dung user dang nhap thuc te
- `app/api/bookings/cancel/route.ts`
  - bat buoc dang nhap
  - customer chi duoc huy booking cua chinh minh
  - neu booking da `cancel_requested` thi tra loi dang cho duyet huy, khong gui lai yeu cau moi
  - `paid` / `partially_paid` -> chuyen sang `cancel_requested`
  - chua thanh toan -> huy thang `cancelled`
  - neu payment dang `pending` va huy thang thi cap nhat payment record sang `cancelled` + them `payment_events`
- Them `app/api/bookings/cancel/review/route.ts`
  - chi management duoc goi
  - `approve` -> doi booking sang `cancelled`, doi payment sang `refunded` / `partially_refunded`, tao `refunds`, `payment_events`, `booking_events`, `notifications`
  - `reject` -> dua booking ve trang thai hop ly (`confirmed` hoac `awaiting_payment` / `pending`) va ghi `booking_events`, `notifications`
- `app/api/profile/route.ts`
  - dung user tu session, khong nhan `userId` tu client nua
- `app/api/support-tickets/route.ts`
  - dung user tu session
  - neu ticket gan voi booking thi kiem tra quyen so huu booking
- `app/api/wishlist/route.ts`
  - dung user tu session
- `app/api/reviews/route.ts`
  - dung user tu session
  - van giu rule: chi booking `completed` moi duoc review

### UI da sua
- `components/site/booking-actions.tsx`
  - nut thanh toan chi mo khi booking dang o trang thai co the tra tien that su
  - booking `cancel_requested` bi khoa thanh toan
  - copy cua block huy booking gio phan biet ro:
    - huy ngay
    - gui yeu cau cho duyet huy
    - dang cho duyet huy
  - cac API support / review / cancel / payment deu gui `Authorization: Bearer ...`
- `components/site/account-dashboard.tsx`
  - `Booking dang mo` khong con dem `cancel_requested`
  - `Tong chi tieu` khong con cong booking da huy / da hoan tien / dang cho huy
  - profile / wishlist / support ticket deu goi API kem bearer token, bo `userId` tu body
- `components/site/admin/admin-console.tsx`
  - bo rule sai `payment_status !== paid` => hien `Danh dau da thanh toan`
  - gio chi hien action nay khi `canMarkBookingPaid()` tra ve true
  - booking `cancel_requested` hien 2 action moi:
    - `Tu choi huy`
    - `Duyet huy`
  - them KPI `Cho duyet huy`
  - doanh thu preview chi tinh booking duoc xem la da ghi nhan thuc su
- `components/site/status-pill.tsx`
  - bo sung mau cho `failed`, `partially_refunded`, `expired`, `open`, `in_progress`, `resolved`, `closed`

### Kiem tra sau thay doi
- `cmd /c npm run lint` -> PASS
- `cmd /c npm run build` -> PASS

### Ghi chu logic hien tai sau khi sua
- `cancel_requested` = yeu cau huy da duoc ghi nhan, nhung booking chua bi huy xong
- chi management moi co quyen chot `duyet huy` / `tu choi huy`
- booking da huy / hoan tien / dang cho huy khong con duoc danh dau thanh toan nua
- thong tin profile / wishlist / support / review da bam theo session dang nhap that thay vi tin `userId` tu frontend

## 2026-03-24 - review va support flow duoc sua theo logic thuc te

### Van de user bao
- luong review va ho tro chua dung voi thuc te
- admin chua co UI de duyet / an / phan hoi review
- admin chua co UI de nhan xu ly / giai quyet / dong ticket
- booking page chua cho user thay ro trang thai review va ticket

### Rule moi da ap dung
- review:
  - chi booking `completed` moi duoc review
  - neu customer sua review da gui truoc do thi review quay lai `pending`
  - khi customer sua review, `review_replies` cu bi xoa de tranh hien phan hoi da loi thoi
  - chi review `approved` moi len public site
- support ticket:
  - cung 1 booking khong duoc mo nhieu ticket dang hoat dong cung luc
  - neu booking da co ticket `open` / `in_progress` / `resolved` thi customer phai tiep tuc ticket hien co
  - staff reply vao ticket `open` se tu dong day sang `in_progress`
  - customer reply vao ticket `resolved` hoac `closed` se mo lai ticket ve `open`
  - staff co cac buoc chuyen trang thai ro rang: `open` <-> `in_progress` -> `resolved` -> `closed` va co the `open` lai khi can

### File logic moi
- `lib/customer-care-logic.ts`
  - `canCustomerReviewBooking`
  - `isTicketActive`
  - `canCustomerReplyTicket`
  - `getTicketStatusAfterCustomerReply`
  - `getTicketStatusAfterStaffReply`
  - `getAllowedStaffTicketTransitions`
  - `getReviewStatusDescription`
  - `getSupportStatusDescription`

### API da sua / them
- `app/api/reviews/route.ts`
  - dung `canCustomerReviewBooking`
  - update review se xoa `review_replies` cu
- `app/api/reviews/moderate/route.ts`
  - admin/staff co the `approved` / `hidden`
  - co the luu `replyText`
- `app/api/support-tickets/route.ts`
  - chan tao ticket moi neu booking da co ticket dang hoat dong
- `app/api/support-tickets/manage/route.ts`
  - validate transition status thuc te hon
  - reply cua staff co the day ticket `open` sang `in_progress`
  - notify lai cho customer khi co cap nhat
- Them `app/api/support-tickets/reply/route.ts`
  - customer gui them tin nhan vao ticket hien co
  - neu ticket dang `resolved` / `closed` thi mo lai ve `open`

### UI da sua
- `components/site/booking-actions.tsx`
  - bo wording `demo`, doi thanh action theo trang thai that
  - support block gio uu tien tiep tuc ticket dang hoat dong thay vi mo ticket trung
  - review block hien ro trang thai review va reply tu staff neu co
- `app/booking/[code]/page.tsx`
  - hien panel `Trang thai danh gia`
  - hien reply tu The Horizon neu review da duoc staff phan hoi
  - hien mo ta trang thai cho tung ticket lien quan
  - truyen review + tickets day du vao `BookingActions`
- `components/site/admin/admin-console.tsx`
  - reviews module: duyet hien thi, an review, luu phan hoi
  - support module: hien recent messages, nhan xu ly, danh dau da giai quyet, dong ticket, mo lai, gui phan hoi cho khach

### Kiem tra sau thay doi
- `cmd /c npm run lint` -> PASS
- `cmd /c npm run build` -> PASS
