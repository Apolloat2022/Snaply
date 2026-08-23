/**
 * Tax + postal fee calculation shared between the checkout UI and the
 * server-side Square payment route (so the client-displayed total always
 * matches what gets charged).
 */

// Simplified state sales-tax table — swap for a tax API (e.g. TaxJar, Stripe Tax)
// before production; rates here are approximate general sales-tax rates.
const STATE_SALES_TAX_RATE: Record<string, number> = {
  CA: 0.0725,
  NY: 0.04,
  TX: 0.0625,
  WA: 0.065,
  FL: 0.06,
  OR: 0,
  MT: 0,
  NH: 0,
  DE: 0,
};
const DEFAULT_SALES_TAX_RATE = 0.05;

// Flat-rate-ish postal fee curve, keyed off the AI's estimated shipping weight.
const BASE_POSTAL_FEE = 4.99;
const PER_POUND_FEE = 0.85;

export function getSalesTaxRate(stateCode: string): number {
  return STATE_SALES_TAX_RATE[stateCode.toUpperCase()] ?? DEFAULT_SALES_TAX_RATE;
}

export function calculateSalesTax(subtotal: number, stateCode: string): number {
  return roundCents(subtotal * getSalesTaxRate(stateCode));
}

export function calculatePostalFee(estimatedWeightLb: number): number {
  const fee = BASE_POSTAL_FEE + Math.max(0, estimatedWeightLb - 1) * PER_POUND_FEE;
  return roundCents(fee);
}

export interface CheckoutTotals {
  itemCost: number;
  salesTax: number;
  postalFee: number;
  total: number;
}

export function computeCheckoutTotals(
  itemCost: number,
  stateCode: string,
  estimatedWeightLb: number
): CheckoutTotals {
  const salesTax = calculateSalesTax(itemCost, stateCode);
  const postalFee = calculatePostalFee(estimatedWeightLb);
  return {
    itemCost: roundCents(itemCost),
    salesTax,
    postalFee,
    total: roundCents(itemCost + salesTax + postalFee),
  };
}

function roundCents(value: number): number {
  return Math.round(value * 100) / 100;
}

export function toSquareAmountCents(dollars: number): number {
  return Math.round(dollars * 100);
}
