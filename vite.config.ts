import { defineConfig } from "vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import { nitro } from "nitro/vite";
import viteReact from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import tsConfigPaths from "vite-tsconfig-paths";

// O alias "@" vem do tsconfig (paths). O destino de deploy do SSR é definido pelo plugin nitro
// (padrão: Node). Para Cloudflare/Vercel/etc., passe `nitro({ preset: "..." })`.
export default defineConfig({
  server: { port: 8080 },
  plugins: [
    tsConfigPaths(),
    tanstackStart({
      // Entrada de servidor própria, com tratamento de erros de SSR.
      server: { entry: "server" },
    }),
    nitro(),
    viteReact(),
    tailwindcss(),
  ],
});
