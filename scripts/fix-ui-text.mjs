import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { normalizeUiText } from "../js/shared.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");

const EXTRA_REPLACEMENTS = [
  ["Theo dõi don d?t tour và vòng d?i booking th?t.", "Theo dõi don d?t tour và vòng d?i booking th?t."],
  ["Qu?n lý h? so, vai trò và quy?n truy c?p h? th?ng.", "Qu?n lý h? so, vai trò và quy?n truy c?p h? th?ng."],
  ["Theo dõi thanh toán, hoàn ti?n và phuong th?c dang b?t.", "Theo dõi thanh toán, hoàn ti?n và phuong th?c dang b?t."],
  ["Qu?n lý tour, l?ch kh?i hành và ch? còn l?i.", "Qu?n lý tour, l?ch kh?i hành và ch? còn l?i."],
  ["Theo dõi coupon, usage và hi?u qu? gi?m giá.", "Theo dõi coupon, usage và hi?u qu? gi?m giá."],
  ["Qu?n lý banner và CMS dang ch?y trên website.", "Qu?n lý banner và CMS dang ch?y trên website."],
  ["X? lý ticket, review backlog và ph?n h?i khách hàng.", "X? lý ticket, review backlog và ph?n h?i khách hàng."],
  ["Xem l?ch s? d?t tour, chi tiêu và m?c d? quay l?i.", "Xem l?ch s? d?t tour, chi tiêu và m?c d? quay l?i."],
  ["Ki?m tra c?u hình h? th?ng, payment methods và role model.", "Ki?m tra c?u hình h? th?ng, payment methods và role model."],
  ["Xem doanh thu, hoàn ti?n và mix booking theo vùng.", "Xem doanh thu, hoàn ti?n và mix booking theo vùng."],
  ["T?ng h?p t? roles và user_roles hi?n t?i.", "T?ng h?p t? roles và user_roles hi?n t?i."],
  ["M? popup d? d?i quy?n h?c khóa tài kho?n mà không c?n s?a DB tay.", "M? popup d? d?i quy?n ho?c khóa tài kho?n mà không c?n s?a DB tay."],
  ["Booking m?i nh?t", "Booking m?i nh?t"],
  ["Booking m?i (7 ngày g?n nh?t)", "Booking m?i (7 ngày g?n nh?t)"],
  ["Booking m?i (7 ngày g?n nh?t)", "Booking m?i (7 ngày g?n nh?t)"],
  ["Doanh thu thu v? (7 ngày g?n nh?t)", "Doanh thu thu v? (7 ngày g?n nh?t)"],
  ["2 m?c ch? x? lý", "2 m?c ch? x? lý"],
  ["booking ch? x? lý", "booking ch? x? lý"],
  ["giao d?ch c?n xem", "giao d?ch c?n xem"],
  ["Phân b? vai trò", "Phân b? vai trò"],
  ["Ngu?i dùng g?n dây", "Ngu?i dùng g?n dây"],
  ["Hàng d?i h? tr?", "Hàng d?i h? tr?"],
  ["The Horizon | H?nh kh?ch", "The Horizon | Hành khách"],
  ["The Horizon | H? tr?", "The Horizon | H? tr?"],
  ["The Horizon | T?ng quan admin", "The Horizon | T?ng quan admin"],
  ["The Horizon | Tour v? l?ch", "The Horizon | Tour và l?ch"],
  ["The Horizon | N?i dung", "The Horizon | N?i dung"],
  ["Ngu?i dùng", "Ngu?i dùng"],
  ["Ngu?i d?ng", "Ngu?i dùng"],
  ["ngu?i dùng", "ngu?i dùng"],
  ["Ði?u hu?ng", "Ði?u hu?ng"],
  ["?i?u h??ng", "Ði?u hu?ng"],
  ["V?n hành", "V?n hành"],
  ["H? th?ng", "H? th?ng"],
  ["Ð?t tour", "Ð?t tour"],
  ["Giao d?ch", "Giao d?ch"],
  ["Khuy?n mãi", "Khuy?n mãi"],
  ["N?i dung", "N?i dung"],
  ["Cài d?t", "Cài d?t"],
  ["H? tr? & review", "H? tr? & review"],
  ["H? tr? và review", "H? tr? và review"],
  ["Qu?n tr? viên", "Qu?n tr? viên"],
  ["quy?n truy c?p", "quy?n truy c?p"],
  ["vòng d?i", "vòng d?i"],
  ["phuong th?c dang b?t", "phuong th?c dang b?t"],
  ["Tour và l?ch kh?i hành", "Tour và l?ch kh?i hành"],
  ["ch? còn l?i", "ch? còn l?i"],
  ["hi?u qu? gi?m giá", "hi?u qu? gi?m giá"],
  ["dang ch?y trên website", "dang ch?y trên website"],
  ["Ch? x? l?", "Ch? x? lý"],
  ["Ðã xác nh?n", "Ðã xác nh?n"],
  ["Ðã h?y", "Ðã h?y"],
  ["Chua thanh toán", "Chua thanh toán"],
  ["Ð?t c?c", "Ð?t c?c"],
  ["Ðã thanh toán", "Ðã thanh toán"],
  ["L?i thanh toán", "L?i thanh toán"],
  ["Ðã gi? ti?n", "Ðã gi? ti?n"],
  ["H?t h?n", "H?t h?n"],
  ["Ðã hoàn ti?n", "Ðã hoàn ti?n"],
  ["Hoàn ti?n m?t ph?n", "Hoàn ti?n m?t ph?n"],
  ["Ðang m?", "Ðang m?"],
  ["H?t ch?", "H?t ch?"],
  ["Ðã ?n", "Ðã ?n"],
  ["Ðã duy?t", "Ðã duy?t"],
  ["Ðang x? lý", "Ðang x? lý"],
  ["Ðã x? lý", "Ðã x? lý"],
  ["Ðóng", "Ðóng"],
  ["Kh?i hành", "Kh?i hành"],
  ["T?ng ti?n", "T?ng ti?n"],
  ["Giá tr?", "Giá tr?"],
  ["Chua", "Chua"],
  ["g?n dây", "g?n dây"],
  ["Xem t?t c?", "Xem t?t c?"],
  ["M? trung t?m h? tr?", "M? trung tâm h? tr?"],
  ["Cu?c tr? chuy?n", "Cu?c trò chuy?n"],
  ["Wishlist ?ang tr?ng", "Wishlist dang tr?ng"],
  ["Thông báo chua d?c", "Thông báo chua d?c"],
  ["Danh s?ch h?nh kh?ch", "Danh sách hành khách"],
  ["Danh s?ch ??a ch?", "Danh sách d?a ch?"],
  ["H? s? t?i kho?n", "H? so tài kho?n"],
  ["H? v? t?n", "H? và tên"],
  ["Lo?i h?nh kh?ch", "Lo?i hành khách"],
  ["Ng??i l?n", "Ngu?i l?n"],
  ["Tr? em", "Tr? em"],
  ["Em b?", "Em bé"],
  ["Ng?y sinh", "Ngày sinh"],
  ["Gi?i t?nh", "Gi?i tính"],
  ["Ch?n gi?i t?nh", "Ch?n gi?i tính"],
  ["N?", "N?"],
  ["Kh?c", "Khác"],
  ["Qu?c t?ch", "Qu?c t?ch"],
  ["S? ?i?n tho?i", "S? di?n tho?i"],
  ["Ghi ch?", "Ghi chú"],
  ["C?p nh?t h?nh kh?ch", "C?p nh?t hành khách"],
  ["Th?m h?nh kh?ch", "Thêm hành khách"],
  ["H?y s?a", "H?y s?a"],
  ["Nh?n ??a ch?", "Nhãn d?a ch?"],
  ["??a ch? chi ti?t", "Ð?a ch? chi ti?t"],
  ["T?nh / Th?nh", "T?nh / Thành"],
  ["Qu?n / Huy?n", "Qu?n / Huy?n"],
  ["Ph??ng / X?", "Phu?ng / Xã"],
  ["M? b?u ch?nh", "Mã buu chính"],
  ["??t l?m ??a ch? m?c ??nh", "Ð?t làm d?a ch? m?c d?nh"],
  ["C?p nh?t ??a ch?", "C?p nh?t d?a ch?"],
  ["Th?m ??a ch?", "Thêm d?a ch?"],
  ["Chuy?n ?i s?p t?i", "Chuy?n di s?p t?i"],
  ["D?a trên l?ch kh?i hành chua hoàn t?t.", "D?a trên l?ch kh?i hành chua hoàn t?t."],
  ["Ticket ?ang m?", "Ticket dang m?"],
  ["Booking g?n dây", "Booking g?n dây"],
  ["?ang l?u trong wishlist", "dang luu trong wishlist"],
  ["No booking image in DB", "?nh booking chua có"],
  ["No tour image in DB", "?nh tour chua có"],
  ["No image in DB", "?nh chua có trong DB"],
  ["No image", "Chua có ?nh"]
].sort((left, right) => right[0].length - left[0].length);

