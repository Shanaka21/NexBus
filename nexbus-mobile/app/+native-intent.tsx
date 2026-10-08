// Google sends the user back to the app with a link like nexbusmobile://oauthredirect?code=...
// expo-auth-session reads that link itself, so the router must not navigate to it: that opened an
// "Unmatched Route" page and unmounted the login screen before it could finish signing in.
export function redirectSystemPath({ path }: { path: string; initial: boolean }) {
  if (path.includes("oauthredirect")) return "";
  return path;
}
