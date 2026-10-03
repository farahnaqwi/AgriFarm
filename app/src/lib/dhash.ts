// 64-bit difference hash (a perceptual hash) for duplicate-photo detection (R-DUP-01).
export function dhash(source: CanvasImageSource): string {
  const c = document.createElement("canvas");
  c.width = 9;
  c.height = 8;
  const g = c.getContext("2d", { willReadFrequently: true })!;
  g.drawImage(source, 0, 0, 9, 8);
  const d = g.getImageData(0, 0, 9, 8).data;
  const lum = (x: number, y: number): number => {
    const i = (y * 9 + x) * 4;
    return d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114;
  };
  let hex = "";
  for (let y = 0; y < 8; y++) {
    let byte = 0;
    for (let x = 0; x < 8; x++) byte = (byte << 1) | (lum(x, y) > lum(x + 1, y) ? 1 : 0);
    hex += byte.toString(16).padStart(2, "0");
  }
  return hex;
}
