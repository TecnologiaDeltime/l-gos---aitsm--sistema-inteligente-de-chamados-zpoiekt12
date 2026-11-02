# Relatórios e Extrações de Dados — Lógos AITILSM

O Lógos AITILSM conta com uma suíte avançada de relatórios gerenciais, operacionais e de conformidade. Todas as visões fornecem dados auditáveis em tempo real, filtros dinâmicos e opções de exportação padronizadas.

---

## 1. Visão Geral dos Relatórios Disponíveis

| Relatório                        | Rota                            | Objetivo Principal                                   | Formatos de Exportação |
| -------------------------------- | ------------------------------- | ---------------------------------------------------- | ---------------------- |
| **Funcionalidades Implantadas**  | `/reports/implemented-features` | Inventário de recursos e entregas do sistema         | CSV                    |
| **Horas por Operador**           | `/reports/operator-hours`       | Horas de Play/Pause vs. Acompanhamento por técnico   | CSV                    |
| **Relatório de Chamados**        | `/reports/tickets`              | Linha a linha com dados completos, horas e solução   | CSV, XLSX, PDF         |
| **Interações nos Chamados**      | `/reports/ticket-interactions`  | Auditoria detalhada de cada log de acompanhamento    | CSV, XLSX, PDF         |
| **Interações Horas Trabalhadas** | `/reports/worked-hours`         | Apuração detalhada de ciclos do cronômetro (Play)    | CSV, XLSX, PDF         |
| **Relatório de Ativos (CMDB)**   | `/reports/assets`               | Inventário de hardware com status de disponibilidade | CSV, XLSX, PDF         |
| **Automações de Ativos**         | `/reports/asset-automations`    | Logs de exclusões e mudanças para "Disponível"       | CSV                    |
| **Relatório Mensal do Cliente**  | `/reports/monthly-client`       | Laudo ABNT consolidado com liberação ao Portal       | Impressão / PDF ABNT   |
| **Auditoria de Alertas**         | `/reports/alert-audit`          | Engajamento de operadores com avisos sonoros e SLA   | CSV                    |
| **Extração de Clientes**         | `/reports/clients`              | Exportação cadastral flexível de empresas            | CSV                    |
| **Atividades Recorrentes**       | `/recurrent-activities`         | Frequência de subatividades e serviços               | CSV                    |

---

## 2. Padrões Corporativos de Exportação

A plataforma oferece três formatos padronizados de exportação:

### 2.1 Exportação em CSV

- Arquivos em texto delimitado por vírgulas ou ponto-e-vírgula com encoding UTF-8 com BOM, garantindo abertura perfeita no Microsoft Excel, LibreOffice e ferramentas de BI sem corrupção de acentuação em português.

### 2.2 Exportação em Planilha XLSX

- Planilha formatada com cabeçalho oficial do tema corporativo (fundo grafite `#17181C`, texto âmbar `#FCD34D`), larguras automáticas de colunas, tipografia limpa e linha final de totalização.

### 2.3 Exportação em PDF com Cabeçalho Oficial

- Geração de documento para impressão/salvamento em PDF em formato A4 Paisagem (_Landscape_) estruturado em conformidade com as normas ABNT e ITSM:
  - **Cabeçalho Oficial**: logotipo da empresa cliente ou logotipo padrão do ITSM Desk à esquerda; título oficial do relatório; nome da empresa cliente selecionada ou _"Todos os clientes"_.
  - **Metadados do Cabeçalho**: badge de extração oficial, data/hora exata da emissão e contador de registros retornados.
  - **Tabela Paginada**: cabeçalho de tabela fixo no topo das páginas, linhas zebradas para legibilidade, colunas alinhadas por tipo (texto à esquerda, datas centralizadas, valores e horas à direita em fonte monoespaçada).
  - **Linha de Totalizador**: rodapé de tabela destacado em âmbar claro com o total consolidado de horas.
  - **Rodapé de Página**: nota de confidencialidade e nome do arquivo exportado.

_[print: visualização de relatório em pdf gerado com cabeçalho oficial logotipo e tabela zebrada]_

---

## 3. Relatório de Funcionalidades Implantadas (`/reports/implemented-features`)

Painel executivo que lista todas as funcionalidades, melhorias e regras ativas no sistema:

- **Estrutura por Áreas**: categorizado em Atendimento & Chamados, Governança & SLA, Portal do Cliente, Gestão de Ativos (CMDB), Perfis & Segurança, e Relatórios & BI.
- **Detalhamento**: exibe versão de lançamento, título da funcionalidade, descrição técnica e operacional de funcionamento.
- **Ações**: busca textual rápida por palavras-chave e botão _"Exportar CSV"_ para prestação de contas à diretoria.

_[print: tela do relatório de funcionalidades implantadas com cards por área e busca]_

---

## 4. Relatório de Horas por Operador (`/reports/operator-hours`)

Ferramenta de gestão de equipe técnica para conferência da produtividade e jornada de trabalho:

