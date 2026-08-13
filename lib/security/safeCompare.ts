import { timingSafeEqual } from 'crypto';

// Compara dois textos em tempo constante, tolerando tamanhos diferentes sem
// lançar exceção (timingSafeEqual exige buffers do mesmo tamanho).
export function safeCompare(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}
