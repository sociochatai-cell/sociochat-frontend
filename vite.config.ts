import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const apiTarget = env.VITE_API_BASE || 'http://localhost:5000';
  const useDevTunnel = ["1", "true", "yes", "on"].includes(
    (env.VITE_USE_DEV_TUNNEL || "").trim().toLowerCase(),
  );

  return {
    server: {
      host: "::",
      port: 5173,
      strictPort: true,
      // Required for Microsoft Dev Tunnels hostnames (avoids "Blocked request" 403).
      allowedHosts: [".devtunnels.ms", "localhost", "127.0.0.1"],
      // Only when the frontend itself is served via Dev Tunnels (HTTPS on 443).
      ...(useDevTunnel ? { hmr: { clientPort: 443 } } : {}),
      proxy: {
        "/api": {
          target: apiTarget,
          changeOrigin: true,
          secure: false,
        },
      },
    },
    plugins: [react()],
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
  };
});
