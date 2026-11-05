# Documentação Oficial e Completa do Lógos AITILSM

Bem-vindo à documentação oficial completa do **Lógos AITILSM**. Este documento consolida a arquitetura funcional, regras de negócio vigentes, perfis de acesso, fluxos operacionais, relatórios e parâmetros de configuração da plataforma.

A documentação adota o formato **Híbrido**: texto descritivo detalhado em conformidade estrita com o código-fonte da aplicação, enriquecido com marcadores de captura de tela no padrão `*[print: descrição da tela ou ação]*`, permitindo inserção posterior das capturas de tela.

---

## 1. Índice Geral da Documentação

O conjunto documental está dividido em módulos temáticos para facilitar a consulta por gestores, operadores, auditores e administradores:

1. **[Módulos Operacionais](MODULOS_OPERACIONAIS.md)**
   - **Central de Chamados / Tickets**: Abertura, Fila de Tickets, Kanban, Play/Pause do Operador, Timeline, Catálogo de Atividades, Encerramento e Solução, Reabertura com Prazo Configurável e Motivo Obrigatório, Pesquisa de Satisfação com Estrelas.
   - **Atendimento Omnichannel (`/atendimento`)**: Console de conversas simultâneas, SLA Live Countdown, Triagem, Dossiê de Handoff com IA, Nova Conversa e Vinculação de Chamados.
   - **Clientes e Estrutura Organizacional**: Empresas Clientes, Filiais, Setores/Departamentos, Colaboradores e Pontos Focais.
   - **CMDB & Gestão de Ativos**: Cadastro Completo de Ativos e Itens de Configuração, Dono do Equipamento, Usuário Responsável, Status de Disponibilidade (_Em uso, Obsoleto, Descartado, Disponível, Em Estoque_), Importação em lote e Tipos de CI.
   - **Gestão de Contratos**: Contratos vigentes, franquia de horas, conciliação, períodos contratuais e múltiplos níveis de atendimento por contrato (seleção múltipla, consumo por nível e migração 0125 com campo `service_levels`).
   - **Gestão de Visitas Técnicas N2**: Dashboard de Visitas, Calendário e Agenda, Minhas Visitas, Lançamento de Despesas e Reembolsos, Ordens de Serviço, Assinaturas Digitais, Checklists Técnicos e Visitas Recorrentes.
   - **Base de Conhecimento com Inteligência Artificial**: Consulta e publicação de artigos técnicos, Geração Automática de Rascunhos por IA a partir de notas de encerramento de técnicos seniores, Painel de Cura com Diagnóstico Algorítmico e Agente Nativo de IA para Resposta a Chamados nos dois modos (sugestão ao operador e resposta automática).
   - **Portal do Cliente (`/portal`)**: Tela de Login dedicada (`/portal/login`), Dashboard Analítico, Meus Chamados com timeline pública, Abertura de Chamado, Aprovações por Pontos Focais, Inventário de TI (CMDB) com histórico de manutenção e atalho de chamado, Visitas Técnicas agendadas com técnico designado, Saldo de Horas e Franquia, e Relatórios Mensais ABNT Liberados.

2. **[Relatórios e Extrações](RELATORIOS.md)**
   - **Inventário de Funcionalidades Implantadas (`/reports/implemented-features`)**: Catálogo executivo de entregas e recursos do sistema com exportação em CSV.
   - **Relatório de Horas por Operador (`/reports/operator-hours`)**: Apuração individual com separação entre horas trabalhadas (play/pause) e horas de acompanhamento (logs manuais), com totalizadores e exportação em CSV.
   - **Relatório de Chamados (`/reports/tickets`)**: Listagem linha a linha com Ticket, Cliente, Filial, Setor, Datas, Atividade, Status, Horas de Acompanhamento, Ativo, Operador e Solução, com 7 filtros completos e exportações em CSV, XLSX e PDF oficial.
   - **Relatório de Interações nos Chamados (`/reports/ticket-interactions`)**: Inspeção linha a linha de cada log e interação de acompanhamento lançada com tempo faturado para auditoria.
   - **Relatório de Interações Horas Trabalhadas (`/reports/worked-hours`)**: Apuração linha a linha do tempo efetivo de trabalho do cronômetro (play/pause), não debitando franquia do cliente e acumulando no operador.
   - **Relatório de Ativos / CMDB (`/reports/assets`)**: Inventário detalhado de hardware e CIs com filtros de Empresa, Filial, Setor e Status de Disponibilidade, e exportações em CSV, XLSX e PDF.
   - **Auditoria de Automações de Ativos (`/reports/asset-automations`)**: Rastreabilidade e logs de auditoria em tempo real das exclusões de usuários e equipamentos, transições para "Disponível" e confirmações/cancelamentos.
   - **Relatório Mensal do Cliente (`/reports/monthly-client`)**: Laudo ABNT completo com parecer técnico, gráficos de consumo, top 10 atividades e botão de liberação para o Portal do Cliente.
   - **Padrões de Exportação**: Arquivos CSV, planilhas XLSX com tema oficial e documentos PDF com cabeçalho corporativo (logotipo, data/hora da extração, título e nome do cliente).

