/**
 * 키 단위 직렬화. 같은 키의 작업은 순차 실행되어 read-modify-write 레이스를 방지한다.
 * 인메모리(단일 프로세스) 한정.
 */
const chains = new Map<string, Promise<unknown>>();

export function withKeyedLock<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const prev = chains.get(key) ?? Promise.resolve();
  // 이전 작업의 성공/실패와 무관하게 그 뒤에 이어서 실행
  const run = prev.then(fn, fn);
  // 체이닝용 꼬리(실패를 삼켜 다음 작업이 정상 진행되게)
  const tail = run.catch(() => {});
  chains.set(key, tail);
  // 가장 마지막 작업이 끝나면 맵에서 제거(키 누수 방지)
  void tail.then(() => {
    if (chains.get(key) === tail) chains.delete(key);
  });
  return run;
}
