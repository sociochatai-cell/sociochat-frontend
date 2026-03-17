// Use relative path so Vite proxy can forward to backend
export function buildBackendUrl(path: string) {
  const p = path.startsWith("/") ? path : `/${path}`;
  // Return relative path - Vite proxy will handle forwarding
  return p;
}
