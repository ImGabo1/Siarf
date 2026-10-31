import { defineConfig } from 'tsup';

// Empaqueta la API en un solo archivo ESM incluyendo los paquetes del monorepo
// (@siarf/*), que se publican como código TypeScript fuente.
export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  target: 'node20',
  platform: 'node',
  outDir: 'dist',
  clean: true,
  sourcemap: true,
  noExternal: [/^@siarf\//],
});
