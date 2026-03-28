const http = require("http");
const fs = require("fs");
const path = require("path");

const rootDir = __dirname;
const port = Number(process.env.PORT || 5500);

const routeMap = {
  "/": "pages/index.html",
  "/home": "pages/index.html",
  "/tours": "pages/tours.html",
  "/tour-detail": "pages/tour-detail.html",
  "/destinations": "pages/destinations.html",
  "/reviews": "pages/reviews.html",
  "/checkout": "pages/checkout.html",
  "/booking-detail": "pages/booking-detail.html",
  "/login": "pages/login.html",
  "/account": "pages/account.html",
  "/admin": "pages/admin.html",
  "/admin/dashboard": "pages/admin.html",
  "/admin/reports": "pages/admin-reports.html",
  "/admin/bookings": "pages/admin-bookings.html",
  "/admin/payments": "pages/admin-payments.html",
  "/admin/tours": "pages/admin-tours.html",
  "/admin/service": "pages/admin-service.html",
  "/admin/customers": "pages/admin-customers.html",
  "/admin/promotions": "pages/admin-promotions.html",
  "/admin/users": "pages/admin-users.html",
  "/admin/content": "pages/admin-content.html",
  "/admin/settings": "pages/admin-settings.html",
  "/about-us": "pages/about-us.html",
  "/privacy-policy": "pages/privacy-policy.html",
  "/terms-and-conditions": "pages/terms-and-conditions.html",
  "/404": "pages/404.html"
};

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".ico": "image/x-icon",
  ".txt": "text/plain; charset=utf-8"
};

function safeJoin(baseDir, targetPath) {
  const relativePath = String(targetPath || "").replace(/^[\\/]+/, "");
  const resolved = path.normalize(path.join(baseDir, relativePath));
  if (!resolved.startsWith(baseDir)) {
    return null;
  }
  return resolved;
}

function resolveRequestPath(urlPath) {
  if (routeMap[urlPath]) {
    return routeMap[urlPath];
  }

  if (!path.extname(urlPath)) {
    const inferredPage = `pages${urlPath}.html`;
    const inferredPagePath = safeJoin(rootDir, inferredPage);
    if (inferredPagePath && fs.existsSync(inferredPagePath)) {
      return inferredPage;
    }
  }

  return String(urlPath || "").replace(/^[\\/]+/, "");
}

function sendFile(response, filePath, statusCode = 200) {
  fs.readFile(filePath, (error, content) => {
    if (error) {
      if (error.code === "ENOENT") {
        const notFoundPath = safeJoin(rootDir, routeMap["/404"]);
        if (notFoundPath && fs.existsSync(notFoundPath)) {
          sendFile(response, notFoundPath, 404);
          return;
        }

        response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
        response.end("404 Not Found");
        return;
      }

      response.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" });
      response.end("500 Internal Server Error");
      return;
    }

    const contentType = mimeTypes[path.extname(filePath).toLowerCase()] || "application/octet-stream";
    response.writeHead(statusCode, { "Content-Type": contentType });
    response.end(content);
  });
}

const server = http.createServer((request, response) => {
  const requestUrl = new URL(request.url, `http://${request.headers.host}`);
  const mappedPath = resolveRequestPath(requestUrl.pathname);
  const filePath = safeJoin(rootDir, mappedPath === "/" ? routeMap["/"] : mappedPath);

  if (!filePath) {
    response.writeHead(403, { "Content-Type": "text/plain; charset=utf-8" });
    response.end("403 Forbidden");
    return;
  }

  let finalPath = filePath;
  if (fs.existsSync(finalPath) && fs.statSync(finalPath).isDirectory()) {
    finalPath = path.join(finalPath, "index.html");
  }

  sendFile(response, finalPath);
});

server.listen(port, () => {
  console.log(`TourBook static site is running at http://localhost:${port}`);
});

