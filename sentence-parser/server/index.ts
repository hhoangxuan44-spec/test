import { existsSync } from 'node:fs';
import { createServer } from 'node:http';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import { createApp } from './app';
import { Db } from './db';
import { AnthropicProvider, OpenAICompatibleProvider } from './llm/providers';
import { MaiMemoClient } from './maimemo';
import { SettingsStore, type Settings } from './settings';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
try {
  process.loadEnvFile(join(root, '.env'));
} catch {
  // .env is optional
}

const prod = process.argv.includes('--prod');
const host = process.env.HOST ?? '127.0.0.1';
const port = Number(process.env.PORT ?? 5173);
const dataDir = resolve(root, process.env.DATA_DIR ?? 'data');

const settings = await SettingsStore.open(dataDir);
const db = await Db.open(dataDir);

const app = createApp({
  settings,
  db,
  localOnly: ['127.0.0.1', 'localhost', '::1'].includes(host),
  maimemo: (token) => new MaiMemoClient({ token, baseUrl: process.env.MAIMEMO_BASE_URL }),
  llm: (s: Settings) =>
    s.llmProvider === 'openai'
      ? new OpenAICompatibleProvider({ baseUrl: s.openaiBaseUrl, apiKey: s.openaiApiKey, model: s.openaiModel })
      : new AnthropicProvider({ apiKey: s.anthropicApiKey || undefined, model: s.anthropicModel, effort: s.anthropicEffort }),
});

const server = createServer(app);

if (prod) {
  const dist = join(root, 'dist');
  if (!existsSync(join(dist, 'index.html'))) {
    console.error('找不到前端构建产物，请先运行 npm run build');
    process.exit(1);
  }
  app.use(express.static(dist));
} else {
  const { createServer: createVite } = await import('vite');
  const vite = await createVite({ root, server: { middlewareMode: true, hmr: { server } }, appType: 'spa' });
  app.use(vite.middlewares);
}

server.listen(port, host, () => {
  const shown = host === '0.0.0.0' || host === '::' ? 'localhost' : host;
  console.log(`\n  长难句 × 墨墨 已启动：http://${shown}:${port}/\n  数据目录：${dataDir}\n`);
});
