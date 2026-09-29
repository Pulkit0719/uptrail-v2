export { COOKIE_NAME, CSRF_COOKIE_NAME, SESSION_DURATION_MS } from "@shared/const";

export const startLogin = (returnTo = window.location.pathname) => {
  const target = returnTo.startsWith("/") && !returnTo.startsWith("//") ? returnTo : "/dashboard";
  window.location.href = `/login?returnTo=${encodeURIComponent(target)}`;
};
