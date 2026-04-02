import { formatCurrency, getToursPageData } from "./api.js";
import { routePath } from "./routes.js";
import { escapeHtml, mountLayout, qs, renderTourCard, setPageError, setLoading } from "./shared.js?v=20260331m";

function readFilters() {
  const params = new URLSearchParams(window.location.search);
  return {
    query: params.get("query") || "",
    category: params.get("category") || "",
    destination: params.get("destination") || "",
    date: params.get("date") || "",
    duration: params.get("duration") || "",
    priceMin: params.get("priceMin") || "",
    priceMax: params.get("priceMax") || "",
    ratingMin: params.get("ratingMin") || "",
    sort: params.get("sort") || "popular"
  };
}

function renderOptions(items, selected, getValue, getLabel) {
  return items
    .map((item) => {
      const value = getValue(item);
      const active = value === selected ? " selected" : "";
      return `<option value="${escapeHtml(value)}"${active}>${escapeHtml(getLabel(item))}</option>`;
    })
    .join("");
}

function renderDurationChip(value, label, activeValue) {
  return `<button class="tour-duration-chip ${value === activeValue ? "is-active" : ""}" type="button" data-duration="${value}">${label}</button>`;
}

function formatDateLabel(value) {
  if (!value) return "";
  try {
    return new Intl.DateTimeFormat("vi-VN", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric"
    }).format(new Date(value));
  } catch {
    return value;
  }
}

function buildActiveFilters(data, filters) {
  const items = [];
  const category = data.categories.find((item) => item.slug === filters.category);
  const destination = data.destinations.find((item) => item.location.slug === filters.destination);

  if (filters.query) items.push(`Từ khóa: ${filters.query}`);
  if (category) items.push(`Danh mục: ${category.name}`);
  if (destination) items.push(`Điểm đến: ${destination.location.name}`);
  if (filters.date) items.push(`Ngày đi từ: ${formatDateLabel(filters.date)}`);
  if (filters.duration) items.push(`Thời lượng: ${filters.duration}`);
  if (filters.priceMin) items.push(`Giá từ: ${formatCurrency(Number(filters.priceMin))}`);
  if (filters.priceMax) items.push(`Giá đến: ${formatCurrency(Number(filters.priceMax))}`);
  if (filters.ratingMin) items.push(`Rating từ: ${filters.ratingMin}+`);
  return items;
}