3. **[Configurações, Governança e Acesso](CONFIGURACOES_E_ACESSO.md)**
   - **Autenticação, Sessão e Segurança**: Login Operacional (`/login`), Verificação em Duas Etapas (2FA / TOTP) com primeiro acesso forçado para administradores, Modo Suporte do Administrador (impersonação segura no Portal do Cliente com barra de topo âmbar).
   - **Perfis de Acesso (`/profiles`)**: Matriz granular de permissões com 3 níveis (_Visualizar, Editar, Configurar_), Imunidade Total do Administrador, Auto-registro dinâmico de novas funcionalidades e Tela Inicial (_Landing Route_) configurável por perfil.
   - **Painel do Operador (`/operator-dashboard`)**: Primeira tela dos perfis de operação, com segregação de horas de hoje, do mês e dos últimos 3 meses (_Trabalhadas via Play/Pause × Acompanhamento via Logs_).
   - **Agente de Distribuição Automática de Chamados**: Distribuição inteligente por disponibilidade → ociosidade → líder da fila, cron de reavaliação com intervalo configurável e permissão 3 níveis (`settings_auto_assign`).
   - **Parâmetros de SLA**: Temas de aviso e alertas de resposta/solução, som, popup e voz.
   - **Caixa de E-mail & Ingestão IMAP**: Conexão IMAP/SMTP/Microsoft Graph, quarentena e chamados retidos.
   - **Identidade Visual e Temas Oficiais**: Modo Escuro _Amber Alert_ padrão (#17181C grafite, #FCD34D letras âmbar, #D97706 ativo) e Modo Claro _Marrom & Branco_ (#17181C grafite, #FFFFFF letras brancas, #D97706 ativo), alternador no topo e ausência de animações/piscar em gráficos.
   - **Regras Críticas de Negócio**: Regra das Horas (acompanhamento debita franquia × play/pause acumula no operador e não debita), SLA de Resposta no Play, Máscara fixa de Tempo Gasto (`00:00`), e Automações de Ativos na exclusão de usuários/equipamentos.
   - **Pontos de Restauração e Rollback**: Ponto vigente `restore-point-0.0.353` / `restore-point-0.0.352` e ponto anterior `restore-point-0.0.291` (v0.0.291), documentação em `docs/RESTAURACAO.md` e escopo restrito a código.

4. **[Documentos Complementares Existentes]**:
   - [Agente de Distribuição Automática de Chamados](AGENTE_DISTRIBUICAO_AUTOMATICA.md)
   - [Agente Inteligente de Consumo Médio de Horas](AGENTE_CONSUMO_HORAS.md)
   - [Portal do Cliente Detalhado](PORTAL_DO_CLIENTE.md)
   - [Perfis de Acesso e Matriz Granular](PERFIS_DE_ACESSO.md)
   - [Procedimento de Restauração e Rollback](RESTAURACAO.md)
   - [Integração com Ferramenta de Monitoramento PRTG](INTEGRACAO_PRTG.md)
   - [Modo TV e Painéis em Rotação Automática](MODO_TV.md)
   - [Chamados Internos entre Setores e Chat de Operadores](CHAMADOS_INTERNOS_E_CHAT.md)

---

## 2. Visão de Arquitetura da Solução

O Lógos AITILSM é construído em tecnologia web moderna e escalável:

- **Frontend**: React 19 + TypeScript + Vite + Tailwind CSS + Kit completo shadcn/ui.
- **Backend**: PocketBase nativo no Skip Cloud com migrações JavaScript idempotentes (`pocketbase/migrations/`), hooks de ciclo de vida (`pocketbase/hooks/`) e WebSocket realtime para eventos instantâneos.
- **Roteamento e Proteção**: React Router com componente `ProtectedRoute`, avaliando em tempo real a sessão do usuário e a matriz de permissões (`usePermissions`).
- **Comunicação em Tempo Real**: Notificações globais e atualizações de fila via `AutoRefreshContext` e assinaturas realtime do PocketBase.

_[print: layout geral do sistema com barra lateral grafite e alternador de tema no topo]_

---

## 3. Resumo das Principais Regras de Negócio Vigentes

| Regra                               | Descrição no Sistema                                                                                                                                                                                                                                                                                                                                                                                                                             | Impacto Operacional                                                                                                                                                                                     |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Regra das Horas**                 | Horas de acompanhamento (logs e interações com origem ≠ Cronômetro) debitam a franquia contratada da empresa. Horas de trabalho via cronômetro (Play/Pause) acumulam na jornada de trabalho do operador e **não debitam** a franquia do cliente.                                                                                                                                                                                                 | Garante que o cliente pague estritamente pelo acompanhamento acordado, e o operador tenha registro fidedigno de suas horas trabalhadas sem bitributação. Edição recalcula e exclusão estorna os saldos. |
| **SLA Resposta no Play**            | Ao clicar no botão **Play** pela primeira vez no chamado, o cronômetro de resposta para imediatamente e é apurado naquele exato instante: dentro do prazo = _"Em conformidade"_, estourado = _"Fora de conformidade"_.                                                                                                                                                                                                                           | Fim de disputas de SLA de primeiro atendimento. A conformidade é gravada na timeline e no bloco lateral de SLA.                                                                                         |
| **Tempo Gasto**                     | Campo com máscara rígida de dois pontos fixos (`00:00`), limitando minutos de 00 a 59. Botão legado "Iniciar" foi removido em favor do controle exclusivo por Play/Pause. Campos legados "Tipo de hora" e "Faturamento" foram removidos.                                                                                                                                                                                                         | Elimina erros de digitação e inconsistências nos lançamentos de horas de acompanhamento.                                                                                                                |
| **Automação de Ativos**             | Ao excluir operador, colaborador ou ponto focal que possua ativo em seu nome, o sistema exibe diálogo de aviso (_Sim / Cancelar_). Ao confirmar, os equipamentos vinculados mudam automaticamente para **"Disponível"**. O mesmo ocorre ao tentar excluir equipamento com usuário vinculado. Válido na interface e via hooks de API.                                                                                                             | Impede que ativos fiquem órfãos ou vinculados a pessoas inativas. Todas as confirmações e cancelamentos geram logs em `asset_automation_logs`.                                                          |
| **Perfis e Tela Inicial**           | Cada perfil possui uma rota de entrada configurável (_Landing Route_). Perfis operacionais abrem diretamente no Painel do Operador (`/operator-dashboard`); Administrador no Dashboard (`/dashboard`).                                                                                                                                                                                                                                           | Agilidade de trabalho imediata após o login sem cliques adicionais.                                                                                                                                     |
| **Temas Oficiais**                  | Escuro _Amber Alert_ (padrão) e Claro _Marrom & Branco_, ambos mantendo barra superior grafite `#17181C` e destaque âmbar `#D97706`. Rótulos de gráficos estáticos sem animações repetitivas.                                                                                                                                                                                                                                                    | Conforto visual e ergonomia para operadores em turnos de longa duração.                                                                                                                                 |
| **Resposta IA (Dois Modos)**        | Agente nativo do Skip Cloud (`ticket-responder-agent`) configurado em `/settings?tab=ai_reply`. Opera em dois modos: (1) Sugestão ao operador no chamado interno com rascunhos contextualizados (revisar/editar/enviar); e (2) Resposta automática em novos chamados (interno e/ou Portal do Cliente). Respostas automáticas usam `origin: 'Automático'`, `duration_minutes: 0`, status `Não Faturável` e **não debitam a franquia do cliente**. | Acelera o primeiro atendimento e padroniza respostas com suporte contextual a ativos e base de conhecimento sem impactar o faturamento.                                                                 |
| **Catálogo & Tipo Automático**      | O seletor manual de "Tipo" na abertura de chamado foi removido; o tipo do chamado deriva da atividade do catálogo. A exclusão de atividades é protegida por `tickets_catalogo_delete`: itens com chamados vinculados são arquivados de forma transparente sem quebrar referências históricas.                                                                                                                                                    | Garante integridade referencial absoluta dos chamados antigos e simplifica a experiência de abertura para técnicos e clientes.                                                                          |
| **Equipe Responsável e Roteamento** | Na abertura de chamados (interno, agendado e portal), o campo Contrato foi removido da abertura e o Operador tornou-se opcional. A Equipe Responsável (fila de atendimento) tornou-se obrigatória e é pré-carregada automaticamente a partir da atividade selecionada no catálogo (campo `queue` cadastrado com permissão `tickets_catalogo_queue`), permitindo troca antes do envio.                                                            | Agiliza a entrada de chamados sem travas burocráticas de contrato e garante o direcionamento correto para a fila da equipe técnica responsável.                                                         |