- **Filtros**: Período (Data Inicial e Final), Empresa/Cliente e Operador Técnico.
- **Métricas Apuradas**:
  - **Horas Trabalhadas**: tempo total registrado pelo cronômetro via Play/Pause nos chamados atendidos.
  - **Horas de Acompanhamento**: tempo total lançado em interações manuais (que debitam a franquia do cliente).
  - **Horas Totais**: somatório global de atuação do operador.
  - **Média de Horas por Chamado**: índice de tempo médio de dedicação.
- **Totalizadores em Destaque**: cards superiores com os totais de horas trabalhadas, horas de acompanhamento e chamados atendidos no período.
- **Exportação**: botão _"Exportar CSV"_ com dados sumarizados por técnico.

_[print: tela de relatório de horas por operador com cards de totalizadores e filtros]_

---

## 5. Os Três Novos Relatórios Avançados de ITSM

Estes três relatórios compartilham a **Barra de 7 Filtros Completos** (`ReportFilterBar`):

1. **Cliente / Empresa**: seletor com busca de empresas ativas ou "Todos os clientes".
2. **Período**: seleção de Data Inicial e Data Final.
3. **Operador Responsável**: filtro por técnico designado.
4. **Filial / Unidade**: filtragem em cascata das unidades da empresa selecionada.
5. **Setor / Departamento**: filtragem pelo setor solicitante.
6. **Status do Chamado**: Novo, Em Andamento, Aguardando Solicitante, Resolvido, Fechado, etc.
7. **Atividade / Serviço**: filtragem pelo catálogo de atividades cadastradas.

---

### 5.1 Relatório Detalhado de Chamados (`/reports/tickets`)

Listagem completa linha a linha de chamados atendidos:

- **Colunas Disponíveis**:
  - `Ticket`: número identificador do chamado (ex: `#TICK-1024`).
  - `Cliente`: nome da empresa contratante.
  - `Filial`: unidade física do solicitante.
  - `Setor Solicitante`: departamento solicitante.
  - `Data Abertura`: data e hora em que o chamado foi registrado.
  - `Atividade`: classificação do catálogo de serviços.
  - `Título`: assunto principal do chamado.
  - `Status`: situação operacional atual.
  - `Horas de Acompanhamento`: total de tempo em horas decimais lançado nas interações que debitam a franquia do contrato.
  - `Data de Resolução`: momento exato do encerramento.
  - `Ativo / Equipamento`: nome e número de série do item do CMDB vinculado.
  - `Operador`: técnico responsável pelo atendimento.
  - `Solução`: resumo da justificativa e procedimento técnico de resolução registrado no fechamento.
- **Resumo no Rodapé**: somatório consolidado de horas de acompanhamento e quantidade total de tickets.
- **Exportações**: botões individuais para **CSV**, planilha **XLSX** e **PDF Oficial**.

_[print: tela do relatório detalhado de chamados com barra de 7 filtros e tabela completa]_
_[print: botões de exportação csv xlsx e pdf na tela de relatório de chamados]_

---

### 5.2 Relatório de Interações nos Chamados (`/reports/ticket-interactions`)

Auditoria detalhada de cada log e comentário de acompanhamento registrado no sistema:

- **Objetivo**: permitir auditoria minuciosa de onde e como o tempo de franquia do cliente foi consumido.
- **Colunas Disponíveis**:
  - `Ticket`: número do chamado de origem.
  - `Cliente`, `Filial` e `Setor Solicitante`: dados da empresa contratante.
  - `Data da Interação`: momento exato em que o operador postou o comentário/log.
  - `Operador`: autor da interação.
  - `Visibilidade`: Público (visível no Portal do Cliente) ou Privado (nota interna técnica).
  - `Tempo Lançado (Horas)`: tempo lançado no campo de tempo gasto (máscara `00:00`), convertido em horas decimais debitadas do cliente.
  - `Descrição da Interação`: texto integral do apontamento realizado pelo operador.
  - `Atividade` e `Status Atual do Chamado`.
- **Totalizador**: soma exata das horas de todas as interações filtradas.
- **Exportações**: suporte a **CSV**, **XLSX** e **PDF Oficial**.

_[print: tela do relatório de interações nos chamados com listagem linha a linha de logs e tempos]_

---

### 5.3 Relatório de Interações Horas Trabalhadas (`/reports/worked-hours`)

Apuração exclusiva do tempo de dedicação efetiva dos operadores capturado via cronômetro:

- **Regra de Negócio Refletida**: exibe estritamente os ciclos originados pelo **Play/Pause do chamado** (campo `origin === 'Cronômetro'`). Esses registros acumulam na jornada de trabalho do operador e **não debitam a franquia do cliente**.
- **Colunas Disponíveis**:
  - `Ticket`: número do chamado em que o operador deu o Play.
  - `Cliente`, `Filial` e `Setor`: dados organizacionais.
  - `Operador`: técnico que executou o ciclo de trabalho.
  - `Data / Hora`: início e término do ciclo de cronometragem.
  - `Tempo Trabalhado (Horas)`: duração apurada do Play até a parada do cronômetro.
  - `Status do Chamado` e `Atividade`.
- **Totalizador**: soma de horas de trabalho técnico efetivo da equipe.
- **Exportações**: suporte a **CSV**, **XLSX** e **PDF Oficial**.

