const ROUTES = {
  home: { pretty: "/", file: "/pages/index.html", aliases: ["/home"] },
  tours: { pretty: "/tours", file: "/pages/tours.html" },
  "tour-detail": { pretty: "/tour-detail", file: "/pages/tour-detail.html" },
  destinations: { pretty: "/destinations", file: "/pages/destinations.html" },
  reviews: { pretty: "/reviews", file: "/pages/reviews.html" },
  checkout: { pretty: "/checkout", file: "/pages/checkout.html" },
  "booking-detail": { pretty: "/booking-detail", file: "/pages/booking-detail.html" },
  login: { pretty: "/login", file: "/pages/login.html" },
  account: { pretty: "/account", file: "/pages/account.html", aliases: ["/account/dashboard"] },
  "account-bookings": { pretty: "/account/bookings", file: "/pages/account-bookings.html" },
  "account-support": { pretty: "/account/support", file: "/pages/account-support.html" },
  "account-wishlist": { pretty: "/account/wishlist", file: "/pages/account-wishlist.html" },
  "account-travelers": { pretty: "/account/travelers", file: "/pages/account-travelers.html" },
  "account-addresses": { pretty: "/account/addresses", file: "/pages/account-addresses.html" },
  "account-notifications": { pretty: "/account/notifications", file: "/pages/account-notifications.html" },
  "account-settings": { pretty: "/account/settings", file: "/pages/account-settings.html" },
  admin: { pretty: "/admin", file: "/pages/admin.html", aliases: ["/admin/dashboard"] },
  "admin-reports": { pretty: "/admin/reports", file: "/pages/admin-reports.html" },
  "admin-bookings": { pretty: "/admin/bookings", file: "/pages/admin-bookings.html" },
  "admin-payments": { pretty: "/admin/payments", file: "/pages/admin-payments.html" },
  "admin-tours": { pretty: "/admin/tours", file: "/pages/admin-tours.html" },
  "admin-service": { pretty: "/admin/service", file: "/pages/admin-service.html" },
  "admin-customers": { pretty: "/admin/customers", file: "/pages/admin-customers.html" },
  "admin-promotions": { pretty: "/admin/promotions", file: "/pages/admin-promotions.html" },
  "admin-users": { pretty: "/admin/users", file: "/pages/admin-users.html" },
  "admin-content": { pretty: "/admin/content", file: "/pages/admin-content.html" },
  "admin-settings": { pretty: "/admin/settings", file: "/pages/admin-settings.html" },
  "about-us": { pretty: "/about-us", file: "/pages/about-us.html" },
  "privacy-policy": { pretty: "/privacy-policy", file: "/pages/privacy-policy.html" },
  "terms-and-conditions": { pretty: "/terms-and-conditions", file: "/pages/terms-and-conditions.html" },
  "not-found": { pretty: "/404", file: "/pages/404.html" }
};

const MANAGEMENT_ROUTE_KEYS = [
  "admin",
  "admin-reports",
  "admin-bookings",
  "admin-payments",
  "admin-tours",
  "admin-service",
  "admin-customers",
  "admin-promotions",
  "admin-users",
  "admin-content",
  "admin-settings"
];

function getWindowOrigin() {
  return typeof window === "undefined" ? "http://localhost" : window.location.origin;
}

function prefersFileRoutes() {
  if (typeof window === "undefined") return false;

  const { pathname } = window.location;
  return pathname.startsWith("/pages/") || pathname.endsWith(".html");
}

function applySearchParams(url, params) {
  if (!params) return;

  const entries = params instanceof URLSearchParams ? params.entries() : Object.entries(params);
  for (const [key, value] of entries) {
    if (value == null || value === "") continue;
    url.searchParams.set(key, value);
  }
}

function findRouteByPath(pathname) {
  return Object.entries(ROUTES).find(([, route]) => [route.pretty, route.file, ...(route.aliases || [])].includes(pathname)) || null;
}

export function routePath(routeKey, params) {
  const route = ROUTES[routeKey];
  const basePath = route ? (prefersFileRoutes() ? route.file : route.pretty) : routeKey;
  const url = new URL(basePath, getWindowOrigin());
  applySearchParams(url, params);
  return `${url.pathname}${url.search}${url.hash}`;
}

export function isRoute(targetPath, routeKey) {
  if (!targetPath || !ROUTES[routeKey]) return false;

  const url = new URL(targetPath, getWindowOrigin());
  const route = ROUTES[routeKey];
  return [route.pretty, route.file, ...(route.aliases || [])].includes(url.pathname);
}

export function isManagementRoute(targetPath) {
  return MANAGEMENT_ROUTE_KEYS.some((routeKey) => isRoute(targetPath, routeKey));
}

export function normalizeInternalHref(href) {
  if (!href || typeof href !== "string") return href;
  if (/^(?:[a-z]+:)?\/\//i.test(href) || href.startsWith("mailto:") || href.startsWith("tel:") || href.startsWith("#")) {
    return href;
  }

  const url = new URL(href, getWindowOrigin());
  const matchedRoute = findRouteByPath(url.pathname);
  if (!matchedRoute) {
    return `${url.pathname}${url.search}${url.hash}`;
  }

  return routePath(matchedRoute[0], url.searchParams);
}

export { MANAGEMENT_ROUTE_KEYS, ROUTES };

