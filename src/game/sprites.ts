import cryoUrl from '../assets/images/tower_cryo_model_1794883457575.jpg';
import gatlingUrl from '../assets/images/tower_gatling_model_1794883456538.jpg';
import mortarUrl from '../assets/images/tower_mortar_model_1794883457522.jpg';
import teslaUrl from '../assets/images/tower_tesla_model_1794883457183.jpg';
import colossusUrl from '../assets/images/enemy_colossus_model_1794883475444.jpg';
import { TowerType } from './types';

export const TOWER_SPRITE_URLS: Record<TowerType, string> = {
  gatling: gatlingUrl,
  cryo: cryoUrl,
  mortar: mortarUrl,
  tesla: teslaUrl,
};

export const COLOSSUS_SPRITE_URL = colossusUrl;

interface SpriteSlot {
  canvas: HTMLCanvasElement | null;
  started: boolean;
}

const towerSlots: Record<TowerType, SpriteSlot> = {
  gatling: { canvas: null, started: false },
  cryo: { canvas: null, started: false },
  mortar: { canvas: null, started: false },
  tesla: { canvas: null, started: false },
};

const colossusSlot: SpriteSlot = { canvas: null, started: false };

/**
 * Edge-flood-fill chroma key that removes only the perimeter flat background color
 * while leaving internal dark steel details and ink outlines completely intact.
 */
function buildTransparentSpriteCanvas(img: HTMLImageElement, size = 256): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;

  ctx.drawImage(img, 0, 0, size, size);
  const imageData = ctx.getImageData(0, 0, size, size);
  const data = imageData.data;

  // Sample 4 corner pixels to estimate flat background RGB
  const corners = [
    0,
    (size - 1) * 4,
    (size - 1) * size * 4,
    ((size - 1) * size + (size - 1)) * 4,
  ];
  let bgR = 0;
  let bgG = 0;
  let bgB = 0;
  for (const idx of corners) {
    bgR += data[idx];
    bgG += data[idx + 1];
    bgB += data[idx + 2];
  }
  bgR /= corners.length;
  bgG /= corners.length;
  bgB /= corners.length;
  const bgLuma = bgR * 0.299 + bgG * 0.587 + bgB * 0.114;

  const totalPixels = size * size;
  const visited = new Uint8Array(totalPixels);
  const queue = new Int32Array(totalPixels);
  let head = 0;
  let tail = 0;

  const enqueue = (px: number) => {
    if (visited[px]) return;
    visited[px] = 1;
    queue[tail++] = px;
  };

  for (let x = 0; x < size; x++) {
    enqueue(x);
    enqueue((size - 1) * size + x);
  }
  for (let y = 1; y < size - 1; y++) {
    enqueue(y * size);
    enqueue(y * size + (size - 1));
  }

  const hardDist = 20;
  const featherDist = 30;

  while (head < tail) {
    const px = queue[head++];
    const idx = px * 4;
    const r = data[idx];
    const g = data[idx + 1];
    const b = data[idx + 2];

    const dr = r - bgR;
    const dg = g - bgG;
    const db = b - bgB;
    const dist = Math.sqrt(dr * dr + dg * dg + db * db);
    const luma = r * 0.299 + g * 0.587 + b * 0.114;

    // Never key out significantly darker ink outlines
    if (luma < bgLuma - 12 || dist >= featherDist) {
      continue;
    }

    if (dist <= hardDist) {
      data[idx + 3] = 0;
    } else {
      const alphaRatio = (dist - hardDist) / (featherDist - hardDist);
      data[idx + 3] = Math.round(data[idx + 3] * alphaRatio);
    }

    // Continue flood-fill through background pixels
    if (dist <= featherDist) {
      const x = px % size;
      const y = (px - x) / size;
      if (x > 0) enqueue(px - 1);
      if (x < size - 1) enqueue(px + 1);
      if (y > 0) enqueue(px - size);
      if (y < size - 1) enqueue(px + size);
    }
  }

  ctx.putImageData(imageData, 0, 0);
  return canvas;
}

function loadIntoSlot(url: string, slot: SpriteSlot): void {
  if (slot.started || typeof Image === 'undefined') return;
  slot.started = true;
  const img = new Image();
  img.onload = () => {
    slot.canvas = buildTransparentSpriteCanvas(img, 256);
  };
  img.src = url;
}

export function preloadGameSprites(): void {
  (Object.keys(TOWER_SPRITE_URLS) as TowerType[]).forEach((type) => {
    loadIntoSlot(TOWER_SPRITE_URLS[type], towerSlots[type]);
  });
  loadIntoSlot(COLOSSUS_SPRITE_URL, colossusSlot);
}

export function getTowerSpriteCanvas(type: TowerType): HTMLCanvasElement | null {
  const slot = towerSlots[type];
  if (!slot.started) {
    loadIntoSlot(TOWER_SPRITE_URLS[type], slot);
  }
  return slot.canvas;
}

export function getColossusSpriteCanvas(): HTMLCanvasElement | null {
  if (!colossusSlot.started) {
    loadIntoSlot(COLOSSUS_SPRITE_URL, colossusSlot);
  }
  return colossusSlot.canvas;
}
