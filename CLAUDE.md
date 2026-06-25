# ERP Valente — Sistema de Gestão para Construtoras

> Sistema web desenvolvido sob medida para a Construtora Valente. Centraliza o controle de obras, financeiro, equipe, fornecedores, clientes e contratos em uma única plataforma — substituindo planilhas, papéis e mensagens de WhatsApp por processos organizados e rastreáveis.

---

## O Problema que Estamos Resolvendo

O dono da Construtora Valente hoje gerencia tudo em planilhas Excel espalhadas: obras em andamento, entradas e saídas financeiras, fluxo de caixa e equipe. Os problemas concretos são:

- Não sabe em qual fase cada obra está, nem quanto falta para terminar
- Não consegue mostrar ao cliente o progresso da obra de forma clara
- Não tem comprovação organizada dos gastos de cada obra
- Perde o controle do fluxo de caixa por falta de visão consolidada
- Não sabe se a equipe está produzindo conforme esperado
- Orçamentos e contratos são gerados manualmente, sem padrão
- Não há acompanhamento estruturado de propostas enviadas a clientes

---

## O que o Sistema Resolve

Um único lugar para gerenciar toda a construtora. O dono abre o sistema e enxerga de imediato: quais obras estão em andamento, qual fase cada uma está, como está o caixa, o que a equipe está fazendo e quais propostas estão abertas. O cliente acessa um portal e acompanha a obra em tempo real, sem precisar ligar ou mandar mensagem.

---

## Público-Alvo

O sistema tem três perfis de usuário com acessos diferentes:

**Dono da construtora (acesso total)**
Visão completa do negócio. Aprova compras, vê o financeiro, acompanha todas as obras, gera relatórios e toma decisões com base em dados reais. Pode compartilhar o painel de acompanhamento com clientes.

**Funcionária administrativa (acesso operacional)**
Alimenta o sistema no dia a dia: lança notas fiscais, registra pagamentos, atualiza fases das obras, cadastra fornecedores, gerencia contratos e orçamentos. É quem mantém o sistema vivo.

**Cliente da construtora (acesso de consulta)**
Acessa um portal exclusivo para acompanhar a obra contratada: fase atual, percentual de avanço, próximas etapas, fotos e documentos. Recebe notificações automáticas quando a obra avança.

---

## Módulos do Sistema

Os módulos são integrados entre si. Uma ação em um módulo reflete automaticamente nos outros.

---

### Módulo 1 — Gestão de Obras

O coração do sistema. Cada obra é um projeto com vida própria, com todas as informações centralizadas.

**O que resolve:** o dono não sabe em qual fase a obra está, não consegue mostrar isso ao cliente e não tem registro do histórico da obra.

**Funcionalidades:**
- Cadastro de cada obra com endereço, tipo, área, prazo previsto e responsável técnico
- Divisão da obra em fases (fundação, estrutura, alvenaria, instalações, acabamento etc.)
- Controle de avanço por fase: percentual concluído, data prevista e data real
- Diário de obra digital: registro diário do que foi executado, quem estava presente e ocorrências
- Galeria de fotos por fase, vinculada à obra
- Indicador visual de atraso: quando uma fase passa da data prevista, o sistema sinaliza
- Linha do tempo da obra visível para o dono e para o cliente
- Documentos da obra: ART, alvará, projetos, laudos — tudo anexado e acessível

---

### Módulo 2 — Financeiro

Controle de tudo que entra e sai, por obra e de forma consolidada para a empresa.

**O que resolve:** o dono não sabe a margem real de cada obra, não tem o fluxo de caixa organizado e descobre prejuízos só no final.

**Funcionalidades:**
- Lançamento de entradas (recebimentos de clientes) e saídas (compras, serviços, salários)
- Cada lançamento vinculado a uma obra específica
- Anexo de comprovante (nota fiscal, recibo, boleto) em cada lançamento
- Fluxo de caixa: visão de entradas e saídas por período (semana, mês, obra)
- Resultado por obra: receita total, custo total e margem
- Contas a pagar com data de vencimento e alerta de vencimento próximo
- Contas a receber com cronograma de recebimento e alerta de atraso
- Visão consolidada: todas as obras somadas, resultado geral da empresa
- Exportação de relatório financeiro por obra em PDF

