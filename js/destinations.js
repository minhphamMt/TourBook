import { getDestinationsData } from "./api.js";
import { createPageHero, mountLayout, qs, renderDestinationCard, setPageError, setLoading } from "./shared.js?v=20260331m";
import { escapeHtml } from "./shared.js?v=20260331m";

function renderGroupHighlight(group) {
  return `
    <article class="destination-highlight-card">
      <span>${escapeHtml(group.label)}</span>
      <strong>${escapeHtml(String(group.destinationCount))}</strong>
      <p>${escapeHtml(`${group.totalTours} tour đang công khai`)}</p>
    </article>
  `;
}

function renderRegionSection(group) {
  return `
    <section class="destination-region-section">
      <div class="destination-region-head">
        <div>
          <span class="eyebrow">${escapeHtml(group.label)}</span>
          <h2>${escapeHtml(group.label)}</h2>
          <p>${escapeHtml(group.description)}</p>
        </div>
        <div class="destination-region-meta">
          <span>${escapeHtml(String(group.destinationCount))} điểm đến</span>
          <span>${escapeHtml(String(group.totalTours))} tour</span>
          <span>${escapeHtml(String(group.totalOpenSchedules))} lịch mở</span>
        </div>
      </div>
      <div class="destination-region-grid">
        ${group.destinations.map((destination) => renderDestinationCard(destination)).join("")}
      </div>
    </section>
  `;
}

async function init() {
  await mountLayout("destinations");
  const hero = qs("#page-hero");
  const grid = qs("#destinations-grid");

  setLoading(grid);

  try {
    const data = await getDestinationsData();

    hero.innerHTML = createPageHero({
      eyebrow: "Điểm đến",
      title: "Khám phá theo vùng và điểm chạm đang có tour thật",
      description: `${data.totalDestinations} điểm đến • ${data.totalTours} tour công khai • ${data.totalOpenSchedules} lịch khởi hành đang mở.`
    });

    grid.innerHTML = data.groups.length
      ? `
        <div class="destination-page-stack">
          <section class="destination-highlight-grid">
            ${data.groups.slice(0, 4).map((group) => renderGroupHighlight(group)).join("")}
          </section>
          ${data.groups.map((group) => renderRegionSection(group)).join("")}
        </div>
      `
      : "<div class='empty-state'><h3>Chưa có điểm đến</h3><p>Thêm location và tour_destinations trong Supabase để hiển thị tại đây.</p></div>";
  } catch (error) {
    setPageError(grid, error);
  }
}

void init();
