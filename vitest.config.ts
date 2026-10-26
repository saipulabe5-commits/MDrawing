import { defineConfig } from 'vitest/config';
export default defineConfig({test:{include:['tests/**/*.test.ts','src/lib/pdfGenerator.test.ts'],testTimeout:30000,hookTimeout:30000,fileParallelism:false}});
