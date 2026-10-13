import * as THREE from 'three';
import { rng } from '../sim/rng';
import type { PlanetLook } from '../sim/types';

function canvas2d(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return [c, c.getContext('2d')!];
}

/** Радиальное свечение: для двигателей и звезды. */
export function glowTexture(inner: string, outer: string): THREE.CanvasTexture {
  const [c, g] = canvas2d(128, 128);
  const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  gr.addColorStop(0, inner); gr.addColorStop(0.25, outer); gr.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(c);
}

const PALETTES: Record<PlanetLook, string[]> = {
  rock: ['#6d6862', '#8a8279', '#4e4a46', '#9b938a'],
  terran: ['#1d4a74', '#2e6b57', '#8b7a55', '#245d86'],
  gas: ['#b98450', '#e2bd88', '#9c6338', '#f0dbb2', '#c99b66'],
  ice: ['#9fc0d6', '#d6e8f2', '#7aa0bc', '#bcd6e6'],
  red: ['#86402d', '#ad5a3c', '#5b2b20', '#c27352'],
};

export function planetTexture(look: PlanetLook, seed: number): THREE.CanvasTexture {
  const [c, g] = canvas2d(512, 256);
  const r = rng(seed), pal = PALETTES[look];
  const color = (i: number) => pal[i]!;
  if (look === 'gas') {
    for (let y = 0; y < 256; y++) {
      const t = y / 256;
      const v = Math.sin(t * Math.PI * 13 + Math.sin(t * 41) * 1.2) + Math.sin(t * Math.PI * 33) * 0.45;
      g.fillStyle = color(Math.max(0, Math.min(pal.length - 1, Math.floor(((v + 1.45) / 2.9) * pal.length))));
      g.fillRect(0, y, 512, 1);
    }
    g.globalAlpha = 0.35; g.fillStyle = '#8f4f2c';
    g.beginPath(); g.ellipse(330, 168, 34, 14, 0, 0, Math.PI * 2); g.fill();
  } else {
    g.fillStyle = color(0); g.fillRect(0, 0, 512, 256);
    for (let i = 0; i < 320; i++) {
      g.globalAlpha = 0.18 + r() * 0.25; g.fillStyle = color(1 + Math.floor(r() * (pal.length - 1)));
      g.beginPath(); g.ellipse(r() * 512, r() * 256, 4 + r() * 42, 3 + r() * 22, r() * 3, 0, Math.PI * 2); g.fill();
    }
    if (look === 'rock' || look === 'red') {
      for (let i = 0; i < 60; i++) {
        const x = r() * 512, y = r() * 256, rad = 2 + r() * 9;
        g.globalAlpha = 0.35; g.fillStyle = 'rgba(0,0,0,1)'; g.beginPath(); g.arc(x, y, rad, 0, 7); g.fill();
        g.globalAlpha = 0.2; g.strokeStyle = '#fff'; g.beginPath(); g.arc(x - 1, y - 1, rad, 0, 7); g.stroke();
      }
    }
    if (look === 'terran' || look === 'ice') {
      for (let i = 0; i < 140; i++) {
        g.globalAlpha = 0.18 + r() * 0.3; g.fillStyle = '#f4f8fb';
        g.beginPath(); g.ellipse(r() * 512, r() * 256, 10 + r() * 50, 2 + r() * 7, r() * 0.4, 0, Math.PI * 2); g.fill();
      }
    }
  }
  g.globalAlpha = 1;
  return new THREE.CanvasTexture(c);
}

export function ringTexture(): THREE.CanvasTexture {
  const [c, g] = canvas2d(512, 512);
  const r = rng(5);
  for (let rad = 256; rad > 0; rad -= 1) {
    const t = rad / 256;
    let a = 0;
    if (t > 0.64 && t < 0.99) a = 0.25 + 0.45 * Math.abs(Math.sin(t * 90)) * (0.6 + r() * 0.4);
    if (t > 0.8 && t < 0.83) a *= 0.15;
    g.strokeStyle = 'rgba(226,200,160,' + a.toFixed(3) + ')';
    g.beginPath(); g.arc(256, 256, rad, 0, Math.PI * 2); g.stroke();
  }
  return new THREE.CanvasTexture(c);
}
