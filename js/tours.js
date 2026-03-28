import { getToursPageData } from "./api.js";
import { routePath } from "./routes.js";
import { escapeHtml, mountLayout, qs, renderTourCard, setPageError, setLoading } from "./shared.js";

function readFilters() {
  const params = new URLSearchParams(window.location.search);
  return {
    query: params.get("query") || "",
    category: params.get("category") || "",
    destination: params.get("destination") || "",
    duration: params.get("duration") || "",
    sort: params.get("sort") || "featured"
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

function buildActiveFilters(data, filters) {
  const items = [];
  const category = data.categories.find((item) => item.slug === filters.category);
  const destination = data.destinations.find((item) => item.location.slug === filters.destination);

  if (filters.query) items.push(`Từ khóa: ${filters.query}`);
  if (category) items.push(`Danh mục: ${category.name}`);
  if (destination) items.push(`Điểm đến: ${destination.location.name}`);
  if (filters.duration) items.push(`Thời lượng: ${filters.duration}`);

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

    intro.innerHTML = `
      <section class="tours-intro">
        <span class="eyebrow">Tours</span>
        <h1>Khám phá Thế giới</h1>
        <p>Tìm kiếm những hành trình độc đáo được thiết kế riêng cho tâm hồn ưa khám phá của bạn.</p>
      </section>
    `;

    filterShell.innerHTML = `
      <form id="tour-filter-form" class="tour-filter-card">
        <div class="tour-filter-head">
          <h2>Bộ lọc tìm kiếm</h2>
          <p>Tinh chỉnh tour theo điểm đến, danh mục và thời lượng để chọn nhanh đúng hành trình.</p>
        </div>
        <div class="tour-filter-group">
          <label>
            Từ khóa
            <input type="search" name="query" value="${escapeHtml(filters.query)}" placeholder="Tên tour, điểm đến..." />
          </label>
        </div>
        <div class="tour-filter-group">
          <label>
            Loại tour
            <select name="category">
              <option value="">Tất cả</option>
              ${renderOptions(data.categories, filters.category, (item) => item.slug, (item) => item.name)}
            </select>
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
          <span class="tour-filter-label">Thời gian</span>
          <input type="hidden" name="duration" value="${escapeHtml(filters.duration)}" />
          <div class="tour-duration-grid">
            ${renderDurationChip("1-3", "1-3 Ngày", filters.duration)}
            ${renderDurationChip("4-7", "4-7 Ngày", filters.duration)}
            ${renderDurationChip("8-14", "8-14 Ngày", filters.duration)}
            ${renderDurationChip("14+", "Trên 2 tuần", filters.duration)}
          </div>
        </div>
        <div class="tour-filter-group">
          <label>
            Sắp xếp
            <select name="sort">
              <option value="featured"${filters.sort === "featured" ? " selected" : ""}>Ưu tiên nổi bật</option>
              <option value="rating"${filters.sort === "rating" ? " selected" : ""}>Đánh giá cao</option>
              <option value="price-asc"${filters.sort === "price-asc" ? " selected" : ""}>Giá tăng dần</option>
              <option value="price-desc"${filters.sort === "price-desc" ? " selected" : ""}>Giá giảm dần</option>
            </select>
          </label>
        </div>
        <div class="tour-filter-actions">
          <button class="button button-primary" type="submit">Áp dụng</button>
          <a class="button button-secondary" href="${routePath("tours")}">Đặt lại</a>
        </div>
      </form>
    `;

    const activeFilters = buildActiveFilters(data, filters);
    summary.innerHTML = `
      <section class="tour-summary-bar">
        <div>
          <span class="eyebrow">Kết quả</span>
          <h2>${data.tours.length} hành trình phù hợp</h2>
          <p>${activeFilters.length ? "Bộ lọc đang áp dụng giúp bạn thu gọn đúng nhóm tour cần tìm." : "Tất cả hành trình đang mở công khai đều được hiển thị tại đây."}</p>
        </div>
        <div class="tour-active-filters">
          ${activeFilters.length ? activeFilters.map((item) => `<span class="tour-active-chip">${escapeHtml(item)}</span>`).join("") : `<span class="tour-active-chip">Toàn bộ tour</span>`}
        </div>
      </section>
    `;

    results.innerHTML = data.tours.length
      ? data.tours.map((tour) => renderTourCard(tour)).join("")
      : "<div class='empty-state'><h3>Không có tour phù hợp</h3><p>Thử thay đổi bộ lọc hoặc quay lại danh sách mặc định để xem thêm hành trình.</p></div>";

    pagination.innerHTML = data.tours.length
      ? `
        <nav class="tour-pagination" aria-label="Phân trang tour">
          <button type="button" disabled>‹</button>
          <a class="is-active" href="${routePath("tours", filters)}">1</a>
          <span>…</span>
          <button type="button" disabled>›</button>
        </nav>
      `
      : "";

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
        if (value) params.set(key, value.toString());
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
