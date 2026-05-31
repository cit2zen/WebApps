// lib/audioMath.ts
// getByteTimeDomainData: 0..255, 128=무음 중심
export function rmsFromTimeData(timeData: Uint8Array): number {
  if (timeData.length === 0) return 0;
  let sum = 0;
  for (let i = 0; i < timeData.length; i++) {
    const v = (timeData[i] - 128) / 128; // -1..1
    sum += v * v;
  }
  return Math.sqrt(sum / timeData.length); // 0..~1
}

// getByteFrequencyData: 0..255 → 밴드별 평균을 0..1로 정규화
export function bandsFromFreqData(freqData: Uint8Array, numBands = 5): number[] {
  const binsPerBand = Math.max(1, Math.floor(freqData.length / numBands));
  const bands: number[] = [];
  for (let b = 0; b < numBands; b++) {
    let s = 0;
    for (let i = 0; i < binsPerBand; i++) s += freqData[b * binsPerBand + i] ?? 0;
    bands.push(s / (binsPerBand * 255));
  }
  return bands;
}