function fixText(value) {
  let result = String(value);
  for (let index = 0; index < 4; index += 1) {
    const previous = result;
    result = normalizeUiText(result);
    EXTRA_REPLACEMENTS.forEach(([from, to]) => {
      result = result.split(from).join(to);
    });
    if (result === previous) break;
  }
  return result;
}

function walk(dir, predicate, files = []) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  entries.forEach((entry) => {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "node_modules" || entry.name === ".git" || entry.name === "dist") return;
      walk(fullPath, predicate, files);
      return;
    }
    if (predicate(fullPath)) files.push(fullPath);
  });
  return files;
}

const targets = [
  ...walk(path.join(rootDir, "js"), (file) => file.endsWith(".js") && !file.endsWith(".bak-task9-encoding")),
  ...walk(path.join(rootDir, "pages"), (file) => file.endsWith(".html"))
];

const versionFrom = "20260331k";
const versionTo = "20260331m";

let updatedCount = 0;
targets.forEach((file) => {
  const raw = fs.readFileSync(file, "utf8");
  let next = fixText(raw);
  next = next.split(versionFrom).join(versionTo);
  if (next !== raw) {
    fs.writeFileSync(file, next, "utf8");
    updatedCount += 1;
    console.log(`updated ${path.relative(rootDir, file)}`);
  }
});

console.log(`updated files: ${updatedCount}`);