async function init() {
  await mountLayout("tours");

  const intro = qs("#tours-intro");
  const filterShell = qs("#tour-filter-shell");
  const summary = qs("#tour-summary");
  const results = qs("#tour-results");
  const pagination = qs("#tour-pagination");
  const filters = readFilters();

  setLoading(filterShell);
  setLoading(summary);
  setLoading(results);
  pagination.innerHTML = "";

  try {
    const data = await getToursPageData(filters);
    const activeFilters = buildActiveFilters(data, filters);

    intro.innerHTML = `
      <section class="tours-intro">
        <span class="eyebrow">Tours</span>
        <h1>Khám phá hành trình theo điều kiện thực tế</h1>
        <p>Bộ lọc bên dưới đang đọc trực tiếp từ catalog public, giúp bạn thu hẹp tour theo điểm đến, giá, rating và ngày khởi hành.</p>
      </section>
    `;

    filterShell.innerHTML = `
      <form id="tour-filter-form" class="tour-filter-card">
        <div class="tour-filter-head">
          <h2>Bộ lọc tìm kiếm</h2>
          <p>Chỉ giữ những điều kiện thực sự phục vụ chọn tour: điểm đến, ngày đi, giá, rating và danh mục.</p>
        </div>
        <div class="tour-filter-group">
          <label>
            Từ khóa
            <input type="search" name="query" value="${escapeHtml(filters.query)}" placeholder="Tên tour, trải nghiệm, điểm đến..." />
          </label>
        </div>
        <div class="tour-filter-group">
          <label>
            Điểm đến
            <select name="destination">
              <option value="">Tất cả</option>
              ${renderOptions(data.destinations, filters.destination, (item) => item.location.slug, (item) => item.location.name)}
            </select>
          </label>
        </div>
        <div class="tour-filter-group">
          <label>
            Danh mục
            <select name="category">
              <option value="">Tất cả</option>
              ${renderOptions(data.categories, filters.category, (item) => item.slug, (item) => item.name)}
            </select>
          </label>
        </div>
        <div class="tour-filter-group">
          <label>
            Ngày đi từ
            <input type="date" name="date" value="${escapeHtml(filters.date)}" />
          </label>
        </div>
        <div class="tour-filter-group">
          <span class="tour-filter-label">Thời lượng</span>
          <input type="hidden" name="duration" value="${escapeHtml(filters.duration)}" />
          <div class="tour-duration-grid">
            ${renderDurationChip("1-3", "1-3 Ngày", filters.duration)}
            ${renderDurationChip("4-7", "4-7 Ngày", filters.duration)}
            ${renderDurationChip("8-14", "8-14 Ngày", filters.duration)}
            ${renderDurationChip("14+", "Trên 2 tuần", filters.duration)}
          </div>
        </div>
        <div class="tour-filter-group tour-filter-group-inline">
          <label>
            Giá từ
            <input type="number" min="0" step="100000" name="priceMin" value="${escapeHtml(filters.priceMin)}" placeholder="${escapeHtml(String(data.priceBounds.min || 0))}" />
          </label>
          <label>
            Giá đến
            <input type="number" min="0" step="100000" name="priceMax" value="${escapeHtml(filters.priceMax)}" placeholder="${escapeHtml(String(data.priceBounds.max || 0))}" />
          </label>
        </div>
        <div class="tour-filter-group">
          <label>
            Rating tối thiểu
            <select name="ratingMin">
              <option value="">Không giới hạn</option>
              <option value="3.5"${filters.ratingMin === "3.5" ? " selected" : ""}>Từ 3.5</option>
              <option value="4"${filters.ratingMin === "4" ? " selected" : ""}>Từ 4.0</option>
              <option value="4.5"${filters.ratingMin === "4.5" ? " selected" : ""}>Từ 4.5</option>
            </select>
          </label>
        </div>
        <div class="tour-filter-group">
          <label>
            Sắp xếp
            <select name="sort">
              <option value="popular"${filters.sort === "popular" ? " selected" : ""}>Phổ biến</option>
              <option value="newest"${filters.sort === "newest" ? " selected" : ""}>Mới nhất</option>
              <option value="price-asc"${filters.sort === "price-asc" ? " selected" : ""}>Giá thấp nhất</option>
              <option value="rating"${filters.sort === "rating" ? " selected" : ""}>Rating cao nhất</option>
              <option value="price-desc"${filters.sort === "price-desc" ? " selected" : ""}>Giá cao nhất</option>
            </select>
          </label>
        </div>
        <div class="tour-filter-note">
          <strong>Khoảng giá công khai</strong>
          <p>${escapeHtml(formatCurrency(data.priceBounds.min || 0))} - ${escapeHtml(formatCurrency(data.priceBounds.max || 0))}</p>
        </div>
        <div class="tour-filter-actions">
          <button class="button button-primary" type="submit">Áp dụng</button>
          <a class="button button-secondary" href="${routePath("tours")}">Đặt lại</a>
        </div>
      </form>
    `;

    summary.innerHTML = `
      <section class="tour-summary-bar">
        <div>
          <span class="eyebrow">Kết quả</span>
          <h2>${data.matchingCount} / ${data.totalCount} hành trình phù hợp</h2>
          <p>${activeFilters.length ? "Bộ lọc hiện tại đang giới hạn đúng những tour khớp điều kiện bạn chọn." : "Danh sách đang hiển thị toàn bộ tour public đã publish trên hệ thống."}</p>
        </div>
        <div class="tour-active-filters">
          ${activeFilters.length ? activeFilters.map((item) => `<span class="tour-active-chip">${escapeHtml(item)}</span>`).join("") : `<span class="tour-active-chip">Toàn bộ tour</span>`}
        </div>
      </section>
    `;

    results.innerHTML = data.tours.length
      ? data.tours.map((tour) => renderTourCard(tour)).join("")
      : "<div class='empty-state'><h3>Không có tour phù hợp</h3><p>Hãy nới điều kiện lọc hoặc quay lại danh sách mặc định để xem thêm hành trình.</p></div>";

    pagination.innerHTML = "";

    const form = qs("#tour-filter-form");
    const durationInput = form.querySelector('[name="duration"]');
    const durationButtons = Array.from(form.querySelectorAll("[data-duration]"));

    durationButtons.forEach((button) => {
      button.addEventListener("click", () => {
        const nextValue = button.dataset.duration || "";
        durationInput.value = durationInput.value === nextValue ? "" : nextValue;
        durationButtons.forEach((item) => item.classList.toggle("is-active", item.dataset.duration === durationInput.value));
      });
    });

    form.addEventListener("submit", (event) => {
      event.preventDefault();
      const params = new URLSearchParams();
      const formData = new FormData(form);
      formData.forEach((value, key) => {
        if (value != null && String(value).trim() !== "") {
          params.set(key, value.toString());
        }
      });
      window.location.href = routePath("tours", params);
    });
  } catch (error) {
    setPageError(filterShell, error);
    setPageError(summary, error);
    setPageError(results, error);
  }
}

void init();