_[print: tela do relatório de horas trabalhadas com apuração de ciclos de play e pause]_

---

## 6. Relatório de Ativos / CMDB (`/reports/assets`)

Inventário analítico e patrimonial de todo o parque tecnológico cadastrado:

- **Filtros Específicos**:
  - Empresa / Cliente proprietário.
  - Filial / Unidade física.
  - Setor / Departamento.
  - Tipo de Ativo (Computador, Notebook, Servidor, Switch, Impressora, etc.).
  - Status Operacional (Ativo, Em Manutenção, Reserva, Inativo, Descartado).
  - **Filtro de Status de Disponibilidade (`availability_status`)**: _Todos, Em uso, Obsoleto, Descartado, Disponível, Em Estoque_.
- **Indicadores de Resumo**:
  - Total de ativos filtrados.
  - Quantidade em uso.
  - Quantidade disponível / estoque.
  - Quantidade obsoleta / descartada.
- **Colunas da Tabela**:
  - `Nome do Equipamento` e `Hostname`.
  - `Tipo de Ativo`.
  - `Empresa`, `Filial` e `Setor`.
  - `Marca`, `Modelo` e `Número de Série`.
  - `Dono do Equipamento` (`owner`).
  - `Usuário Responsável` (`responsible_user`).
  - `Status Operacional`.
  - `Status de Disponibilidade` (com badge visual diferenciada).
  - `Data de Cadastro` e `Última Atualização`.
- **Exportações**: suporte completo a **CSV**, **XLSX** e **PDF Oficial**.

_[print: tela do relatório de ativos do cmdb com filtros de empresa filial e disponibilidade]_
_[print: cards de resumo de ativos em uso disponíveis e obsoletos]_

---

## 7. Auditoria de Automações de Ativos (`/reports/asset-automations`)

Painel de auditoria e governança para rastreabilidade de ações automáticas de equipamentos:

- **Eventos Monitorados**:
  - Exclusão de Operador com ativos vinculados (ativos viram _"Disponível"_).
  - Exclusão de Colaborador com ativos vinculados (ativos viram _"Disponível"_).
  - Exclusão de Ponto Focal com ativos vinculados (ativos viram _"Disponível"_).
  - Exclusão de Equipamento que possuía usuário responsável vinculado.
  - Cancelamentos de exclusão efetuados pelo operador no diálogo de confirmação.
- **Recursos da Tela**:
  - Escuta em tempo real (_WebSocket Realtime_) para inserção instantânea de novos logs sem necessidade de refresh.
  - Filtros por Período, Tipo de Ação, Tipo de Entidade e Busca Textual.
  - Diálogo de detalhes com JSON técnico das alterações de status anterior e novo.
  - Exportação direta para arquivo CSV de auditoria.

_[print: painel de auditoria de automações de ativos com listagem de logs de exclusão e status]_
_[print: diálogo de detalhes técnicos do log de automação de ativos]_

---

## 8. Relatório Mensal do Cliente (`/reports/monthly-client`)

Instrumento executivo mensal para prestação de contas aos clientes corporativos (Normas ABNT):

- **Parâmetros**: seleção de Cliente, Mês e Ano de competência.
- **Seções Estruturadas**:
  1. _Capa e Cabeçalho Executivo_: identificação da contratante, contratada, período e responsáveis.
  2. _Parecer Técnico da Qualidade e Governança_: campo de texto rico para considerações da liderança sobre a estabilidade do ambiente no mês.
  3. _Demonstrativo de Franquia de Horas_: franquia contratada, horas consumidas no mês, saldo remanescente e horas excedentes faturáveis.
  4. _Gráficos de Consumo por Setor_: identificação visual dos departamentos com maior volume de chamados.
  5. _Top 10 de Atividades Mais Requisitadas_: ranking de tipos de serviços prestados.
  6. _Top 10 Colaboradores Mais Atendidos_.
  7. _Indicadores de SLA e Pesquisa de Satisfação (NPS)_.
- **Ação de Liberação para o Portal do Cliente**:
  - Botão destacado _"Liberar ao Cliente"_.
  - Ao ser acionado, o registro grava `released_to_client: true`.
  - A partir desse momento, o laudo fica imediatamente disponível para download e visualização na aba _Relatórios_ do Portal do Cliente.
  - O gestor pode revogar a liberação a qualquer momento caso necessite de revisões adicionais.

_[print: tela de edição e visualização do relatório mensal do cliente padrão abnt]_
_[print: botão de liberação do relatório mensal para o portal do cliente]_

---

## 9. Demais Relatórios Operacionais

- **Auditoria de Alertas (`/reports/alert-audit`)**: monitora como os operadores reagem aos alertas de SLA e chamados retidos (confirmações, silenciamentos, tempos de resposta a popups).
- **Extração de Clientes (`/reports/clients`)**: construtor flexível de relatórios cadastrais permitindo escolher quais colunas de empresas, filiais e contatos exportar em CSV.
- **Atividades Recorrentes (`/recurrent-activities`)**: matriz de calor de demandas repetitivas para embasamento de projetos de automação e melhoria contínua.
