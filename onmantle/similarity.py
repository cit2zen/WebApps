import numpy as np


def vec_from_bytes(data: bytes) -> np.ndarray:
    """BYTEA → numpy float32 배열 (300차원)."""
    return np.frombuffer(data, dtype=np.float32)


def cosine_similarity(a: np.ndarray, b: np.ndarray) -> float:
    """두 벡터의 코사인 유사도 (-1 ~ +1)."""
    dot = np.dot(a, b)
    norm = np.linalg.norm(a) * np.linalg.norm(b)
    if norm == 0:
        return 0.0
    return float(dot / norm)


def compute_score(a: np.ndarray, b: np.ndarray) -> float:
    """코사인 유사도를 -100 ~ +100 스케일로 변환."""
    return round(cosine_similarity(a, b) * 100, 2)
