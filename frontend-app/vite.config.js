import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  // Keep the REACT_APP_ prefix. Renaming to VITE_ would touch every call site and
  // every deploy environment for no behavioural gain; .env.production keeps working.
  const env = loadEnv(mode, process.cwd(), 'REACT_APP_');

  return {
    plugins: [react()],
    envPrefix: 'REACT_APP_',

    // The source is .js files containing JSX, which esbuild will not parse by
    // default. Renaming ~65 files to .jsx would bury the migration in a diff
    // nobody can review, so tell esbuild to treat them as JSX instead.
    esbuild: { loader: 'jsx', include: /src\/.*\.jsx?$/, exclude: [] },
    optimizeDeps: { esbuildOptions: { loader: { '.js': 'jsx' } } },

    define: {
      // CRA inlined this at build time; Vite does not expose process.env to the
      // browser at all, so inline it explicitly and leave the source untouched.
      'process.env.REACT_APP_API_URL': JSON.stringify(env.REACT_APP_API_URL || ''),
      'process.env.NODE_ENV': JSON.stringify(mode === 'production' ? 'production' : 'development'),
    },

    server: { port: 3000, open: false },

    // Capacitor's webDir is 'build' (capacitor.config.ts). Vite defaults to
    // 'dist'; matching CRA's output keeps the native config untouched.
    build: { outDir: 'build', sourcemap: true },

    test: {
      globals: true,
      environment: 'jsdom',
      setupFiles: './src/setupTests.js',
      css: false,
    },
  };
});