---

### Módulo 3 — Orçamentos

Criação de orçamentos profissionais e controle das propostas enviadas a clientes.

**O que resolve:** orçamentos feitos manualmente sem padrão, sem histórico e sem acompanhamento de aprovação.

**Funcionalidades:**
- Criação de orçamento por obra com itens, quantidades, preços unitários e total
- Cálculo automático de BDI (margem sobre o custo direto)
- Versões de orçamento: cada revisão fica salva com data e motivo
- Geração de PDF do orçamento para enviar ao cliente
- Status da proposta: rascunho, enviado, aprovado, recusado
- Comparativo ao final da obra: o que foi orçado vs. o que foi gasto de fato

---

### Módulo 4 — Contratos

Gestão de contratos com clientes, fornecedores e subempreiteiros.

**O que resolve:** contratos sem controle de vencimento, aditivos combinados verbalmente e sem registro formal.

**Funcionalidades:**
- Cadastro de contrato com cliente: tipo, valor, forma de pagamento, prazo
- Cadastro de contrato com fornecedor ou subempreiteiro: escopo, valor e prazo
- Registro de aditivos: mudanças de prazo ou de valor formalizadas no sistema
- Alerta automático de vencimento (30, 15 e 5 dias antes)
- Retenção de garantia: controle do valor retido e da data para liberação
- Medições contratuais: registro do que foi executado como base para cobrança
- Histórico completo de cada contrato com todas as alterações

---

### Módulo 5 — Suprimentos e Estoque

Controle de compras de materiais e estoque por obra.

**O que resolve:** compras sem processo, material sumindo sem registro e desperdício invisível.

**Funcionalidades:**
- Requisição de material: encarregado pede, administrativo aprova e compra
- Cotação: registro de pelo menos 3 fornecedores antes de fechar compra
- Pedido de compra com histórico de aprovação
- Entrada de material: nota fiscal registrada e vinculada ao pedido
- Estoque por obra: o que foi comprado, o que foi aplicado e o que sobrou
- Alerta quando o consumo de material ultrapassa o previsto no orçamento

---

### Módulo 6 — RH e Equipe

Controle da equipe própria e dos subempreiteiros por obra.

**O que resolve:** o dono não sabe o custo real da equipe por obra e não tem registro de quem trabalhou onde e quando.

**Funcionalidades:**
- Cadastro de funcionários próprios e subempreiteiros
- Apontamento de horas trabalhadas por obra e por dia
- Custo de mão de obra por obra: salário + encargos calculados
- Quando um funcionário trabalha em mais de uma obra no mesmo dia, o custo é dividido proporcionalmente
- Medição de subempreiteiro: o que foi executado e o valor a pagar
- Registro de entrega de EPIs por funcionário com data e confirmação
- Visão da equipe alocada em cada obra no período

---

### Módulo 7 — CRM e Clientes

Gestão do relacionamento com clientes: do primeiro contato até o pós-obra.

**O que resolve:** propostas enviadas e esquecidas, sem follow-up, e clientes sem informação sobre a obra.

**Funcionalidades:**
- Pipeline de vendas: lead → visita realizada → proposta enviada → negociação → contrato assinado
- Cadastro de clientes com histórico de obras e contatos
- Alerta de follow-up: o sistema avisa quando chegou a hora de retornar para um cliente
- Motivo de perda: quando uma proposta é recusada, registra o motivo para aprendizado
- Pós-obra: lista de pendências e controle do prazo de garantia (5 anos pelo Código Civil)
- Pesquisa de satisfação enviada automaticamente ao cliente ao final da obra

---

### Módulo 8 — Portal do Cliente

Acesso exclusivo do cliente para acompanhar a obra contratada.

**O que resolve:** cliente sem informação, ligando o tempo todo para saber como está a obra.

**Funcionalidades:**
- Login exclusivo por cliente (cada cliente vê apenas a própria obra)
- Linha do tempo da obra com fases e percentual de conclusão
- Galeria de fotos por fase
- Próximas etapas previstas com datas estimadas
- Documentos disponíveis: contrato, orçamento, notas fiscais
- Notificação por e-mail e WhatsApp quando a obra avança de fase
- Histórico de comunicação: mensagens entre o dono e o cliente dentro do sistema

