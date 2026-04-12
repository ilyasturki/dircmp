export function formatDate(date: Date): string {
  return date.toISOString().split("T")[0];
}

export function formatCurrency(amount: number, currency = "USD"): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(amount);
}
