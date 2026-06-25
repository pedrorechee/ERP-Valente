// Helper compartilhado de % consumido do orçamento (orçado x realizado).
// Usado no Dashboard, na Visão Geral da obra, no Orçado x Realizado e na
// listagem de Orçamentos — fonte única da lógica, sem duplicação.
//
// orcado    = total_direct_cost do orçamento APROVADO (sem BDI)
// realizado = soma das despesas pagas da obra
export function pctConsumido(orcado: number, realizado: number): number {
  if (orcado <= 0) return realizado > 0 ? 100 : 0
  return (realizado / orcado) * 100
}
