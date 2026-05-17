import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";
import tailwindcss from "@tailwindcss/vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import { cloudflare } from "@cloudflare/vite-plugin";

export default defineConfig({
  plugins: [
    tanstackStart(),
    cloudflare({ viteEnvironment: { name: "ssr" } }),
    react(),
    tailwindcss(),
    tsconfigPaths(),
  ],
  ssr: {
    noExternal: ["antd", "@ant-design/icons", "@ant-design/pro-components"],
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('antd') || id.includes('@ant-design')) return 'antd';
            if (id.includes('recharts') || id.includes('d3-')) return 'recharts';
            if (id.includes('@tiptap') || id.includes('lowlight')) return 'rich-editor';
            if (id.includes('@radix-ui')) return 'radix';
            if (id.includes('react-dom') || id.includes('react/')) return 'react';
            if (id.includes('@supabase')) return 'supabase';
          }
        },
      },
    },
  },
});