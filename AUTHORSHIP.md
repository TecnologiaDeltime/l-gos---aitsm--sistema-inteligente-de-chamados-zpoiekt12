# Lógos AITSM — Documento de Autoria

Documento de autoria e titularidade do sistema **Lógos AITSM**, registrado conforme as informações fornecidas pelo criador e titular dos direitos.

---

## Projeto

Lógos AITSM

## Criador

Luiz Barros de Souza Junior, 36464211854

## Titular dos direitos

Luiz Barros de Souza Junior 36464211854

## Data da primeira versão

05/11/2026

## Contribuição

> contribuí com minha capacidade intelectual contribuindo para a construção deste sistema até essa versão versão 0.0.354

## Fundamentação

> todas as funcionalidades foram pensadas por mim com base em estudo de boas práticas disponibilizadas nas certificações ITIL, ITSM, ISO27001, Governança de TI, Kanban e Scrum com o auxilio do Skip para a criação do sistema.

---

## Registro de Versões Contribuídas

O **Lógos AITSM** é versionado de forma incremental e contínua pela plataforma Skip Cloud, onde cada ciclo de QA aprovado (`run_qa` + `commit_changes`) gera uma nova versão sequencial no histórico do projeto e no `package.json`. Este tópico registra as versões contribuídas pelo criador, desde a versão inicial **0.0.1** até a versão vigente **0.0.356**, consolidadas em marcos documentados na documentação oficial do projeto ([docs/DOCUMENTACAO.md](docs/DOCUMENTACAO.md), [Relatório de Funcionalidades Implantadas](src/pages/reports/ImplementedFeaturesReport.tsx), [docs/RESTAURACAO.md](docs/RESTAURACAO.md), [docs/PORTAL_DO_CLIENTE.md](docs/PORTAL_DO_CLIENTE.md) e [docs/CONFIGURACOES_E_ACESSO.md](docs/CONFIGURACOES_E_ACESSO.md)). Entre os marcos listados, as versões intermediárias correspondem a evoluções incrementais contínuas do sistema.

| Faixa de versões      | Marco contribuído                                                                                                                                                                                                                         |
| --------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **0.0.1**             | Versão inicial do sistema (data da primeira versão registrada: 05/11/2026).                                                                                                                                                               |
| **0.0.2 → 0.0.254**   | Desenvolvimento incremental contínuo do núcleo da plataforma ITSM (módulos centrais, filas, catálogo de atividades, perfis e infraestrutura PocketBase), conforme catálogo do Relatório de Funcionalidades Implantadas.                   |
| **0.0.255 / 0.0.256** | Portal do Cliente completo com 6 módulos (Dashboard Analítico, Meus Chamados, Abertura de Chamado, Aprovações, Ativos CMDB, Visitas Técnicas e Saldo de Horas) — `docs/PORTAL_DO_CLIENTE.md`.                                             |
| **0.0.265**           | Matriz de Perfis de Acesso granular com 3 níveis (Visualizar, Editar, Configurar) e auto-registro dinâmico de novas funcionalidades — `docs/PERFIS_DE_ACESSO.md` e `docs/CONFIGURACOES_E_ACESSO.md`.                                      |
| **0.0.276**           | Regra de Ouro das Horas (Migrações 0108/0109): horas de acompanhamento debitam a franquia do cliente; tempo de play/pause acumula nas horas de trabalho do operador.                                                                      |
| **0.0.280**           | Campo "Tela inicial" (Landing Route) personalizada por perfil e catálogo de permissões auto-registrável dinâmico — Relatório de Funcionalidades Implantadas.                                                                              |
| **0.0.291**           | Marco de estabilização do Portal do Cliente, Matriz de Perfis Granulares, Landing Routes e módulo de Visitas Técnicas N2; ponto de restauração legado `restore-point-0.0.291` (commit `22a8d58`).                                         |
| **0.0.292 → 0.0.320** | Evoluções integradas registradas em `docs/RESTAURACAO.md`: Chamados Internos entre Setores, Chat Interno de Operadores em tempo real, Automação de Ativos CMDB, Agente de Distribuição Automática de Chamados, Integração PRTG e Modo TV. |
| **0.0.321 / 0.0.322** | Agente Inteligente de Consumo Médio de Horas com alertas preditivos de esgotamento de franquia — `docs/AGENTE_CONSUMO_HORAS.md`.                                                                                                          |
| **0.0.323 → 0.0.351** | Evoluções incrementais contínuas, incluindo Histórico de Chat por Operador com busca textual avançada (normalização Unicode NFD), refinamentos de relatórios e integrações.                                                               |
| **0.0.352 / 0.0.353** | Consolidação estável pós-migração 0131 (chamados internos, chat em tempo real e modo TV); ponto de restauração oficial `restore-point-0.0.353`.                                                                                           |
| **0.0.354**           | Registro do ponto de restauração vigente `restore-point-0.0.353` (commit `22445aa`) e atualização do procedimento de rollback — `docs/RESTAURACAO.md`.                                                                                    |
| **0.0.355 / 0.0.356** | Unificação da marca oficial do sistema na grafia **Lógos AITSM** em todo o projeto.                                                                                                                                                       |
| **0.0.356 (vigente)** | Versão atual do `package.json` na data deste registro.                                                                                                                                                                                    |
