import react from "@vitejs/plugin-react";
import { env } from "node:process";
import { defineConfig } from "vite-plus";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    strictPort: true,
    proxy: { "/api": env.HYDRAW_API_TARGET ?? "http://127.0.0.1:3000" },
  },
});
