// Fórmula única do líquido de uma medição.
// Líquido a receber = valor bruto − (bruto × retenção%/100).
// Usado no front (preview e tabela) e nas Server Actions (receita gerada),
// para não duplicar a regra de cálculo.
export function netoMedicao(grossAmount: number, retentionPercent: number): number {
  return Math.round(grossAmount * (1 - (retentionPercent || 0) / 100) * 100) / 100
}

// Valor retido (parte que NÃO entra na receita ainda).
export function retidoMedicao(grossAmount: number, retentionPercent: number): number {
  return Math.round(grossAmount * ((retentionPercent || 0) / 100) * 100) / 100
}
