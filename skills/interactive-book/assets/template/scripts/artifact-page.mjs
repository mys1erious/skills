// Turns the built dist/index.html into the page fragment a claude.ai Artifact expects:
// the host supplies <!doctype>, <html>, <head> and <body>, so only their contents are kept.
import { readFileSync, writeFileSync } from 'node:fs';

const html = readFileSync(new URL('../dist/index.html', import.meta.url), 'utf8');
const head = html.match(/<head>([\s\S]*)<\/head>/)[1].replace(/<meta charset[^>]*>\s*/, '').replace(/<meta name="viewport"[^>]*>\s*/, '');
const body = html.match(/<body>([\s\S]*)<\/body>/)[1];
const title = head.match(/<title>[\s\S]*?<\/title>/)[0];
writeFileSync(new URL('../dist/artifact.html', import.meta.url), `${title}\n${head.replace(title, '').trim()}\n${body.trim()}\n`);
console.log('wrote dist/artifact.html');
