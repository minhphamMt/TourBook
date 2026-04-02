import { isManagementRoute, normalizeInternalHref, routePath } from "../routes.js";
import { MANAGEMENT_ROLES, PROFILE_KEY, SESSION_KEY, SUPABASE_ANON_KEY, SUPABASE_URL } from "../config.js";

function buildQuery(params = {}) {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value == null || value === "") return;
    if (Array.isArray(value)) {
      value.forEach((item) => search.append(key, item));
      return;
    }
    search.append(key, value);
  });
  return search.toString();
}

function unique(values = []) {
  return Array.from(new Set(values.filter((value) => value != null && value !== "")));
}

function buildInFilter(values = []) {
  const items = unique(values).map((value) => String(value).trim()).filter(Boolean);
  return items.length ? `in.(${items.join(",")})` : null;
}

function toNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function average(values = []) {
  if (!values.length) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function compactText(value, fallback = "Đang cập nhật") {
  return String(value || "").trim() || fallback;
}

function splitRichText(value) {
  return String(value || "")
    .split(/\n|,|\.|;/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function normalizeSearch(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\w\s-]/g, "")
    .toLowerCase();
}

function formatCurrency(value, currency = "VND") {
  if (value == null || Number.isNaN(Number(value))) return "Liên hệ";
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency,
    maximumFractionDigits: 0
  }).format(Number(value));
}

function formatShortDate(value) {
  if (!value) return "Chưa có lịch";
  return new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric"
  }).format(new Date(value));
}

function formatLongDate(value) {
  if (!value) return "Chưa cập nhật";
  return new Intl.DateTimeFormat("vi-VN", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric"
  }).format(new Date(value));
}

function formatDateTime(value) {
  if (!value) return "Chưa cập nhật";
  return new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}

function formatDuration(days, nights) {
  return `${days} ngày ${nights} đêm`;
}

function statusLabel(status) {
  const map = {
    pending: "Tạm giữ chỗ",
    awaiting_payment: "Chờ thanh toán",
    confirmed: "Đã xác nhận",
    completed: "Đã hoàn thành",
    cancel_requested: "Chờ hủy",
    cancelled: "Đã hủy",
    expired: "Hết hiệu lực",
    unpaid: "Chưa thanh toán",
    partially_paid: "Đã cọc",
    paid: "Đã thanh toán",
    failed: "Thất bại",
    refunded: "Đã hoàn tiền",
    partially_refunded: "Hoàn tiền một phần",
    authorized: "Đã xác thực",
    open: "Đang mở",
    sold_out: "Hết chỗ",
    closed: "Đã đóng",
    hidden: "Đã ẩn",
    approved: "Đã duyệt",
    rejected: "Từ chối",
    in_progress: "Đang xử lý",
    resolved: "Đã xử lý",
    active: "Đang bật",
    inactive: "Tạm dừng",
    blocked: "Bị khóa"
  };
  return map[status] || String(status || "");
}

function normalizeRoles(roles = []) {
  const priority = ["super_admin", "admin", "staff", "customer"];
  return unique(roles.map((role) => String(role || "").toLowerCase())).sort((left, right) => {
    const leftIndex = priority.indexOf(left);
    const rightIndex = priority.indexOf(right);
    return (leftIndex === -1 ? priority.length : leftIndex) - (rightIndex === -1 ? priority.length : rightIndex);
  });
}

function getPrimaryRole(roles = []) {
  return normalizeRoles(roles)[0] || "customer";
}

function hasManagementRole(roles = []) {
  return normalizeRoles(roles).some((role) => MANAGEMENT_ROLES.includes(role));
}

function resolvePostLoginPath(roles = [], redirectTo) {
  const normalizedRedirect = normalizeInternalHref(redirectTo);
  if (normalizedRedirect) {
    if (!hasManagementRole(roles) && isManagementRoute(normalizedRedirect)) {
      return routePath("account");
    }
    return normalizedRedirect;
  }

  return hasManagementRole(roles) ? routePath("admin") : routePath("account");
}

function getEffectivePrice(price) {
  return price?.salePrice ?? price?.price ?? 0;
}

function computeSubtotal(counts, prices = []) {
  const map = new Map(prices.map((price) => [price.travelerType, getEffectivePrice(price)]));
  return (
    toNumber(counts?.adults) * (map.get("adult") || 0) +
    toNumber(counts?.children) * (map.get("child") || 0) +
    toNumber(counts?.infants) * (map.get("infant") || 0)
  );
}

function isCouponEligible(coupon, subtotal = 0, now = new Date()) {
  if (!coupon?.isActive) return false;
  if (coupon.startAt && new Date(coupon.startAt).getTime() > now.getTime()) return false;
  if (coupon.endAt && new Date(coupon.endAt).getTime() < now.getTime()) return false;
  if (subtotal < toNumber(coupon.minOrderAmount, 0)) return false;
  if (coupon.usageLimit != null && toNumber(coupon.usedCount, 0) >= toNumber(coupon.usageLimit, 0)) return false;
  if (coupon.usagePerUserLimit != null && toNumber(coupon.userUsedCount, 0) >= toNumber(coupon.usagePerUserLimit, 0)) return false;
  return true;
}

