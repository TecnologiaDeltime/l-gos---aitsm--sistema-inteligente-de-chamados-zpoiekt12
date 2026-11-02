# Configurações, Governança e Controle de Acesso — Sistema ITSM LUIZ

Este documento aborda os aspectos de segurança, perfis de acesso, parametrizações globais do sistema, identidade visual, autenticação de dois fatores e regras arquiteturais de negócio.

---

## 1. Perfis de Acesso e Matriz Granular de Permissões (`/profiles`)

O controle de autorização do Sistema ITSM LUIZ adota o modelo de matriz de permissões granulares por perfil de acesso, permitindo que a liderança defina exatamente quais telas, botões e ações cada colaborador pode executar.

### 1.1 Os 3 Níveis de Acesso

A partir da versão v0.0.265, cada item e módulo do sistema opera com três níveis estritos de permissão:

1. **Visualizar (`view`)**:
   - O usuário pode navegar pelas telas, consultar listagens, gráficos e detalhes.
   - Todos os botões de ação de alteração (_Criar, Adicionar, Editar, Salvar, Excluir_) são ocultados da interface.
   - Rotas diretas de criação e edição são bloqueadas.
2. **Editar (`edit`)**:
   - O usuário pode visualizar e realizar operações de criação e edição (abrir chamados, cadastrar clientes, alterar status, adicionar interações, atualizar registros).
   - Ações destrutivas de exclusão permanente (_botões de excluir, apagar, remover em lote_) são estritamente ocultadas e bloqueadas.
3. **Configurar (`configure`)**:
   - Acesso irrestrito ao item/módulo.
   - Permite visualizar, criar, editar e excluir registros, além de gerenciar configurações avançadas do módulo.

_[print: tela de gestão de perfis de acesso com listagem de perfis cadastrados]_
_[print: matriz granular de permissões com colunas visualizar editar e configurar]_

---

### 1.2 Regras de Imunidade e Auto-Registro Dinâmico

- **Imunidade do Administrador**:
  O usuário com perfil `admin` possui imunidade total e permanente. Ele herda nível `configure` em todas as rotas e itens, garantindo que nunca fique trancado fora do sistema.
- **Catálogo Auto-Registrável (`permissions-registry.ts`)**:
  Qualquer nova rota, menu ou funcionalidade adicionada ao sistema é automaticamente registrada no catálogo de permissões e **nasce concedida por padrão** para os perfis ativos. Isso garante que atualizações de versão não quebrem a rotina dos operadores. O Administrador pode posteriormente restringir o acesso na matriz.
- **Guarda de Rotas (`ProtectedRoute`) e Hook `usePermissions`**:
  Todas as rotas da aplicação são verificadas pelo `ProtectedRoute`. Se um usuário tentar acessar uma URL cujo item de catálogo foi revogado em seu perfil, o sistema impede a renderização e o redireciona com segurança.

---

### 1.3 Tela Inicial por Perfil de Acesso (_Landing Route_)

Cada Perfil de Acesso possui o campo configurável **Tela Inicial (Landing)**:

- Permite definir qual rota da aplicação será aberta imediatamente após o operador realizar o login.
- **Padrão de Fábrica**:
  - Perfis operacionais (Analista N1, Analista N2, Técnico de Campo) abrem diretamente no **Painel do Operador** (`/operator-dashboard`).
  - Perfil de Administrador e Gestor abrem no **Dashboard** (`/dashboard`).
- **Fallback Seguro**: se a rota configurada como tela inicial for desmarcada na matriz de permissões daquele perfil, o sistema executa fallback seguro para `/dashboard` sem exibir erro de rota bloqueada.

_[print: modal de edição de perfil de acesso com seletor de tela inicial landing route]_

---

## 2. Painel do Operador (`/operator-dashboard`)

Primeira tela de entrada dos perfis técnicos e de atendimento, projetada para foco e produtividade imediata:

