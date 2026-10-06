// vite.config.ts
import { defineConfig } from "file:///C:/Users/carme/ReadySetFlyWeb/ReadySetFly/node_modules/vite/dist/node/index.js";
import react from "file:///C:/Users/carme/ReadySetFlyWeb/ReadySetFly/node_modules/@vitejs/plugin-react/dist/index.js";
import path from "path";
import runtimeErrorOverlay from "file:///C:/Users/carme/ReadySetFlyWeb/ReadySetFly/node_modules/@replit/vite-plugin-runtime-error-modal/dist/index.mjs";
import cesium from "file:///C:/Users/carme/ReadySetFlyWeb/ReadySetFly/node_modules/vite-plugin-cesium/dist/index.mjs";
var __vite_injected_original_dirname = "C:\\Users\\carme\\ReadySetFlyWeb\\ReadySetFly";
var isGitHubPages = process.env.GITHUB_PAGES === "true";
var vite_config_default = defineConfig(async () => {
  const devPlatformPlugins = process.env.NODE_ENV !== "production" && process.env.REPL_ID !== void 0 ? [
    (await import("file:///C:/Users/carme/ReadySetFlyWeb/ReadySetFly/node_modules/@replit/vite-plugin-cartographer/dist/index.mjs")).cartographer(),
    (await import("file:///C:/Users/carme/ReadySetFlyWeb/ReadySetFly/node_modules/@replit/vite-plugin-dev-banner/dist/index.mjs")).devBanner()
  ] : [];
  return {
    define: {
      CESIUM_BASE_URL: '"/cesium/"'
    },
    plugins: [react(), runtimeErrorOverlay(), cesium(), ...devPlatformPlugins],
    assetsInclude: ["**/*.JPG"],
    resolve: {
      alias: {
        "@": path.resolve(__vite_injected_original_dirname, "client", "src"),
        "@shared": path.resolve(__vite_injected_original_dirname, "shared"),
        "@assets": path.resolve(__vite_injected_original_dirname, "attached_assets")
      }
    },
    root: path.resolve(__vite_injected_original_dirname, "client"),
    // IMPORTANT:
    // Render expects dist/public (your server serves this)
    // GitHub Pages expects docs (because Pages can only serve / or /docs)
    build: {
      outDir: isGitHubPages ? path.resolve(__vite_injected_original_dirname, "docs") : path.resolve(__vite_injected_original_dirname, "dist/public"),
      emptyOutDir: true
    },
    // If you are using a custom domain on GitHub Pages (readysetfly.us),
    // base should be "/" (this is correct for a root domain).
    base: "/",
    server: {
      fs: {
        strict: true,
        deny: ["**/.*"]
      },
      // During development, proxy API requests to the backend server
      proxy: {
        "/api": {
          target: "http://localhost:5000",
          changeOrigin: true,
          secure: false
        }
      }
    }
  };
});
export {
  vite_config_default as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZS5jb25maWcudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCJDOlxcXFxVc2Vyc1xcXFxjYXJtZVxcXFxSZWFkeVNldEZseVdlYlxcXFxSZWFkeVNldEZseVwiO2NvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9maWxlbmFtZSA9IFwiQzpcXFxcVXNlcnNcXFxcY2FybWVcXFxcUmVhZHlTZXRGbHlXZWJcXFxcUmVhZHlTZXRGbHlcXFxcdml0ZS5jb25maWcudHNcIjtjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfaW1wb3J0X21ldGFfdXJsID0gXCJmaWxlOi8vL0M6L1VzZXJzL2Nhcm1lL1JlYWR5U2V0Rmx5V2ViL1JlYWR5U2V0Rmx5L3ZpdGUuY29uZmlnLnRzXCI7aW1wb3J0IHsgZGVmaW5lQ29uZmlnIH0gZnJvbSBcInZpdGVcIjtcbmltcG9ydCByZWFjdCBmcm9tIFwiQHZpdGVqcy9wbHVnaW4tcmVhY3RcIjtcbmltcG9ydCBwYXRoIGZyb20gXCJwYXRoXCI7XG5pbXBvcnQgcnVudGltZUVycm9yT3ZlcmxheSBmcm9tIFwiQHJlcGxpdC92aXRlLXBsdWdpbi1ydW50aW1lLWVycm9yLW1vZGFsXCI7XG5pbXBvcnQgY2VzaXVtIGZyb20gXCJ2aXRlLXBsdWdpbi1jZXNpdW1cIjtcblxuLy8gQnVpbGQgdGFyZ2V0OlxuLy8gLSBEZWZhdWx0OiBSZW5kZXIvc2VydmVyIGJ1aWxkID0+IGRpc3QvcHVibGljXG4vLyAtIEdpdEh1YiBQYWdlcyBidWlsZDogc2V0IEdJVEhVQl9QQUdFUz10cnVlID0+IGRvY3NcbmNvbnN0IGlzR2l0SHViUGFnZXMgPSBwcm9jZXNzLmVudi5HSVRIVUJfUEFHRVMgPT09IFwidHJ1ZVwiO1xuXG5leHBvcnQgZGVmYXVsdCBkZWZpbmVDb25maWcoYXN5bmMgKCkgPT4ge1xuICBjb25zdCBkZXZQbGF0Zm9ybVBsdWdpbnMgPVxuICAgIHByb2Nlc3MuZW52Lk5PREVfRU5WICE9PSBcInByb2R1Y3Rpb25cIiAmJiBwcm9jZXNzLmVudi5SRVBMX0lEICE9PSB1bmRlZmluZWRcbiAgICAgID8gW1xuICAgICAgICAgIChhd2FpdCBpbXBvcnQoXCJAcmVwbGl0L3ZpdGUtcGx1Z2luLWNhcnRvZ3JhcGhlclwiKSkuY2FydG9ncmFwaGVyKCksXG4gICAgICAgICAgKGF3YWl0IGltcG9ydChcIkByZXBsaXQvdml0ZS1wbHVnaW4tZGV2LWJhbm5lclwiKSkuZGV2QmFubmVyKCksXG4gICAgICAgIF1cbiAgICAgIDogW107XG5cbiAgcmV0dXJuIHtcbiAgICBkZWZpbmU6IHtcbiAgICAgIENFU0lVTV9CQVNFX1VSTDogJ1wiL2Nlc2l1bS9cIicsXG4gICAgfSxcbiAgICBwbHVnaW5zOiBbcmVhY3QoKSwgcnVudGltZUVycm9yT3ZlcmxheSgpLCBjZXNpdW0oKSwgLi4uZGV2UGxhdGZvcm1QbHVnaW5zXSxcbiAgICBhc3NldHNJbmNsdWRlOiBbXCIqKi8qLkpQR1wiXSxcbiAgICByZXNvbHZlOiB7XG4gICAgICBhbGlhczoge1xuICAgICAgICBcIkBcIjogcGF0aC5yZXNvbHZlKGltcG9ydC5tZXRhLmRpcm5hbWUsIFwiY2xpZW50XCIsIFwic3JjXCIpLFxuICAgICAgICBcIkBzaGFyZWRcIjogcGF0aC5yZXNvbHZlKGltcG9ydC5tZXRhLmRpcm5hbWUsIFwic2hhcmVkXCIpLFxuICAgICAgICBcIkBhc3NldHNcIjogcGF0aC5yZXNvbHZlKGltcG9ydC5tZXRhLmRpcm5hbWUsIFwiYXR0YWNoZWRfYXNzZXRzXCIpLFxuICAgICAgfSxcbiAgICB9LFxuICAgIHJvb3Q6IHBhdGgucmVzb2x2ZShpbXBvcnQubWV0YS5kaXJuYW1lLCBcImNsaWVudFwiKSxcblxuICAgIC8vIElNUE9SVEFOVDpcbiAgICAvLyBSZW5kZXIgZXhwZWN0cyBkaXN0L3B1YmxpYyAoeW91ciBzZXJ2ZXIgc2VydmVzIHRoaXMpXG4gICAgLy8gR2l0SHViIFBhZ2VzIGV4cGVjdHMgZG9jcyAoYmVjYXVzZSBQYWdlcyBjYW4gb25seSBzZXJ2ZSAvIG9yIC9kb2NzKVxuICAgIGJ1aWxkOiB7XG4gICAgICBvdXREaXI6IGlzR2l0SHViUGFnZXNcbiAgICAgICAgPyBwYXRoLnJlc29sdmUoaW1wb3J0Lm1ldGEuZGlybmFtZSwgXCJkb2NzXCIpXG4gICAgICAgIDogcGF0aC5yZXNvbHZlKGltcG9ydC5tZXRhLmRpcm5hbWUsIFwiZGlzdC9wdWJsaWNcIiksXG4gICAgICBlbXB0eU91dERpcjogdHJ1ZSxcbiAgICB9LFxuXG4gICAgLy8gSWYgeW91IGFyZSB1c2luZyBhIGN1c3RvbSBkb21haW4gb24gR2l0SHViIFBhZ2VzIChyZWFkeXNldGZseS51cyksXG4gICAgLy8gYmFzZSBzaG91bGQgYmUgXCIvXCIgKHRoaXMgaXMgY29ycmVjdCBmb3IgYSByb290IGRvbWFpbikuXG4gICAgYmFzZTogXCIvXCIsXG5cbiAgICBzZXJ2ZXI6IHtcbiAgICAgIGZzOiB7XG4gICAgICAgIHN0cmljdDogdHJ1ZSxcbiAgICAgICAgZGVueTogW1wiKiovLipcIl0sXG4gICAgICB9LFxuICAgICAgLy8gRHVyaW5nIGRldmVsb3BtZW50LCBwcm94eSBBUEkgcmVxdWVzdHMgdG8gdGhlIGJhY2tlbmQgc2VydmVyXG4gICAgICBwcm94eToge1xuICAgICAgICAnL2FwaSc6IHtcbiAgICAgICAgICB0YXJnZXQ6ICdodHRwOi8vbG9jYWxob3N0OjUwMDAnLFxuICAgICAgICAgIGNoYW5nZU9yaWdpbjogdHJ1ZSxcbiAgICAgICAgICBzZWN1cmU6IGZhbHNlLFxuICAgICAgICB9LFxuICAgICAgfSxcbiAgICB9LFxuICB9O1xufSk7XG4iXSwKICAibWFwcGluZ3MiOiAiO0FBQXVULFNBQVMsb0JBQW9CO0FBQ3BWLE9BQU8sV0FBVztBQUNsQixPQUFPLFVBQVU7QUFDakIsT0FBTyx5QkFBeUI7QUFDaEMsT0FBTyxZQUFZO0FBSm5CLElBQU0sbUNBQW1DO0FBU3pDLElBQU0sZ0JBQWdCLFFBQVEsSUFBSSxpQkFBaUI7QUFFbkQsSUFBTyxzQkFBUSxhQUFhLFlBQVk7QUFDdEMsUUFBTSxxQkFDSixRQUFRLElBQUksYUFBYSxnQkFBZ0IsUUFBUSxJQUFJLFlBQVksU0FDN0Q7QUFBQSxLQUNHLE1BQU0sT0FBTyxnSEFBa0MsR0FBRyxhQUFhO0FBQUEsS0FDL0QsTUFBTSxPQUFPLDhHQUFnQyxHQUFHLFVBQVU7QUFBQSxFQUM3RCxJQUNBLENBQUM7QUFFUCxTQUFPO0FBQUEsSUFDTCxRQUFRO0FBQUEsTUFDTixpQkFBaUI7QUFBQSxJQUNuQjtBQUFBLElBQ0EsU0FBUyxDQUFDLE1BQU0sR0FBRyxvQkFBb0IsR0FBRyxPQUFPLEdBQUcsR0FBRyxrQkFBa0I7QUFBQSxJQUN6RSxlQUFlLENBQUMsVUFBVTtBQUFBLElBQzFCLFNBQVM7QUFBQSxNQUNQLE9BQU87QUFBQSxRQUNMLEtBQUssS0FBSyxRQUFRLGtDQUFxQixVQUFVLEtBQUs7QUFBQSxRQUN0RCxXQUFXLEtBQUssUUFBUSxrQ0FBcUIsUUFBUTtBQUFBLFFBQ3JELFdBQVcsS0FBSyxRQUFRLGtDQUFxQixpQkFBaUI7QUFBQSxNQUNoRTtBQUFBLElBQ0Y7QUFBQSxJQUNBLE1BQU0sS0FBSyxRQUFRLGtDQUFxQixRQUFRO0FBQUE7QUFBQTtBQUFBO0FBQUEsSUFLaEQsT0FBTztBQUFBLE1BQ0wsUUFBUSxnQkFDSixLQUFLLFFBQVEsa0NBQXFCLE1BQU0sSUFDeEMsS0FBSyxRQUFRLGtDQUFxQixhQUFhO0FBQUEsTUFDbkQsYUFBYTtBQUFBLElBQ2Y7QUFBQTtBQUFBO0FBQUEsSUFJQSxNQUFNO0FBQUEsSUFFTixRQUFRO0FBQUEsTUFDTixJQUFJO0FBQUEsUUFDRixRQUFRO0FBQUEsUUFDUixNQUFNLENBQUMsT0FBTztBQUFBLE1BQ2hCO0FBQUE7QUFBQSxNQUVBLE9BQU87QUFBQSxRQUNMLFFBQVE7QUFBQSxVQUNOLFFBQVE7QUFBQSxVQUNSLGNBQWM7QUFBQSxVQUNkLFFBQVE7QUFBQSxRQUNWO0FBQUEsTUFDRjtBQUFBLElBQ0Y7QUFBQSxFQUNGO0FBQ0YsQ0FBQzsiLAogICJuYW1lcyI6IFtdCn0K