function computeCouponDiscount(subtotal, coupon) {
  if (!isCouponEligible(coupon, subtotal)) return 0;
  const raw = coupon.discountType === "percentage"
    ? subtotal * (toNumber(coupon.discountValue) / 100)
    : toNumber(coupon.discountValue);
  return Math.max(0, Math.round(coupon.maxDiscountAmount == null ? raw : Math.min(raw, toNumber(coupon.maxDiscountAmount))));
}

function readStorage(key, fallback) {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function writeStorage(key, value) {
  if (typeof window === "undefined") return;
  localStorage.setItem(key, JSON.stringify(value));
}

function removeStorage(key) {
  if (typeof window === "undefined") return;
  localStorage.removeItem(key);
}

function readStoredSession() {
  return readStorage(SESSION_KEY, null);
}

function saveStoredSession(session) {
  if (!session) {
    removeStorage(SESSION_KEY);
    return;
  }
  writeStorage(SESSION_KEY, session);
}

function readProfiles() {
  return readStorage(PROFILE_KEY, {});
}

function saveProfiles(value) {
  writeStorage(PROFILE_KEY, value);
}

function ensureProfile(user, overrides = {}) {
  if (!user?.id) return null;

  const profiles = readProfiles();
  const { roles: overrideRoles, ...restOverrides } = overrides;
  const next = {
    id: user.id,
    email: restOverrides.email ?? user.email ?? "",
    full_name: restOverrides.full_name ?? user.user_metadata?.full_name ?? "",
    phone: restOverrides.phone ?? "",
    avatar_url: restOverrides.avatar_url ?? user.user_metadata?.avatar_url ?? "",
    address: restOverrides.address ?? "",
    customer_level: restOverrides.customer_level ?? "regular",
    status: restOverrides.status ?? "active",
    wishlistTourIds: restOverrides.wishlistTourIds ?? profiles[user.id]?.wishlistTourIds ?? [],
    ...restOverrides
  };

  next.roles = normalizeRoles(overrideRoles || profiles[user.id]?.roles || ["customer"]);
  profiles[user.id] = next;
  saveProfiles(profiles);
  return next;
}

async function parseResponse(response) {
  const text = await response.text();
  let data = null;

  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
  }

  if (!response.ok) {
    throw new Error(
      data?.msg ||
        data?.message ||
        data?.error_description ||
        data?.error ||
        (typeof data === "string" && data.trim()) ||
        `Yêu cầu thất bại (${response.status})`
    );
  }

  return data;
}

function getRequestToken(requireAuth = false) {
  const session = readStoredSession();
  const token = session?.access_token;
  if (requireAuth && !token) throw new Error("Bạn cần đăng nhập để tiếp tục.");
  return token || SUPABASE_ANON_KEY;
}

function buildRequestHeaders({ token, includeJson = false, extra = {} } = {}) {
  const headers = { apikey: SUPABASE_ANON_KEY, ...extra };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (includeJson) headers["Content-Type"] = "application/json";
  return headers;
}

