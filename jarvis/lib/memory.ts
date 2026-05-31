// lib/memory.ts
import { promises as fs } from "node:fs";
import { dirname } from "node:path";

export async function readMemory(path: string): Promise<string[]> {
  try {
    const raw = await fs.readFile(path, "utf8");
    const data = JSON.parse(raw);
    return Array.isArray(data) ? data : [];
  } catch {
    return []; // 파일 없음/깨짐 → 빈 메모리
  }
}

export async function appendMemory(path: string, text: string): Promise<void> {
  const items = await readMemory(path);
  items.push(text);
  await fs.mkdir(dirname(path), { recursive: true });
  await fs.writeFile(path, JSON.stringify(items, null, 2), "utf8");
}
