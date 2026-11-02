# Ponto de Restauração e Procedimento de Rollback — Lógos AITILSM

Este documento registra oficialmente o **Ponto de Restauração (Restore Point)** do Lógos AITILSM, estabelecido a partir da versão **0.0.291** (homologada, entregue e com QA 100% limpo), além de descrever os procedimentos de recuperação (rollback), limitações técnicas e governança para novos pontos de restauração.

---

## 1. Identificação do Ponto de Restauração

- **Identificador de Referência:** `restore-point-0.0.291`
- **Versão Base Homologada:** `0.0.291` (registrada no commit subsequente `0.0.292`)
- **Data de Registro:** Março de 2025
- **Estado do Sistema neste Ponto:**
  - Sistema ITSM completo e operacional:
    - Central de Atendimento Omnichannel e Fila de Chamados.
    - Gestão de Perfis de Acesso com Matriz Granular e Landing Route personalizada por perfil.
    - Correção e validação completa das rotas e navegação (incluindo rota `/profiles` e permissões de acesso).
    - Portal do Cliente completo com 6 módulos (Dashboard Analítico, Chamados, Abertura, Aprovações, Ativos CMDB, Visitas Técnicas, Saldo de Horas e Relatórios Mensais com liberação).
    - Módulos ITIL: Incidentes, Requisições, Problemas (Erros Conhecidos), Mudanças (GMUD / CAB), Ativos (CMDB), Cofre de Senhas (Vault), Visitas Técnicas N2 com despesas e reembolsos.
    - Painel Executivo, Painel do Operador e Dashboards de SLA e Contratos.
    - Temas oficiais ativos: Escuro Amber Alert e Claro Marrom & Branco.
  - **Estado do Banco de Dados PocketBase:**
    - Migrações aplicadas no Skip Cloud até a migração **`0116_asset_automation_logs.js`** (116 migrações ativas e integradas).
  - **Status de Qualidade:**
    - Testes estáticos (oxlint), verificação de tipos (TypeScript tsc) e build Vite 100% aprovados sem erros nem advertências.

---

## 2. Como Realizar o Rollback do Código para este Ponto

O projeto é hospedado e versionado na plataforma Skip, com histórico de versões sequenciais (ex: 0.0.291, 0.0.292). Não há repositório GitHub remoto externo conectado.

### 2.1 Reversão pelo Histórico de Versões da Plataforma Skip (Recomendado)

1. Na interface do projeto no painel Skip Cloud / Histórico de Versões (Versions / Deployments):
   - Localize a versão marcada como **`0.0.291`** (ou a versão de restore point documentada).
   - Selecione a opção **"Rollback to this version"** / **"Restaurar esta versão"**.
   - O ambiente de Preview e a branch ativa de compilação serão imediatamente revertidos para o snapshot do código-fonte exato daquela versão.

### 2.2 Reversão Manual via Git (Ambiente Local ou Repositório Clonado)

Caso esteja trabalhando diretamente em um clone git local do projeto:

- **Para inspecionar o estado do ponto de restauração sem alterar o histórico atual:**

  ```bash
  git checkout restore-point-0.0.291
  # ou navegando pelo commit registrado na entrega da versão 0.0.291
  ```

- **Para criar uma nova branch a partir deste ponto:**

  ```bash
  git checkout -b recuperacao-v291 restore-point-0.0.291
  ```

- **Para desfazer commits defeituosos preservando o histórico (Revert seguro):**

  ```bash
  git revert HEAD~..restore-point-0.0.291
  ```

- **Para forçar o branch principal ao estado exato do ponto de restauração (Reset):**
  ```bash
  git reset --hard restore-point-0.0.291
  ```

### 2.3 Comportamento do Preview da Plataforma após o Rollback

- Ao realizar o rollback do código, a plataforma recompila o frontend React + Vite e atualiza o servidor de preview instantaneamente.
- Quaisquer telas, componentes, scripts ou rotas criados após a v0.0.291 deixarão de ser servidos, retornando ao estado estável homologado.

---

## 3. Limitação Importante e Honesta: Código vs. Banco de Dados

> ⚠️ **ATENÇÃO:** O procedimento de Rollback restaura **EXCLUSIVAMENTE o código-fonte da aplicação** (frontend React, páginas, componentes, estilos, bibliotecas e hooks).

### O que o Rollback restaura:

- Todo o código TypeScript/React (`src/**`).
- Dependências e configurações de build (`package.json`, Tailwind, Vite).
- Regras de frontend, componentes visuais e lógica de navegação.
- Arquivos de migração locais na pasta `pocketbase/migrations/`.

### O que o Rollback NÃO desfaz:

1. **Dados transacionais existentes no banco PocketBase:**
   - Chamados abertos, mensagens de atendimento, logs de horas, interações, itens de configuração (CMDB), visitas técnicas, usuários e senhas criados após o ponto de restauração **permanecem intactos**.
2. **Migrações de banco já executadas:**
   - As migrações executadas na instância PocketBase Skip Cloud (até a 0116) continuam aplicadas no banco.
   - Caso novas migrações tenham sido aplicadas após a 0116, elas **não são revertidas automaticamente por um rollback de código**, pois o banco PocketBase executa migrações de forma cumulativa. Para reverter alterações estruturais no banco seria necessária uma migração corretiva compensatória (`down` / corretiva).

---

## 4. Como Criar Novos Pontos de Restauração no Futuro

Para criar um novo ponto de restauração em qualquer momento após a conclusão de uma nova funcionalidade ou marco do projeto:

1. Solicite diretamente ao assistente no chat:
   > _"Crie a partir daqui um novo ponto de restauração para rollback"_
2. O assistente irá:
   - Validar que o sistema está estável e compila sem falhas (QA limpo).
   - Registrar no documento `docs/RESTAURACAO.md` a nova versão de referência, a data, a lista de migrações ativas e as novidades incluídas.
   - Atualizar a versão e commitar o novo marco com mensagem identificável na timeline do projeto.
