import { defineConfig, Plugin } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    fs: {
      allow: ["./client", "./shared"],
      deny: [".env", ".env.*", "*.{crt,pem}", "**/.git/**"],
    },
  },
  build: {
    outDir: "dist/spa",
  },
  plugins: [react(), ...(mode === 'development' ? [expressPlugin()] : [])],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./client"),
      "@shared": path.resolve(__dirname, "./shared"),
    },
  },
}));

function expressPlugin(): Plugin {
  return {
    name: "express-plugin",
    apply: "serve", // Only apply during development (serve mode)
    configureServer(server) {
      // Only import and use Express server in development
      import("./server").then(({ createServer }) => {
        const app = createServer();
        
        // Apply Express middleware to Vite dev server
        server.middlewares.use((req, res, next) => {
          // Handle API routes with Express
          if (req.url?.startsWith('/api/')) {
            return app(req, res, next);
          }
          // Let Vite handle everything else
          next();
        });
      }).catch(console.error);
    },
  };
}
