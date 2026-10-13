/// <reference types="vitest/config" />
import { defineConfig } from 'vite';

// На GitHub Pages сайт живёт по адресу /<имя-репозитория>/, локально — в корне
export default defineConfig(({ command }) => ({
  base: command === 'build' ? '/space-game/' : '/',
  // three.js сам весит около 550 КБ — делить его на куски пока незачем
  build: { chunkSizeWarningLimit: 800 },
  test: { include: ['tests/**/*.test.ts'] },
}));
