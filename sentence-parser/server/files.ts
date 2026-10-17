import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

export async function readJson<T>(path: string): Promise<T | undefined> {
  let text: string;
  try {
    text = await readFile(path, 'utf8');
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return undefined;
    throw err;
  }
  try {
    return JSON.parse(text) as T;
  } catch {
    const backup = `${path}.broken-${Date.now()}`;
    await rename(path, backup);
    console.warn(`[data] ${path} 无法解析，已备份到 ${backup} 并重新开始`);
    return undefined;
  }
}

/** Serialises writes per file and replaces the file atomically. */
export class JsonFile<T> {
  private readonly path: string;
  private pending: Promise<void> = Promise.resolve();

  constructor(path: string) {
    this.path = path;
  }

  write(value: T, mode?: number): Promise<void> {
    const text = JSON.stringify(value, null, 2) + '\n';
    const run = this.pending.then(async () => {
      await mkdir(dirname(this.path), { recursive: true });
      const tmp = `${this.path}.tmp`;
      await writeFile(tmp, text, { encoding: 'utf8', mode });
      await rename(tmp, this.path);
    });
    this.pending = run.catch(() => {});
    return run;
  }
}
