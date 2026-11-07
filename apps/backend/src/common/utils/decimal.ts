import { Decimal } from '@prisma/client/runtime/library';

export function toDecimal(value: string | number | Decimal): Decimal {
  return value instanceof Decimal ? value : new Decimal(value);
}

export function assertPositive(value: Decimal, label = 'Cantidad') {
  if (value.lte(0)) {
    throw new Error(`${label} debe ser mayor que cero`);
  }
}
