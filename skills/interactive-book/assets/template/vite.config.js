import { defineConfig } from 'vite';
import { readFileSync } from 'node:fs';

// index.html shows {{title}}, {{subtitle}} and {{description}} before any script runs; they come from book.json
const book = () => JSON.parse(readFileSync(new URL('./src/content/book.json', import.meta.url), 'utf8'));
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');

export default defineConfig({
  base: './', // relative asset paths: the build works from any folder, GitHub Pages or a claude.ai Artifact
  build: { target: 'es2022' }, // top-level await in main.js
  plugins: [{
    name: 'book-meta',
    transformIndexHtml: (html) => { const b = book(); return html.replace(/\{\{(title|subtitle|description)\}\}/g, (_, k) => esc(b[k])); },
  }],
});
