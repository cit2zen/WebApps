/**
 * Promise에 상한 타임아웃을 건다. 타임아웃이 이겨도 원래 Promise는 취소되지 않으므로
 * 백그라운드 rejection을 삼켜 unhandledRejection을 방지하고, 타이머는 항상 해제한다.
 * (SDK가 native 타임아웃을 지원하면 그것과 병행하는 안전망 역할)
 */
export async function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  // 타임아웃이 먼저 끝났을 때 p가 나중에 reject돼도 크래시하지 않도록
  p.catch(() => {});
  let timer: ReturnType<typeof setTimeout>;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${label} 타임아웃(${ms}ms)`)), ms);
  });
  try {
    return await Promise.race([p, timeout]);
  } finally {
    clearTimeout(timer!);
  }
}
