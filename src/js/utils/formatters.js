// Formatting Utilities for AvalAI Studio

export function formatIRT(amount) {
  if (amount === null || amount === undefined || isNaN(amount)) return '0 IRT';
  const num = typeof amount === 'string' ? parseFloat(amount) : amount;
  return new Intl.NumberFormat('en-US', {
    maximumFractionDigits: 0
  }).format(num) + ' IRT';
}

export function formatUSD(amount) {
  if (amount === null || amount === undefined || isNaN(amount)) return '$0.00';
  const num = typeof amount === 'string' ? parseFloat(amount) : amount;
  if (num > 0 && num < 0.01) {
    return '$' + num.toFixed(6);
  }
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 4
  }).format(num);
}

export function formatTokens(count) {
  if (!count && count !== 0) return '0';
  const num = Number(count);
  if (num >= 1000000) {
    return (num / 1000000).toFixed(2) + 'M';
  }
  if (num >= 1000) {
    return (num / 1000).toFixed(1) + 'k';
  }
  return num.toLocaleString();
}

export function formatDate(isoStr) {
  if (!isoStr) return 'N/A';
  try {
    const d = new Date(isoStr);
    return d.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  } catch {
    return isoStr;
  }
}

export function maskKey(key) {
  if (!key) return 'No key';
  if (key.length <= 12) return '••••••••';
  return key.slice(0, 7) + '••••••••' + key.slice(-4);
}

export function truncate(text, length = 100) {
  if (!text) return '';
  if (text.length <= length) return text;
  return text.slice(0, length) + '...';
}