- **Segregação Rigorosa de Horas (Regra Oficial v0.0.276)**:
  - **Horas Hoje**: somatório de todas as horas registradas no dia atual.
  - **Horas Trabalhadas (Mês / Play-Pause)**: total de tempo apurado exclusivamente pelo cronômetro ao acionar o Play/Pause dos chamados. Essas horas **não debitam a franquia do cliente** e acumulam para controle de jornada do operador.
  - **Horas de Acompanhamento (Mês / Debita Franquia)**: total de tempo lançado manualmente em interações e logs com máscara `00:00`. Essas horas **debitam a franquia contratada da empresa cliente**.
- **Gráfico Comparativo dos Últimos 3 Meses**:
  - Exibe a série temporal mensal comparando lado a lado as barras de _Horas Trabalhadas (Play/Pause)_ versus _Horas de Acompanhamento (Franquia)_.
- **Minhas Visitas do Dia**: cards com os agendamentos presenciais designados para o operador com horário, cliente e endereço.
- **Meus Chamados em Andamento**: atalhos para os chamados assumidos pelo operador que exigem ação rápida.

_[print: painel do operador com kpis destacados de horas trabalhadas e horas de acompanhamento]_
_[print: gráfico de barras dos últimos 3 meses comparando trabalho versus acompanhamento]_

---

## 3. Autenticação, Sessão e Segurança

### 3.1 Tela de Login Operacional (`/login`)

- Acesso com E-mail corporativo e Senha.
- Link no rodapé direcionando para `/portal/login` caso clientes finais acessem o endereço de operadores por engano.
- Proteção contra força bruta com bloqueio temporário por tentativas incorretas consecutivas.

### 3.2 Autenticação em Duas Etapas (2FA / TOTP)

- Implementação baseada em algoritmo TOTP (Time-based One-Time Password), compatível com Google Authenticator, Microsoft Authenticator e Authy.
- **Primeiro Acesso Obrigatório para Administradores**:
  - Ao realizar o primeiro login com credenciais de Administrador ou Gestor, o sistema detecta que o 2FA está pendente e redireciona para a tela de setup (`totp_setup`).
  - Um QR Code seguro e uma chave textual secreta são apresentados na tela.
  - O usuário deve escanear o QR Code em seu aplicativo autenticador e digitar o código de 6 dígitos gerado para ativar o segundo fator.
- **Validação no Login Subsequente (`step: totp`)**:
  - Após validar e-mail e senha, o formulário avança para a etapa do código de 6 dígitos.
  - Suporte a código de recuperação de emergência caso o operador tenha perdido o dispositivo móvel.

_[print: tela de login operacional com e-mail e senha]_
_[print: tela de configuração obrigatória de 2fa totp com qr code]_
_[print: tela de digitação de código de 6 dígitos do segundo fator]_

---

### 3.3 Modo Suporte do Administrador (Impersonação de Clientes)

Mecanismo de governança que permite ao Administrador do ITSM auditar e validar exatamente a visão que cada cliente possui no Portal sem necessitar de suas credenciais:

- **Exclusividade**: restrito a usuários com `role === 'admin'`. Operadores e clientes comuns não possuem acesso.
- **Pontos de Entrada**:
  - Painel destacado na tela `/portal/login` quando o Administrador já estiver logado.
  - Botão _"Acessar como Cliente"_ em cada empresa na aba de Configurações do Portal (`/settings?tab=portal`).
  - URL direta `/portal?company=<id>`.
- **Barra Superior Âmbar Fixa**:
  - Badge visual de alerta: `Modo Suporte • Administrador`.
  - Seletor suspenso que permite alternar entre empresas clientes em tempo real sem precisar deslogar.
  - Botão _"Voltar ao Sistema Interno"_ para retorno imediato ao ITSM.
- **Comportamento em Todos os 6 Módulos**:
  - Todos os dados exibidos (Meus Chamados, Abrir Chamado, Aprovações, Inventário CMDB, Visitas e Saldo de Horas) são filtrados instantaneamente para a empresa selecionada.

