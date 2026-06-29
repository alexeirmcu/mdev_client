import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: "https://smart-trip-planner-api.onrender.com",
        changeOrigin: true,
        rewrite: (path) =>
          path === "/api/trips/places/search"
            ? "/trips/places/search"
            : path,
      },
    },
  },
});
