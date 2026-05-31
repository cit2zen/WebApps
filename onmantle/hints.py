CHOSUNG = [
    "ㄱ", "ㄲ", "ㄴ", "ㄷ", "ㄸ", "ㄹ", "ㅁ", "ㅂ", "ㅃ",
    "ㅅ", "ㅆ", "ㅇ", "ㅈ", "ㅉ", "ㅊ", "ㅋ", "ㅌ", "ㅍ", "ㅎ",
]

def extract_chosung(word: str) -> str:
    result = []
    for char in word:
        code = ord(char) - 0xAC00
        if 0 <= code < 11172:
            result.append(CHOSUNG[code // 588])
        else:
            result.append(char)
    return "".join(result)

def get_hint(word: str, pos: str, level: int, nearest_word: str | None) -> dict:
    if level == 1:
        return {"hint_type": "품사", "hint_value": pos, "level": 1}
    elif level == 2:
        return {"hint_type": "글자 수", "hint_value": f"{len(word)}글자", "level": 2}
    elif level == 3:
        return {"hint_type": "초성", "hint_value": extract_chosung(word), "level": 3}
    elif level == 4:
        return {"hint_type": "유사도 1위", "hint_value": nearest_word or "데이터 없음", "level": 4}
    elif level == 5:
        return {"hint_type": "첫 글자", "hint_value": word[0], "level": 5}
    else:
        raise ValueError("힌트 레벨은 1~5 사이여야 합니다")
