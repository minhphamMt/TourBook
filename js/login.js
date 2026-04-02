import { getAuthContext, resolvePostLoginPath, signIn, signUp } from "./api.js";
import { bindAsyncForm, mountLayout, qs, showToast } from "./shared.js?v=20260331m";

async function init() {
  await mountLayout("login");

  const auth = await getAuthContext();
  const redirectTo = new URLSearchParams(window.location.search).get("redirect") || undefined;
  if (auth.user) {
    window.location.href = resolvePostLoginPath(auth.roles, redirectTo);
    return;
  }

  const loginInfo = qs("#login-info");
  const loginForm = qs("#login-form");
  const signupForm = qs("#signup-form");

  loginInfo.innerHTML = `
    <section class="card hero-copy">
      <span class="eyebrow">Auth</span>
      <h1>Đăng nhập để tiếp tục booking</h1>
      <p>Frontend thuần hiện dùng trực tiếp Supabase Auth. Sau khi đăng nhập, hệ thống sẽ tự điều hướng sang tài khoản hoặc khu quản trị theo role.</p>
      <div class="inline-actions">
        <span class="chip">Guest -> customer -> account</span>
        <span class="chip">staff/admin -> admin</span>
      </div>
    </section>
  `;

  bindAsyncForm(loginForm, async (formData) => {
    await signIn(formData.get("email"), formData.get("password"));
    const nextAuth = await getAuthContext();
    showToast("Đăng nhập thành công.", "success");
    window.location.href = resolvePostLoginPath(nextAuth.roles, redirectTo);
  });

  bindAsyncForm(signupForm, async (formData) => {
    const payload = await signUp({
      fullName: formData.get("fullName"),
      email: formData.get("email"),
      password: formData.get("password")
    });

    if (payload?.access_token) {
      const nextAuth = await getAuthContext();
      showToast("Tạo tài khoản thành công.", "success");
      window.location.href = resolvePostLoginPath(nextAuth.roles, redirectTo);
      return;
    }

    showToast("Tài khoản đã được tạo. Hãy kiểm tra email xác nhận nếu project của bạn bật xác minh email.", "info");
  });
}

void init();
