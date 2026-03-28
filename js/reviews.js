import { getReviewsPageData } from "./api.js";
import { createPageHero, mountLayout, qs, renderReviewCard, setPageError, setLoading } from "./shared.js";

async function init() {
  await mountLayout("reviews");
  const hero = qs("#page-hero");
  const grid = qs("#reviews-grid");

  hero.innerHTML = createPageHero({
    eyebrow: "Đánh giá",
    title: "Review đã duyệt từ khách thật",
    description: "Toàn bộ review approved được render từ Supabase mà không cần Next.js hay React."
  });

  setLoading(grid);

  try {
    const reviews = await getReviewsPageData();
    grid.innerHTML = reviews.length
      ? reviews.map((review) => renderReviewCard(review)).join("")
      : "<div class='empty-state'><h3>Chưa có review</h3><p>Review approved sẽ tự hiện lên ở đây sau khi có dữ liệu.</p></div>";
  } catch (error) {
    setPageError(grid, error);
  }
}

void init();
