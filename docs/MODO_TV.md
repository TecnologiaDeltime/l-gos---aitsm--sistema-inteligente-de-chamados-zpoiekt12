# Modo TV · Lógos AITSM

## Visão Geral

O **Modo TV** (`/tv`) é a tela de exibição do sistema **Lógos AITSM** projetada para televisores, monitores de parede de NOC/Service Desk e salas de operação contínua. Ele opera em tela cheia (Fullscreen API), sem barras de navegação ou menus laterais, alternando automaticamente entre os dashboards escolhidos pela equipe.

---

## Características Principais

1. **Tela Cheia Imersiva**:
   - Cabeçalho escuro grafite (`#17181C`) com logotipo oficial **Lógos AITSM**.
   - Relógio digital em tempo real (data e hora com segundos).
   - Indicador de dashboard ativo, total selecionado e barra de progresso da transição.
   - Botões de pausa/play da rotação, alternância manual (anterior/próximo) e botão de saída.
   - Suporte a tecla `ESC` para sair a qualquer momento.

2. **Preferências Persistentes**:
   - Seleção de quais dos 7 dashboards entram no ciclo de rotação.
   - Ajuste de intervalo de rotação em segundos (10s a 300s, padrão: 30s).
   - Persistência das preferências no navegador (`localStorage`) por usuário/equipamento.

3. **Atualização em Tempo Real (Polling)**:
   - Polling automático a cada 30 segundos sem recarregar a página.
   - Atualização sob demanda via botão "Atualizar".

4. **Tratamento Gracioso de Sessão**:
   - Caso a autenticação expire ou seja desconectada, a tela exibe um aviso amigável e limpo com botão para login, sem quebrar o layout da TV nem renderizar tela branca.

---

## Os 7 Dashboards do Modo TV

1. **Total de Chamados por Fila com Status**:
   - Agrupamento de chamados por cada Fila de Atendimento do sistema.
   - Exibição do total da fila e da quebra pelos status reais (`Novo`, `Em Atendimento`, `Aguardando Aprovação`, `Pendente`, `Resolvido`).
   - Cards grandes com visual escuro de alto contraste e legibilidade à distância.

2. **Quem está Online**:
   - Identificação dos operadores e usuários atualmente online no sistema (status de disponibilidade e atividade recente de sessão).
   - Nome, perfil de acesso, filas de atendimento vinculadas e status (`Disponível`, `Ocupado`, `Pausa`, etc.).

3. **Consumo de Horas dos Clientes (em Cartões)**:
   - Um cartão dedicado por cliente com contrato ativo.
   - **Total de Horas Consumidas** em destaque numérico grande formatado em `HH:MM:SS`.
   - **Percentual de Utilização** discreto com código de cores por gravidade (verde normal, amarelo aviso >80%, vermelho crítico >100%).
   - **Total de Horas Contratadas** em `HH:MM:SS`.

4. **Metas (Dashboard Gerencial)**:
   - Cumprimento de Meta de SLA por Prioridade (Crítica, Alta, Média, Baixa) com medidores (gauges) circulares e percentual atingido.
   - Cartões de resumo de **Horas Consumidas** e **Saldo de Horas Restante** no período, reutilizando a mesma lógica do Dashboard Gerencial oficial.

5. **Total de Chamados por Status**:
   - Contagem geral de chamados do sistema agrupados por status real.
   - Cards destacados e barras de distribuição proporcional por status.

6. **Gestão de Mudanças (RDM)**:
   - Totais consolidados de Mudanças: **Abertas / Em Análise**, **Em Andamento / Aprovadas / Em Teste** e **Fechadas / Concluídas**.
   - Visão rápida para controle de janelas de manutenção e aprovações.

7. **Gestão de Problemas**:
   - Totais consolidados de Problemas: **Abertos**, **Em Período de Teste de Efetividade** e **Concluídos**.
   - Indicadores para acompanhamento da causa raiz e controle de erros conhecidos.

---

## Catálogo de Permissões e Perfis

O acesso ao Modo TV é protegido pelo controle de perfis de acesso do sistema:

- **Módulo**: `dashboard` (Painéis e Indicadores)
- **Item**: `modo_tv` (Modo TV / Painel Monitor)
- **Níveis**:
  - `0 - Nenhum`: oculta o item no menu lateral e bloqueia a rota `/tv` via guard `ProtectedRoute`.
  - `1 - Leitura`: permite abrir `/tv` e visualizar os dashboards em rotação.
  - `2 - Configurar`: permite salvar configurações de intervalo e seleção de painéis.

A migração `pocketbase/migrations/0128_add_tv_mode_permission.js` assegura que perfis com acesso a dashboards recebam a permissão de forma automática e idempotente.
