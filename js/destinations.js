import { getDestinationsData } from "./api.js";
import { createPageHero, mountLayout, qs, renderDestinationCard, setPageError, setLoading } from "./shared.js";

async function init() {
  await mountLayout("destinations");
  const hero = qs("#page-hero");
  const grid = qs("#destinations-grid");

  hero.innerHTML = createPageHero({
    eyebrow: "Điểm đến",
    title: "Khám phá theo vùng và thành phố",
    description: "Static page này gom spotlight destinations từ catalog và link sang listing đã lọc sẵn."
  });

  setLoading(grid);

  try {
    const destinations = await getDestinationsData();
    grid.innerHTML = destinations.length
      ? destinations.map((destination) => renderDestinationCard(destination)).join("")
      : "<div class='empty-state'><h3>Chưa có điểm đến</h3><p>Thêm location và tour_destinations trong Supabase để hiển thị tại đây.</p></div>";
  } catch (error) {
    setPageError(grid, error);
  }
}

void init();
