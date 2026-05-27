function csvCell(s: string): string {
  if (/[",\r\n]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function row(cells: string[]): string {
  return cells.map(csvCell).join(',');
}

type LineRow = { accountId: string; code: string; name: string; amount: string };

/** Synthetic row id aligned with UI (`/reports/balance-sheet`). */
const NET_INCOME_ROW_ID = '__net_income__';

/**
 * CSV mirrors JSON: same `basis`, `asOf`, line amounts, `equity.netIncome`, and `totals`.
 * Net income row uses code `—` and Account ID `__net_income__` to match the UI.
 */
export function buildBalanceSheetCsv(data: {
  basis: string;
  asOf: string;
  assets: LineRow[];
  liabilities: LineRow[];
  equityAccounts: LineRow[];
  netIncome: { name: string; amount: string };
  totals: {
    assets: string;
    liabilities: string;
    equity: string;
    equityFromAccounts: string;
    netIncome: string;
    balanced: boolean;
  };
}): string {
  const lines: string[] = [];
  lines.push(row(['Balance Sheet', '', '', '', '']));
  lines.push(row(['Basis', data.basis, '', '', '']));
  lines.push(row(['As of', data.asOf, '', '', '']));
  lines.push('');
  lines.push(row(['Section', 'Account ID', 'Code', 'Account', 'Amount']));

  lines.push(row(['Assets', '', '', '', '']));
  for (const r of data.assets) {
    lines.push(row(['', r.accountId, r.code, r.name, r.amount]));
  }
  lines.push(row(['', '', '', 'Total Assets', data.totals.assets]));
  lines.push('');

  lines.push(row(['Liabilities', '', '', '', '']));
  for (const r of data.liabilities) {
    lines.push(row(['', r.accountId, r.code, r.name, r.amount]));
  }
  lines.push(row(['', '', '', 'Total Liabilities', data.totals.liabilities]));
  lines.push('');

  lines.push(row(['Equity', '', '', '', '']));
  for (const r of data.equityAccounts) {
    lines.push(row(['', r.accountId, r.code, r.name, r.amount]));
  }
  lines.push(row(['', NET_INCOME_ROW_ID, '\u2014', data.netIncome.name, data.netIncome.amount]));
  lines.push(row(['', '', '', 'Total Equity', data.totals.equity]));
  lines.push('');
  lines.push(
    row([
      '',
      '',
      '',
      'Equation check (Assets = Liabilities + Equity)',
      data.totals.balanced ? 'OK' : 'Mismatch',
    ]),
  );
  lines.push(row(['', '', '', 'Equity from equity accounts only', data.totals.equityFromAccounts]));
  lines.push(row(['', '', '', 'Net income (P&L) included in equity', data.totals.netIncome]));

  return '\uFEFF' + lines.join('\r\n');
}
