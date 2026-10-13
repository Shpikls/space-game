import { AU } from '../sim/constants';

export const nf = new Intl.NumberFormat('ru-RU');

export function fmtDist(m: number): string {
  if (m < 10e3) return nf.format(Math.round(m)) + ' м';
  if (m < 0.1 * AU) return nf.format(Math.round(m / 1000)) + ' км';
  return (m / AU).toFixed(1).replace('.', ',') + ' а. е.';
}

export function fmtSpeed(v: number): string {
  if (v < 10e3) return nf.format(Math.round(v)) + ' м/с';
  if (v < 0.01 * AU) return nf.format(Math.round(v / 1000)) + ' км/с';
  return (v / AU).toFixed(2).replace('.', ',') + ' а. е./с';
}

export const fmtSec = (s: number) => Math.round(s) + ' с';

/** Элемент страницы по id; разметка лежит в index.html. */
export const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
