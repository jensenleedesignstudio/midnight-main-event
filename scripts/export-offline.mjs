/** Export the real client as a single file for keyboard training without a server. */
import { build } from 'vite';
import react from '@vitejs/plugin-react';
import { mkdirSync, writeFileSync } from 'node:fs';
const result = await build({
  configFile: false,
  plugins: [react()],
  define: { 'process.env.NODE_ENV': '"production"' },
  build: { write: false, minify: true, lib: { entry: 'src/main.tsx', name: 'MotionBoxingArena', formats: ['iife'] } },
});
const outputs = (Array.isArray(result) ? result : [result]).flatMap(item => item.output);
const js = outputs.filter(item => item.type === 'chunk').map(item => item.code).join('\n');
const css = outputs.filter(item => item.type === 'asset' && item.fileName.endsWith('.css')).map(item => item.source).join('\n');
mkdirSync('dist', { recursive: true });
writeFileSync('dist/offline.html', `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Motion Boxing Arena — Keyboard Training</title><style>${css}</style></head><body><div id="root"></div><script>${js.replace(/<\/script/gi, '<\\/script')}</script></body></html>`);
console.log('Open dist/offline.html for keyboard VS AI. Camera and multiplayer require the normal server setup.');
