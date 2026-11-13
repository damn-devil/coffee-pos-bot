export function formatMoney(value: number | null | undefined): string {
  const rounded = Math.round((Number(value) || 0) * 100) / 100;
  return rounded.toLocaleString('ru-RU') + ' Br';
}

export function formatCountdown(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  const mm = String(minutes).padStart(2, '0');
  const ss = String(seconds).padStart(2, '0');
  return `${mm}:${ss}`;
}

export function paymentLabel(payment: string): string {
  switch (payment) {
    case 'cash':
      return 'Наличные';
    case 'card':
      return 'Карта';
    default:
      return payment;
  }
}

export function etaLabel(etaMinutes: number): string {
  if (etaMinutes <= 0) return 'как можно скорее';
  if (etaMinutes === 1) return 'через 1 минуту';
  if (etaMinutes < 60) return `через ${etaMinutes} ${pluralMinutes(etaMinutes)}`;
  const hours = Math.floor(etaMinutes / 60);
  const minutes = etaMinutes % 60;
  const hourWord = hours === 1 ? 'час' : hours > 1 && hours < 5 ? 'часа' : 'часов';
  const minuteWord = minutes === 1 ? 'минуту' : 'минуты';
  const prefix = minutes === 0 ? `${hours} ${hourWord}` : `${hours} ${hourWord} ${minutes} ${minuteWord}`;
  return `через ${prefix}`;
}

function pluralMinutes(minutes: number): string {
  const lastTwo = minutes % 100;
  const lastOne = minutes % 10;
  if (lastTwo > 10 && lastTwo < 20) return 'минут';
  if (lastOne > 1 && lastOne < 5) return 'минуты';
  return 'минуту';
}
