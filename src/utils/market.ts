/**
 * Auto-detect market (SH/SZ/BJ) from stock code prefix.
 * - 6xxxxx, 9xxxxx -> SH (Shanghai)
 * - 000xxx, 001xxx, 002xxx, 003xxx, 300xxx, 301xxx -> SZ (Shenzhen)
 * - 4xxxxx, 8xxxxx -> BJ (Beijing)
 * - Default -> SZ
 */
export function detectMarket(code: string): 'SH' | 'SZ' | 'BJ' {
  if (code.startsWith('6') || code.startsWith('9')) return 'SH';
  if (code.startsWith('4') || code.startsWith('8')) return 'BJ';
  return 'SZ';
}
