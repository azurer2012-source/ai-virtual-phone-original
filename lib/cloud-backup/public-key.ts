export function isPublicCloudKey(key: string): boolean {
  if (key.startsWith("sb_publishable_") && key.length > "sb_publishable_".length) return true;
  try {
    const parts = key.split(".");
    if (parts.length !== 3) return false;
    return JSON.parse(atob(parts[1].replace(/-/g, "+").replace(/_/g, "/"))).role === "anon";
  } catch { return false; }
}
