/**
 * Utility functions
 */

/**
 * Format currency with thousand separators
 */
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('ne-NP', {
    style: 'currency',
    currency: 'NPR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

/**
 * Format number with thousand separators
 */
export function formatNumber(num: number): string {
  return new Intl.NumberFormat('en-US').format(num);
}

/**
 * Generate unique Member ID (M-0001, M-0002, etc.)
 */
export function generateMemberId(existingIds: string[]): string {
  const maxNum = existingIds
    .map(id => {
      const match = id.match(/M-(\d+)/);
      return match ? parseInt(match[1], 10) : 0;
    })
    .reduce((max, num) => Math.max(max, num), 0);
  
  const nextNum = maxNum + 1;
  return `M-${String(nextNum).padStart(4, '0')}`;
}

/**
 * Calculate loan outstanding principal
 */
export function calculateOutstandingPrincipal(
  principal: number,
  interestRate: number,
  termMonths: number,
  payments: Array<{ principalPaid: number; interestPaid: number; date: string }>
): number {
  const totalPrincipalPaid = payments.reduce((sum, p) => sum + p.principalPaid, 0);
  return Math.max(0, principal - totalPrincipalPaid);
}

/**
 * Calculate monthly interest payment
 */
export function calculateMonthlyInterest(principal: number, annualRate: number): number {
  return (principal * annualRate) / 100 / 12;
}

/**
 * Format date for display
 */
export function formatDate(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(d);
}

/**
 * Get current date in YYYY-MM-DD format
 */
export function getCurrentDate(): string {
  return new Date().toISOString().split('T')[0];
}