_[print: barra de topo âmbar do modo suporte do administrador com seletor de empresas]_

---

## 4. Configurações Globais do Sistema (`/settings`)

A tela de configurações centraliza os principais motores de infraestrutura e serviços:

### 4.1 Caixa de E-mail de Entrada & Ingestão IMAP (`/settings?tab=email`)

- **Protocolos Suportados**: IMAP com criptografia SSL/TLS e suporte a OAuth2/Microsoft Graph.
- **Parâmetros**: Servidor IMAP (host), porta (993), usuário/e-mail, senha e pasta de leitura.
- **Processamento Automático de Tickets**:
  - O motor de e-mail varre a caixa postal periodicamente.
  - E-mails de novos remetentes desconhecidos ou sem assunto entram na quarentena de **Chamados Retidos** (`/tickets/retained`) para triagem manual.
  - E-mails de clientes válidos geram chamados automaticamente com categoria padrão.
  - Respostas a chamados existentes são convertidas em interações na timeline do ticket correspondente.
- **Filtros Antispam e Sanitização**: motor de limpeza de assinaturas e formatações maliciosas (`sanitize-email-html.ts`).

_[print: aba de configurações de imap e e-mail com testes de conexão]_
_[print: tela de triagem de chamados retidos e quarentena de e-mails]_

---

### 4.2 Parâmetros e Alertas de SLA (`/settings/sla`)

- **Limiares de Alerta**: definição do tempo em minutos antes do vencimento para disparar avisos de risco de estouro (ex: 30 minutos antes).
- **Canais de Notificação**:
  - Notificação sonora em navegador.
  - Sintetizador de voz automática para alertas críticos.
  - Popups em tela para operadores com chamados em risco de expiração.
- **Matriz de Prioridade ITIL**: parametrização de tempos de resposta e solução para prioridades Baixa, Média, Alta e Crítica.

_[print: tela de configurações de sla com limiares de tempo e alertas sonoros]_

---

### 4.3 Outras Abas de Configuração

- **Portal do Cliente (`/settings?tab=portal`)**: liberação de auto-provisionamento de solicitantes e pontos focais, com senha inicial padrão `Cliente@123`.
- **Notificações de Clientes (`/settings?tab=client_notif`)**: personalização dos e-mails transacionais enviados ao solicitante na abertura, interação e resolução de chamados, além da definição do **Prazo de Reabertura de Chamados em Dias**.
- **Modelos de Chamados (`/settings/ticket-templates`)**: cadastro de respostas padronizadas e templates de solução.
- **Segurança & Sessão (`/settings?tab=security`)**: tempo de expiração de sessão por inatividade e políticas de complexidade de senha.

_[print: aba de modelos de chamados com cadastro de templates de solução]_

---

## 5. Identidade Visual e Temas Oficiais

O design do Sistema ITSM LUIZ segue uma paleta de cores corporativa de alto contraste, desenvolvida para reduzir a fadiga visual:

### 5.1 Os Dois Temas Oficiais

1. **Modo Escuro (Amber Alert) — Padrão do Sistema**:
   - Barra superior e menu lateral em grafite escuro `#17181C`.
   - Textos e ícones do menu em tom âmbar suave `#FCD34D`.
   - Elementos ativos, destaques e badges principais em âmbar vibrante `#D97706`.
   - Fundo principal em tons de cinza/grafite escuro com alto contraste de leitura.
2. **Modo Claro (Marrom & Branco)**:
   - Mesma barra superior e menu lateral em grafite escuro `#17181C` para manter a identidade da marca.
   - Textos e ícones do menu em branco puro `#FFFFFF`.
   - Elementos ativos e destaques mantidos em âmbar `#D97706`.
   - Fundo principal da aplicação em tons de off-white e cartões brancos com sombras suaves.

