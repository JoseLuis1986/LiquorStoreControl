export function formatMoney(amount: number | string, usdToVes: number): string {
  const usd = Number(amount);
  if (!Number.isFinite(usd)) return '—';
  const dollars = `$ ${usd.toFixed(2)}`;
  if (!(usdToVes > 0)) return dollars;
  const bolivares = (usd * usdToVes).toLocaleString('es-VE', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `${dollars} · Bs ${bolivares}`;
}

export function formatRate(usdToVes: number): string {
  if (!(usdToVes > 0)) return 'Sin tasa';
  return `$1 = Bs ${usdToVes.toLocaleString('es-VE', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  })}`;
}
