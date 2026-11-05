# Agente Inteligente de Consumo Médio de Horas (Lógos AITSM)

Este documento detalha o funcionamento, arquitetura, regras de negócio e parametrizações do **Agente de Consumo Médio**, implantado no sistema Lógos AITSM.

---

## 1. Objetivo

Aprender continuamente o comportamento de consumo de horas de franquia de cada cliente (empresa) e notificar proativamente os usuários com perfil de **Qualidade** e **Gestor** em caso de:

1. **Consumo Elevado** (acima da margem de tolerância): risco de estouro de franquia, cobrança extra não planejada ou sobrecarga operacional.
2. **Consumo Muito Abaixo** (abaixo da margem de tolerância): risco de ociosidade, cliente subutilizando o contrato, insatisfação velada ou retenção em perigo.

---

## 2. Regra de Horas e Definição de Consumo

Conforme a regra definitiva do Lógos AITSM (migrações `0108` e `0109`):

- **Horas de Acompanhamento** (logs e interações de chamados com origem diferente de _Cronômetro_): **debitam a franquia do cliente**.
- **Tempo de Play/Pause (Cronômetro)**: acumula nas horas de trabalho do operador e **não debita franquia**.
- **Métrica avaliada pelo Agente**: O débito real de franquia (horas de acompanhamento) acumulado por mês/período.

---

## 3. Mecanismo de Aprendizado e Detecção

### 3.1. Cálculo do Consumo Médio Histórico

Para cada cliente cadastrado:

- O agente busca os registros em `client_hours_history` e `contract_periods` dos últimos **N meses** (padrão de 3 meses, configurável entre 2 e 6 meses).
- Se não houver histórico fechado nessas tabelas, o agente agrega as interações de chamados (`ticket_interactions` com `origin != 'Cronômetro'`) dos meses anteriores.
- Calcula a média aritmética mensal:
  $$\text{Média Aprendida} = \frac{\sum \text{Horas Debitadas nos Meses Anteriores}}{N}$$
- Persiste a média aprendida e o período de referência (ex.: `2026-08 a 2026-10`) na coleção `client_consumption_agents`.

### 3.2. Consumo do Período Corrente

- O agente calcula o total de horas debitadas no mês atual (até o dia da verificação).
- Projeta o desvio percentual em relação à média aprendida:
  $$\text{Desvio (\%)} = \frac{\text{Consumo Atual} - \text{Média Aprendida}}{\text{Média Aprendida}} \times 100$$

### 3.3. Classificação de Desvio

- **Consumo Elevado**: $\text{Desvio} \ge +\text{Margem Alta}$ (padrão $+30\%$).
- **Consumo Muito Abaixo**: $\text{Desvio} \le -\text{Margem Baixa}$ (padrão $-30\%$).
- **Dentro do Padrão**: entre as duas margens.

---

## 4. Anti-Ruído

Para evitar spam de notificações:

- O agente armazena o `last_alert_status` e `last_alert_period` (ex.: `2026-11`).
- Se o cliente já foi alertado sobre `high` no mês corrente, não repete o disparo de e-mails a cada rodada diária do cron, a menos que o status mude para `low` ou `normal` e depois reincida, ou que um operador force o recálculo com disparo explícito.

---

## 5. Destinatários e Notificações

### 5.1. Identificação dos Usuários

O agente filtra os usuários ativos no sistema (`users` onde `active != false`) cujo `profile_id` corresponda a um perfil cujo nome contenha:

- `qualidade`
- `gestor`
- `gerente`
- `administrador` / `admin`

### 5.2. Canais de Notificação

1. **Notificação In-App (`notifications`)**: Registrada para cada gestor/qualidade com link direto para o cliente.
2. **E-mail com Template Lógos AITSM**:
   - Cabeçalho oficial Grafite `#17181C` com logo Lógos AITSM e acento âmbar `#D97706`.
   - **Consumo Elevado**: tom **VERMELHO** (`#DC2626` / `#FEF2F2`) com ícone de alerta crítico.
   - **Consumo Muito Abaixo**: tom **AMARELO** (`#EAB308` / `#FEFCE8`) com ícone de atenção.
   - Detalha: Nome do Cliente, Consumo Atual, Média Histórica Aprendida, Desvio Percentual e botão com link direto para o sistema.

---

## 6. Telas de Configuração

### 6.1. Configurações Gerais (`/settings?tab=consumption_agent`)

- Painel central com visão geral de todos os clientes e seus respectivos status de diagnóstico.
- Indicadores globais: Total Monitorados, Consumo Elevado (vermelho), Consumo Abaixo (amarelo), Dentro do Padrão (verde).
- Filtros por busca de nome e por status de diagnóstico.
- Edição rápida das tolerâncias (alta e baixa) e janela histórica por cliente.
- Botão **"Executar Avaliação Agora"** para rodar a análise de todos os clientes em tempo real.

### 6.2. Edição do Cliente (`/clients/:id/edit`)

- Seção dedicada **"Agente Inteligente de Consumo de Horas"** integrada à ficha do cliente.
- Switch para ativar/desativar o monitoramento específico daquele cliente.
- Inputs para customizar margem acima (%) e margem abaixo (%).
- Seletor de janela histórica (2, 3, 4 ou 6 meses).
- Botão **"Recalcular Média"** para recalcular sob demanda os dados daquele cliente.

---

## 7. Controle de Acesso (Catálogo de Permissões)

Item registrado na coleção `profile_permissions` e no catálogo oficial:

- **Módulo**: `settings` (Configurações)
- **Item**: `settings_consumption_agent`
- **Nome**: `Agente de Consumo Médio (Qualidade & Gestão)`
- **Versão de Liberação**: v0.0.321 / v0.0.322
- **Níveis**:
  - `view`: visualiza os diagnósticos e médias aprendidas.
  - `edit`: altera margens e ativa/desativa monitoramento por cliente.
  - `configure`: executa reavaliações manuais e disparo forçado de alertas.
