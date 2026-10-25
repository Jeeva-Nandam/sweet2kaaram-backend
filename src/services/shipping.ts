export interface ShippingQuote {
  fee: number;
  threshold: number;
}

export function calculateShipping(subtotal: number, state: string): ShippingQuote {
  const intrastate = state.trim().toLowerCase() === 'tamil nadu';
  const threshold = intrastate ? 499 : 799;
  const fee = subtotal >= threshold ? 0 : intrastate ? 50 : 80;
  return { fee, threshold };
}