async function authRequest(path, { method = "GET", body, token, requireSession = false } = {}) {
  const authToken = token || getRequestToken(requireSession);
  const response = await fetch(`${SUPABASE_URL}${path}`, {
    method,
    headers: buildRequestHeaders({ token: authToken, includeJson: body !== undefined }),
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  return parseResponse(response);
}

async function restSelect(table, query = {}) {
  const url = `${SUPABASE_URL}/rest/v1/${table}${Object.keys(query).length ? `?${buildQuery(query)}` : ""}`;
  const token = getRequestToken(false);
  const response = await fetch(url, {
    headers: buildRequestHeaders({ token })
  });
  return parseResponse(response);
}

async function restWrite(table, { method = "POST", query = {}, body, headers = {} } = {}) {
  const url = `${SUPABASE_URL}/rest/v1/${table}${Object.keys(query).length ? `?${buildQuery(query)}` : ""}`;
  const token = getRequestToken(true);
  const response = await fetch(url, {
    method,
    headers: buildRequestHeaders({
      token,
      includeJson: body !== undefined,
      extra: { Prefer: "return=representation", ...headers }
    }),
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  return parseResponse(response);
}

async function safeSelect(table, query = {}) {
  try {
    return await restSelect(table, query);
  } catch {
    return [];
  }
}

async function safeSingle(table, query = {}) {
  const rows = await safeSelect(table, { ...query, limit: query.limit || 1 });
  return rows[0] || null;
}

async function getProfileRecord(userId) {
  if (!userId) return null;
  return safeSingle("profiles", {
    select: "id,email,full_name,phone,avatar_url,address,status,customer_level,created_at,updated_at",
    id: `eq.${userId}`
  });
}

function syncProfileCache(user, profileRow, roles = []) {
  return ensureProfile(user, {
    email: profileRow?.email || user?.email || "",
    full_name: profileRow?.full_name || user?.user_metadata?.full_name || "",
    phone: profileRow?.phone || "",
    avatar_url: profileRow?.avatar_url || user?.user_metadata?.avatar_url || "",
    address: profileRow?.address || "",
    customer_level: profileRow?.customer_level || "regular",
    status: profileRow?.status || "active",
    roles
  });
}

export async function signIn(email, password) {
  const payload = await authRequest("/auth/v1/token?grant_type=password", {
    method: "POST",
    body: { email, password }
  });
  saveStoredSession(payload);
  if (payload?.user) ensureProfile(payload.user, { full_name: payload.user.user_metadata?.full_name || "" });
  return payload;
}

export async function signUp({ fullName, email, password }) {
  const payload = await authRequest("/auth/v1/signup", {
    method: "POST",
    body: { email, password, data: { full_name: fullName } }
  });
  if (payload?.user) ensureProfile(payload.user, { full_name: fullName || payload.user.user_metadata?.full_name || "" });
  if (payload?.access_token) saveStoredSession(payload);
  return payload;
}

export const signInWithEmail = signIn;
export const registerWithEmail = signUp;

export async function signOut() {
  const token = readStoredSession()?.access_token;
  try {
    if (token) {
      await authRequest("/auth/v1/logout", {
        method: "POST",
        token,
        requireSession: true
      });
    }
  } catch {
    // noop
  }
  saveStoredSession(null);
}

export async function getCurrentUser() {
  return readStoredSession()?.user || null;
}

export function getCurrentSession() {
  return readStoredSession();
}

async function resolveRolesForUser(user, fallbackRoles = []) {
  if (!user?.id) return normalizeRoles(fallbackRoles.length ? fallbackRoles : ["customer"]);

  const [roleRows, assignments] = await Promise.all([
    safeSelect("roles", { select: "id,name" }),
    safeSelect("user_roles", { select: "user_id,role_id", user_id: `eq.${user.id}` })
  ]);

  const roleMap = new Map(roleRows.map((item) => [item.id, String(item.name || "").toLowerCase()]));
  const resolvedRoles = assignments.map((item) => roleMap.get(item.role_id)).filter(Boolean);
  return normalizeRoles(resolvedRoles.length ? resolvedRoles : (fallbackRoles.length ? fallbackRoles : ["customer"]));
}

export async function getAuthContext() {
  const user = await getCurrentUser();
  if (!user) {
    return {
      session: null,
      user: null,
      profile: null,
      roles: [],
      primaryRole: "guest",
      isManagement: false
    };
  }

  const [profileRow, roles] = await Promise.all([
    getProfileRecord(user.id),
    resolveRolesForUser(user, ["customer"])
  ]);

  const profile = syncProfileCache(user, profileRow, roles);
  return {
    session: readStoredSession(),
    user,
    profile,
    roles,
    primaryRole: getPrimaryRole(roles),
    isManagement: hasManagementRole(roles)
  };
}

function requireAuth(auth, errorMessage = "Bạn cần đăng nhập để tiếp tục.") {
  if (!auth?.user) throw new Error(errorMessage);
  return auth;
}

function requireManagement(auth, errorMessage = "Bạn không có quyền truy cập khu quản trị.") {
  requireAuth(auth, errorMessage);
  if (!auth.isManagement) throw new Error(errorMessage);
  return auth;
}

async function createNotification({ userId, title, content, notificationType, referenceType, referenceId }) {
  if (!userId || !title || !content || !notificationType) return null;
  try {
    const rows = await restWrite("notifications", {
      method: "POST",
      query: { select: "*" },
      body: {
        user_id: userId,
        title,
        content,
        notification_type: notificationType,
        reference_type: referenceType || null,
        reference_id: referenceId || null
      }
    });
    return rows?.[0] || null;
  } catch {
    return null;
  }
}

async function createActivityLog({ actorId, action, entityType, entityId, oldData = null, newData = null }) {
  if (!actorId || !action || !entityType) return null;
  try {
    const rows = await restWrite("activity_logs", {
      method: "POST",
      query: { select: "*" },
      body: {
        actor_id: actorId,
        action,
        entity_type: entityType,
        entity_id: entityId || null,
        old_data: oldData,
        new_data: newData
      }
    });
    return rows?.[0] || null;
  } catch {
    return null;
  }
}

export {
  authRequest,
  average,
  buildInFilter,
  buildQuery,
  compactText,
  computeCouponDiscount,
  computeSubtotal,
  createActivityLog,
  createNotification,
  ensureProfile,
  formatCurrency,
  formatDateTime,
  formatDuration,
  formatLongDate,
  formatShortDate,
  getEffectivePrice,
  getPrimaryRole,
  getProfileRecord,
  getRequestToken,
  hasManagementRole,
  isCouponEligible,
  normalizeRoles,
  normalizeSearch,
  parseResponse,
  readProfiles,
  readStoredSession,
  readStorage,
  requireAuth,
  requireManagement,
  resolvePostLoginPath,
  restSelect,
  restWrite,
  safeSelect,
  safeSingle,
  saveProfiles,
  saveStoredSession,
  splitRichText,
  statusLabel,
  syncProfileCache,
  toNumber,
  unique,
  writeStorage
};

