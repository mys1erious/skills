import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: 'tests',
  testMatch: /.*\.spec\.mjs/,
  timeout: 120_000,
  workers: 1, // one browser at a time keeps frames and screenshots steady
  reporter: [['list']],
  use: {
    baseURL: 'http://127.0.0.1:5199/',
    viewport: { width: 1280, height: 800 },
    // headless Chromium on macOS can use the Metal GPU (fast); elsewhere SwiftShader gives the same software WebGL everywhere
    launchOptions: { args: process.platform === 'darwin' ? ['--use-angle=metal', '--enable-gpu'] : ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] },
  },
  expect: { toHaveScreenshot: { maxDiffPixelRatio: 0.02, timeout: 30_000 } },
  webServer: {
    command: 'npx vite --host 127.0.0.1 --port 5199 --strictPort',
    url: 'http://127.0.0.1:5199/',
    reuseExistingServer: true,
  },
});
