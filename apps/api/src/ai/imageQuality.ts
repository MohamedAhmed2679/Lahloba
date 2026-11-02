import jpeg from 'jpeg-js';
import { PNG } from 'pngjs';

/**
 * Local photo-quality check for partner uploads. Runs on our own server: the image is never
 * sent anywhere. It only advises the reviewer (who always decides).
 *  - BLANK: almost no variation (a blank page, a lens cap, a flat colour).
 *  - TOO_DARK / TOO_BRIGHT: average brightness far from readable.
 *  - BLURRY: little edge detail (variance of the Laplacian on a downscaled grey image).
 */
export type QualityIssue = 'BLANK' | 'TOO_DARK' | 'TOO_BRIGHT' | 'BLURRY' | 'TOO_SMALL';
export interface QualityResult { ok: boolean; issues: QualityIssue[]; width: number; height: number; brightness: number; contrast: number; sharpness: number }

const TARGET = 256; // analysis size (long side), keeps the check fast and resolution-independent

export function decodeToGray(bytes: Uint8Array, contentType: string): { w: number; h: number; gray: Float32Array; srcW: number; srcH: number } {
  let width: number; let height: number; let data: Uint8Array;
  if (contentType === 'image/jpeg') {
    const img = jpeg.decode(Buffer.from(bytes), { useTArray: true, formatAsRGBA: true, maxMemoryUsageInMB: 256, maxResolutionInMP: 40 });
    width = img.width; height = img.height; data = img.data;
  } else if (contentType === 'image/png') {
    const img = PNG.sync.read(Buffer.from(bytes));
    width = img.width; height = img.height; data = img.data;
  } else throw new Error('not an image');
  const step = Math.max(1, Math.ceil(Math.max(width, height) / TARGET));
  const w = Math.max(1, Math.floor(width / step)); const h = Math.max(1, Math.floor(height / step));
  const gray = new Float32Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    // Box-average each step x step block (simple, stable downscale).
    let s = 0; let n = 0;
    for (let dy = 0; dy < step; dy++) for (let dx = 0; dx < step; dx++) {
      const sx = x * step + dx; const sy = y * step + dy;
      if (sx >= width || sy >= height) continue;
      const i = (sy * width + sx) * 4;
      s += 0.299 * data[i]! + 0.587 * data[i + 1]! + 0.114 * data[i + 2]!; n++;
    }
    gray[y * w + x] = n ? s / n : 0;
  }
  return { w, h, gray, srcW: width, srcH: height };
}

export function assessQuality(bytes: Uint8Array, contentType: string): QualityResult {
  const { w, h, gray, srcW, srcH } = decodeToGray(bytes, contentType);
  const n = gray.length;
  const mean = gray.reduce((a, b) => a + b, 0) / n;
  const contrast = Math.sqrt(gray.reduce((a, b) => a + (b - mean) ** 2, 0) / n);
  let lap = 0; let lapSq = 0; let m = 0;
  for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
    const i = y * w + x;
    const v = 4 * gray[i]! - gray[i - 1]! - gray[i + 1]! - gray[i - w]! - gray[i + w]!;
    lap += v; lapSq += v * v; m++;
  }
  const sharpness = m ? lapSq / m - (lap / m) ** 2 : 0;
  const issues: QualityIssue[] = [];
  if (Math.min(srcW, srcH) < 320) issues.push('TOO_SMALL');
  if (contrast < 8) issues.push('BLANK');
  else {
    if (mean < 40) issues.push('TOO_DARK');
    if (mean > 235) issues.push('TOO_BRIGHT');
    if (sharpness < 40) issues.push('BLURRY');
  }
  const r = (x: number) => Math.round(x * 10) / 10;
  return { ok: issues.length === 0, issues, width: srcW, height: srcH, brightness: r(mean), contrast: r(contrast), sharpness: r(sharpness) };
}
