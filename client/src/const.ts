export { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";

// Generate login URL at runtime.
// Always point to our custom auth page which supports both phone+password and Manus OAuth.
export const getLoginUrl = (returnPath?: string) => {
  const base = `${window.location.origin}/auth`;
  if (returnPath) {
    return `${base}?returnTo=${encodeURIComponent(returnPath)}`;
  }
  return base;
};

// Generate Manus OAuth URL for the OAuth login option on the auth page
export const getManusOAuthUrl = () => {
  const oauthPortalUrl = import.meta.env.VITE_OAUTH_PORTAL_URL;
  if (!oauthPortalUrl) return null;
  const appId = import.meta.env.VITE_APP_ID;
  const redirectUri = `${window.location.origin}/api/oauth/callback`;
  const state = btoa(redirectUri);
  const url = new URL(`${oauthPortalUrl}/app-auth`);
  url.searchParams.set("appId", appId);
  url.searchParams.set("redirectUri", redirectUri);
  url.searchParams.set("state", state);
  url.searchParams.set("type", "signIn");
  return url.toString();
};
