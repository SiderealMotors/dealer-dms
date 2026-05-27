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

/**
 * CSV mirrors JSON: same `basis`, period, line `amount` strings, and `totals` as the API.
 * Column order: Section, Account ID, Code, Account, Amount.
 */
export function buildIncomeStatementCsv(data: {
  basis: string;
  startDate: string;
  endDate: string;
  revenue: LineRow[];
  costOfGoodsSold: LineRow[];
  operatingExpenses: LineRow[];
  totals: {
    totalRevenue: string;
    totalCostOfGoodsSold: string;
    grossProfit: string;
    totalExpenses: string;
    netProfit: string;
  };
}): string {
  const lines: string[] = [];
  lines.push(row(['Income Statement', '', '', '', '']));
  lines.push(row(['Basis', data.basis, '', '', '']));
  lines.push(row(['Period', `${data.startDate} to ${data.endDate}`, '', '', '']));
  lines.push('');
  lines.push(row(['Section', 'Account ID', 'Code', 'Account', 'Amount']));

  lines.push(row(['Revenue', '', '', '', '']));
  for (const r of data.revenue) {
    lines.push(row(['', r.accountId, r.code, r.name, r.amount]));
  }
  lines.push(row(['', '', '', 'Total Revenue', data.totals.totalRevenue]));
  lines.push('');

  lines.push(row(['Cost of Goods Sold', '', '', '', '']));
  for (const r of data.costOfGoodsSold) {
    lines.push(row(['', r.accountId, r.code, r.name, r.amount]));
  }
  lines.push(row(['', '', '', 'Total COGS', data.totals.totalCostOfGoodsSold]));
  lines.push('');

  lines.push(row(['', '', '', 'Gross Profit', data.totals.grossProfit]));
  lines.push('');

  lines.push(row(['Operating Expenses', '', '', '', '']));
  for (const r of data.operatingExpenses) {
    lines.push(row(['', r.accountId, r.code, r.name, r.amount]));
  }
  lines.push(row(['', '', '', 'Total Operating Expenses', data.totals.totalExpenses]));
  lines.push('');

  lines.push(row(['', '', '', 'Net Profit', data.totals.netProfit]));

  return '\uFEFF' + lines.join('\r\n');
}
