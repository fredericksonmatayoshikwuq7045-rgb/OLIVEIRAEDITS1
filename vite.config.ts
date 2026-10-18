import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
  server: {
    watch: {
      ignored: [
        '**/*.mp4', '**/*.MP4', '**/*.mov', '**/*.MOV', '**/*.avi', '**/*.AVI', '**/*.mkv', '**/*.MKV', '**/*.webm', '**/*.WEBM',
        '**/*.png', '**/*.PNG', '**/*.jpg', '**/*.JPG', '**/*.jpeg', '**/*.JPEG', '**/*.webp', '**/*.WEBP', '**/*.gif', '**/*.GIF',
        '**/*.svg', '**/*.SVG', '**/*.bmp', '**/*.BMP', '**/*.tiff', '**/*.TIFF',
        '**/*.db', '**/*.DB', '**/Thumbs.db', '**/thumbs.db',
        '**/.DS_Store', '**/desktop.ini',
        '**/dist/**'
      ]
    }
  }
});
