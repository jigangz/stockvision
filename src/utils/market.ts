/**
 * Auto-detect market (SH/SZ) from stock code prefix.
 * - 6xxxxx, 688xxx -> SH (Shanghai)
 * - 000xxx, 001xxx, 002xxx, 003xxx, 300xxx, 301xxx -> SZ (Shenzhen)
 * - Default -> SZ
 */
export function detectMarket(code: string): 'SH' | 'SZ' {
  if (code.startsWith('6')) return 'SH';
  return 'SZ';
}
