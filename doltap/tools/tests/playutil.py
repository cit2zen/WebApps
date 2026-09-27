"""5단계 e2e 공용 도우미(harness.page_session 위에서 쓴다). 스크립트가 아니므로 머리 규약·포트가 없다."""


def check(cond, msg):
    if not cond:
        raise AssertionError(msg)


def wait_lobby(page):
    page.wait_for_function("() => window.__doltap.state() === 'lobby'", timeout=6000)


def boot_play(page, mode='practice', tut=True):
    """로비 대기 → 저장 초기화 → 오늘=20261001 → 판 시작 → 200ms(aim 150ms 낙하 가드 통과)."""
    wait_lobby(page)
    st = page.evaluate(
        """([m, t]) => { __doltap.wipe(); __doltap.setToday('20261001'); __doltap.tut(t);
             __doltap.start(m, {day: '20261001'}); return __doltap.state(); }""", [mode, tut])
    check(st == 'aim', f'start → {st}')
    page.wait_for_timeout(200)


def settle(page):
    """낙하 직후 1스텝 진행 후 다음 aim까지 동기 진행. aim 도달 여부 반환."""
    return page.evaluate("async () => { __doltap.step(1); return (await __doltap.until('aim', 4000)).ok; }")


def view(page):
    return page.evaluate("__doltap.view()")


def finish(name, errors):
    check(errors == [], f'console errors: {errors}')
    print(f'PASS {name}')
