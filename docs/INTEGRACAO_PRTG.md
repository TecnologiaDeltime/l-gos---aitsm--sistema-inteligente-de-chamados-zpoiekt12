# Integração com Ferramenta de Monitoramento PRTG Network Monitor

A integração nativa do **Lógos AITILSM** com o **PRTG Network Monitor** permite a abertura automática de chamados de incidentes mediante alertas de indisponibilidade (_DOWN/Error_), enriquecimento de chamados existentes via deduplicação inteligente e resolução automática quando os sensores normalizam (_UP/OK_).

---

## 1. Visão Geral da Arquitetura

```
+---------------------------+       HTTP POST / GET com Token
|    PRTG Network Monitor   | -------------------------------------> [ Endpoint Webhook ]
| (Notification Action HTTP)|                                              |
+---------------------------+                                              v
                                                               [ Validação de Token ]
                                                                           |
                         +-------------------------------------------------+
                         |
                         v
      +-------------------------------------+
      | Alerta DOWN / Error?                |
      +-------------------------------------+
        |                                 |
        | Já existe chamado aberto?       | Não
        | (Janela de Deduplicação, ex 4h) |
        |                                 v
        | Sim                +---------------------------------------+
        v                    | Cria Novo Chamado:                    |
+----------------------+     | - Origem: "Monitoramento (PRTG)"      |
| Adiciona Interação   |     | - Fila e Atividade configuradas       |
| no Chamado Aberto    |     | - Cliente por Regra de Mapeamento     |
| ("Alerta novamente") |     | - Distribuição Automática (Agente)    |
+----------------------+     | - Notificação in-app + E-mail Crítico |
                             +---------------------------------------+

                         +
                         |
                         v
      +-------------------------------------+
      | Alerta UP / Recuperação?            |
      +-------------------------------------+
        |
        v
+-------------------------------------------+
| Localiza o chamado aberto pelo sensor     |
| Registra Interação: "Sensor recuperado"   |
| Marca chamado como "Resolvido" (Auto)     |
+-------------------------------------------+
```

---

## 2. Configurando o PRTG Network Monitor

Para que o PRTG notifique o Lógos AITILSM, crie uma **Notificação HTTP** no PRTG:

### Passo a passo no PRTG:

1. No menu do PRTG, acesse **Setup** → **Account Settings** → **Notification Templates** (ou Gerenciamento de Notificações).
2. Clique em **Add Notification Template** (Adicionar Notificação).
3. Habilite a opção **Execute HTTP Action** (Executar Ação HTTP).
4. Configure a URL com o token fornecido em **Configurações → Monitoramento (PRTG)** no Lógos AITILSM:
   ```
   https://seu-dominio.goskip.app/backend/v1/webhooks/prtg?token=SEU_TOKEN_AQUI
   ```
5. Defina o método como **POST** (ou GET).
6. No corpo da requisição (_Payload / Postdata_), selecione formato **JSON** (`application/json`) e utilize os placeholders oficiais do PRTG:
   ```json
   {
     "sensor": "%sensor",
     "device": "%device",
     "group": "%group",
     "status": "%status",
     "message": "%message",
     "lastvalue": "%lastvalue",
     "datetime": "%datetime",
     "priority": "%priority",
     "downsince": "%downsince",
     "linksensor": "%linksensor"
   }
   ```
7. Em **Notification Triggers** (Gatilhos de Notificação) dos dispositivos ou sensores desejados:
   - Defina um gatilho para **State Trigger: Down** (quando o sensor cair, disparar a notificação).
   - Defina um gatilho para normalização (quando o sensor voltar para **Up**, disparar a mesma notificação para fechamento automático).

---

## 3. Parâmetros e Funcionalidades no Lógos AITILSM

Acesse no menu **Configurações** → aba **Monitoramento (PRTG)** (ou rota `/settings?tab=prtg`):

1. **Ativação Geral**: Permite habilitar ou desativar o recebimento de alertas a qualquer momento.
2. **Token de Segurança**: Token secreto verificado na URL (`?token=...`). Requisições sem token válido retornam imediatamente HTTP 401.
3. **Fila e Atividade Padrão**: Define para qual fila da equipe de suporte o chamado será enviado e qual a atividade associada no catálogo ITSM.
4. **Prioridade do Chamado**: Permite selecionar Baixa, Média, Alta ou Crítica (padrão sugerido: _Média_, evitando fluxos acidentais de aprovação caso a classificação assim exija).
5. **Anti-Duplicidade (Deduplicação Inteligente)**:
   - Janela configurável em horas (padrão 4 horas).
   - Se o mesmo sensor enviar múltiplos alertas enquanto houver chamado aberto dentro da janela, o sistema **não duplica** o chamado, mas registra uma nova interação com carimbo de data/hora e o novo valor de medição.
6. **Auto-Resolução ao Recuperar (UP)**:
   - Quando o PRTG notifica que o status é _up_, _ok_ ou _recovered_, o sistema busca o chamado aberto referente àquele sensor, insere a interação de recuperação e altera o status para **Resolvido**.
7. **Regras de Mapeamento de Clientes**:
   - Mapeia termos contidos no nome do dispositivo ou sensor para empresas/clientes cadastrados no sistema (ex: qualquer dispositivo contendo `CLI-ALPHA` direciona o chamado para o cliente Alpha Corp).
   - Suporta fila e atividade específicas por regra de mapeamento.
   - Possui fallback para Cliente Padrão configurável.
8. **Simulador / Envio de Alerta de Teste**:
   - Permite testar diretamente da tela a criação de chamado ou a recuperação sem necessidade de disparar testes manuais no PRTG.

---

## 4. Permissões de Acesso (Matriz de Perfis)

A funcionalidade é controlada pelo item de permissão com 3 níveis:

- **Chave**: `settings_prtg_monitoring`
- **Níveis**:
  - `none`: Aba e opções ficam invisíveis, acesso bloqueado.
  - `view`: Permite visualizar status, URL do webhook e regras existentes.
  - `configure`: Permite alterar token, regras de mapeamento, fila, prioridade, salvar alterações e disparar testes.
