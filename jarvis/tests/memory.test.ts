// tests/memory.test.ts
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { readMemory, appendMemory } from "@/lib/memory";
import { promises as fs } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

let path: string;
beforeEach(() => { path = join(tmpdir(), `jarvis-mem-${Date.now()}-${Math.random()}.json`); });
afterEach(async () => { await fs.rm(path, { force: true }); });

describe("memory", () => {
  it("파일 없으면 빈 배열을 읽는다", async () => {
    expect(await readMemory(path)).toEqual([]);
  });

  it("append 후 read하면 항목이 보인다", async () => {
    await appendMemory(path, "사용자는 다크모드를 선호한다");
    await appendMemory(path, "이름은 시티즌");
    expect(await readMemory(path)).toEqual([
      "사용자는 다크모드를 선호한다",
      "이름은 시티즌",
    ]);
  });
});