---

### Módulo 9 — Relatórios e Dashboard

Painel de controle com visão geral do negócio e relatórios exportáveis.

**O que resolve:** o dono toma decisões sem dados, sem saber o que está indo bem e o que está consumindo dinheiro.

**Funcionalidades:**
- Dashboard principal: obras ativas, fases, situação financeira e alertas do dia
- Indicadores principais: margem por obra, custo por m², obras no prazo vs. atrasadas
- Relatório financeiro por obra exportável em PDF
- Relatório de equipe: horas trabalhadas e custo por obra
- Relatório de materiais: consumo vs. orçado por obra
- Relatório de vendas: propostas abertas, aprovadas e recusadas no período
- Todos os relatórios com filtro por período e por obra

---

## Funcionalidades Transversais

Estas funcionalidades existem em todo o sistema, não em um módulo específico:

- **Login e autenticação** com perfis de acesso diferentes por tipo de usuário
- **Multi-usuário** — dono, administrativo e cliente com acessos separados
- **Notificações** dentro do sistema: alertas de vencimento, atraso de fase, compra pendente de aprovação
- **Notificações por e-mail** para eventos importantes (vencimento de contrato, obra avançou de fase)
- **Notificações por WhatsApp** para o cliente quando a obra avança
- **Busca e filtros** em todas as telas: por obra, por período, por status
- **Calendário** com visão de prazos de obras, vencimentos de contratos e contas a pagar
- **Exportação em PDF** de orçamentos, contratos, relatórios financeiros e relatório de obra para o cliente
- **Anexo de arquivos** em obras, contratos, lançamentos financeiros e pedidos de compra

---

## Design e Experiência

O sistema deve ser clean, profissional e direto ao ponto. Não é um software corporativo pesado — é uma ferramenta que o dono e a equipe vão usar todo dia, no escritório e no canteiro de obra.

**Paleta de cores:**

| Nome | Hex | Uso |
|---|---|---|
| Creme claro | `#F4E2B8` | Fundo de seções e cards |
| Dourado suave | `#E6C07B` | Destaques e bordas |
| Terracota médio | `#C68B59` | Botões e ações primárias |
| Marrom | `#8A5A3B` | Títulos e textos de destaque |
| Marrom escuro | `#3B2418` | Textos principais e sidebar |

**Princípios de design:**
- Fundo branco ou creme claro como base — nunca cores escuras como fundo de tela
- Tipografia limpa e legível, sem exagero de estilos
- Hierarquia clara: o que importa mais aparece maior e primeiro
- Ícones simples e funcionais, sem decoração desnecessária
- Responsivo: funciona no computador do escritório e no celular do canteiro
- Cada tela tem uma função principal clara — sem acúmulo de informações

---

## Fluxo de Desenvolvimento

O sistema será construído em fases, priorizando o que resolve os problemas mais urgentes primeiro.

**Fase 1 — Base e fundação**
Login, autenticação, perfis de acesso, navegação principal e estrutura do sistema.

**Fase 2 — Obras e financeiro**
Cadastro de obras, controle de fases, lançamentos financeiros e dashboard principal. Com isso o dono já tem a visão mais importante do negócio.

**Fase 3 — Orçamentos e contratos**
Geração de orçamentos, gestão de contratos, alertas de vencimento e histórico de versões.

**Fase 4 — Suprimentos e equipe**
Requisição de materiais, controle de estoque por obra e apontamento de horas da equipe.

**Fase 5 — Portal do cliente e CRM**
Portal de acompanhamento para o cliente, pipeline de vendas e notificações automáticas.

**Fase 6 — Relatórios e refinamento**
Relatórios completos, exportações, ajustes de usabilidade e melhorias com base no uso real.

---

## Stack Técnica

- **Frontend:** Next.js com Vercel
- **Banco de dados e autenticação:** Supabase
- **Backend:** Node.js
- **E-mails transacionais:** Resend
- **Desenvolvimento assistido:** Claude Code

---

*Documento de produto — ERP Valente. Atualizado conforme o projeto evolui.*
