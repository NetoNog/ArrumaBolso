/**
 * Utilitário de exportação para CSV com suporte nativo a caracteres PT-BR no Excel (BOM UTF-8)
 */
export interface ExportTransactionItem {
  date: string;
  description: string;
  category: string;
  account: string;
  type: string;
  amount: number | string;
  status: string;
  payment_method?: string;
}

export function exportTransactionsToCSV(
  transactions: ExportTransactionItem[],
  filename = 'extrato_arrumabolso.csv'
) {
  if (!transactions || transactions.length === 0) {
    throw new Error('Nenhuma transação disponível para exportar.');
  }

  const headers = [
    'Data',
    'Descrição',
    'Categoria',
    'Conta/Cartão',
    'Tipo',
    'Valor (R$)',
    'Status',
    'Forma de Pagamento'
  ];

  const escapeCSV = (str: string | number | undefined | null) => {
    if (str === undefined || str === null) return '""';
    const stringVal = String(str).replace(/"/g, '""');
    return `"${stringVal}"`;
  };

  const rows = transactions.map((t) => [
    escapeCSV(t.date),
    escapeCSV(t.description),
    escapeCSV(t.category),
    escapeCSV(t.account),
    escapeCSV(t.type === 'income' ? 'Receita' : t.type === 'expense' ? 'Despesa' : 'Investimento'),
    escapeCSV(typeof t.amount === 'number' ? t.amount.toFixed(2).replace('.', ',') : t.amount),
    escapeCSV(t.status === 'completed' ? 'Pago / Concluído' : 'Pendente'),
    escapeCSV(t.payment_method || '-')
  ]);

  const csvContent = [
    headers.map(h => `"${h}"`).join(';'),
    ...rows.map(r => r.join(';'))
  ].join('\r\n');

  // Adiciona BOM (\uFEFF) para garantir que o Microsoft Excel reconheça caracteres acentuados em PT-BR
  const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
