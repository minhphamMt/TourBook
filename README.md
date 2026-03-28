# TourBook Static

TourBook hiện đã được chuyển sang cấu trúc thuần `HTML`, `CSS`, `JavaScript`.

## Cấu trúc

- `pages/`: mỗi trang tính năng là một file HTML riêng
- `css/`: mỗi trang có file CSS riêng, dùng chung với `base.css`
- `js/`: mỗi trang có file JS riêng và `api.js` là lớp gọi Supabase/Auth
- `supabase/`: giữ lại schema, seed và script SQL của backend Supabase

## Chạy local

```bash
npm install
npm run dev
```

Sau đó mở `http://localhost:5500`.

## Ghi chú

- Dự án không còn dùng Next.js / React.
- Frontend gọi trực tiếp Supabase REST/Auth bằng `fetch`.
- Các route động được chuyển sang dạng query string, ví dụ:
  - `/tour-detail?slug=ha-giang-loop`
  - `/booking-detail?code=TB123456`
