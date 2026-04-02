import { getCmsPageBySlug } from "./api.js";
import { createPageHero, escapeHtml, mountLayout, qs, setLoading, setPageError } from "./shared.js?v=20260331m";

export async function mountContentPage(pageKey, slug, fallbackTitle) {
  await mountLayout(pageKey);

  const hero = qs("#page-hero");
  const content = qs("#page-content");
  if (!hero || !content) return;

  setLoading(content);

  try {
    const page = await getCmsPageBySlug(slug);
    if (!page) {
      throw new Error("Không tìm thấy nội dung trang.");
    }

    document.title = `${page.metaTitle || fallbackTitle} | TourBook`;
    hero.innerHTML = createPageHero({
      eyebrow: "Thông tin",
      title: page.title || fallbackTitle,
      description: page.metaDescription || "Nội dung đang được đồng bộ từ Supabase CMS."
    });

    content.innerHTML = `
      <article class="card content-card prose">
        ${String(page.content || "")
          .split(/\n{2,}/)
          .map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`)
          .join("")}
      </article>
    `;
  } catch (error) {
    setPageError(content, error);
  }
}
