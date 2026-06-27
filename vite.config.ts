import path from "path";
import { fileURLToPath } from "url";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { viteSingleFile } from "vite-plugin-singlefile";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Port fixe du backend Express local — NE PAS CHANGER
const BACKEND_PORT = 5000;

export default defineConfig(({ command }) => ({
  plugins: [
    react(),
    tailwindcss(),
    // viteSingleFile uniquement en production (build)
    // En développement il casse le serveur HMR → 404
    ...(command === "build" ? [viteSingleFile()] : []),
  ],

  root: ".",
  publicDir: "public",

  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },

  server: {
    // Port Vite fixe — si déjà pris, Vite affiche une erreur au lieu d'en prendre un autre
    port: 5173,
    strictPort: true,
    open: true,

    proxy: {
      // Toutes les requêtes /api/* sont redirigées vers le backend Express
      "/api": {
        target: `http://127.0.0.1:${BACKEND_PORT}`,
        changeOrigin: true,
        secure: false,
        rewrite: (p) => p,
      },
    },
  },

  build: {
    outDir: "dist",
    emptyOutDir: true,
  },

  // Expose la constante au frontend via import.meta.env
  define: {
    __BACKEND_PORT__: BACKEND_PORT,
  },
}));