### 5.2 Alternador no Topo e Estabilidade de Gráficos

- **Alternador de Tema (Sol / Lua)**: localizado fixo no cabeçalho superior direito da aplicação, permitindo troca imediata com persistência em banco via `useTheme` / `designSettings`.
- **Estabilidade Visual em Gráficos**: todos os rótulos de dados nos gráficos e dashboards operam com animações desativadas (`isAnimationActive={false}`), eliminando qualquer efeito de tremor ou piscar visual durante o carregamento de métricas.

_[print: cabeçalho superior do sistema com alternador de tema sol e lua]_
_[print: visual do sistema no tema escuro amber alert padrão]_
_[print: visual do sistema no tema claro marrom e branco]_

---

## 6. Regras Críticas de Negócio e Arquitetura de Dados

### 6.1 A Regra de Ouro das Horas (v0.0.276, Migrações 0108/0109)

O sistema opera com separação estrita e auditável entre o tempo que custeia o contrato do cliente e o tempo que afere o trabalho do técnico:

- **Horas de Acompanhamento (Logs e Interações Manuais)**:
  - Todo registro lançado na timeline do chamado onde a origem for diferente de `Cronômetro`.
  - **Debita a franquia contratada da empresa cliente**.
  - O operador informa o tempo utilizando a máscara com dois pontos fixos (`00:00`), com minutos validados até 59.
  - Ao editar uma interação, o saldo de horas do cliente é recalculado automaticamente.
  - Ao excluir uma interação, o tempo é estornado da franquia do cliente.
- **Horas Trabalhadas (Cronômetro / Play e Pause)**:
  - Todo registro gerado pela ferramenta de Play e Pause no chamado.
  - **Não debita a franquia contratada da empresa cliente**.
  - Acumula estritamente no total de horas trabalhadas do operador técnico para apuração de produtividade e controle de escala de trabalho.
  - Impede a bitributação ou cobrança indevida de tempo de espera do cliente.

---

### 6.2 SLA de Resposta no Play

- Ao criar um chamado, o cronômetro de primeiro atendimento é iniciado.
- No momento exato em que o operador clica no botão **Play** no chamado, o cronômetro de SLA de Resposta é paralisado e apurado instantaneamente:
  - Se a data/hora atual for menor ou igual à data limite do SLA de Resposta: o chamado registra `sla_response_compliance: "Em conformidade"`.
  - Se o prazo tiver expirado: o chamado registra `sla_response_compliance: "Fora de conformidade"`.
- O resultado é gravado de forma imutável no banco, exibido no badge do bloco lateral de SLA e documentado na timeline do chamado.

---

### 6.3 Automação de Ativos na Exclusão

- Proteção contra ativos de TI órfãos:
  - Excluir Operador, Colaborador ou Ponto Focal com ativos em seu nome aciona diálogo de confirmação (_Sim / Cancelar_).
  - Ao confirmar com **Sim**, todos os equipamentos vinculados mudam seu campo `availability_status` para **"Disponível"**, ficando livres no CMDB.
  - O mesmo aviso ocorre ao excluir um equipamento com usuário associado.
  - Essa regra é assegurada no frontend e em nível de banco de dados via hooks PocketBase (`pocketbase/hooks/`), cobrindo inclusive alterações diretas via API.
  - Todas as confirmações e cancelamentos geram registros auditáveis na coleção `asset_automation_logs`, consultáveis no relatório correspondente.

---

### 6.4 Ponto de Restauração e Procedimento de Rollback

- O ponto de restauração oficial homologado está estabelecido na versão **0.0.291** (tag `restore-point-0.0.291`).
- O procedimento de recuperação está detalhado em `docs/RESTAURACAO.md`.
- **Escopo Técnico**: o rollback na plataforma Skip restaura **exclusivamente o código-fonte da aplicação**. Dados transacionais e registros do banco de dados PocketBase não são apagados por rollbacks de código.
