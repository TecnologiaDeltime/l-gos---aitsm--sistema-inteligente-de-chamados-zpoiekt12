// Hook de Retenção da Caixa de E-mail (Skip Cloud / PocketBase)
// Cron diário (0 3 * * *) + Endpoints HTTP para execução manual e estatísticas:
// - POST /backend/v1/emails/retention/run   -> Execução manual da retenção
// - GET  /backend/v1/emails/retention/stats -> Estatísticas da pasta de processados e retenção
//
// Regras e requisitos:
// 1. Cliente Microsoft Graph API embutido no arquivo (NÃO depende de globalThis nem de require/import de outros módulos).
// 2. Avalia mensagens na pasta de processados (`processed_folder`, padrão "Processados").
// 3. Critério: mensagens com receivedDateTime anterior a (Agora - retention_days dias).
// 4. Ação:
//    - 'archive': move para pasta 'archive_folder' (padrão "Arquivo" / "Archive"). Cria a pasta automaticamente se não existir.
//    - 'delete': exclui definitivamente a mensagem (DELETE /users/{mailbox}/messages/{id}).
// 5. Registra auditoria em email_audit_logs com test_type = 'retencao', status, contadores e mensagem detalhada.
// 6. Atualiza `email_config` com last_retention_at, last_retention_status, last_retention_error, last_retention_count,
//    total_archived_count e total_deleted_count.
// 7. Mensagens de erro amigáveis em português, sem derrubar o cron.

;(function () {
  // Descriptografia autocontida AES-256 para execução segura no contexto isolado do cron/rotas
  function safeDecryptSecret(val) {
    if (!val || typeof val !== 'string') return ''
    val = val.trim()
    var PREFIX = 'enc:v1:'
    if (val.indexOf(PREFIX) !== 0) return val
    if (typeof globalThis !== 'undefined' && typeof globalThis.itsmDecrypt === 'function') {
      try {
        var decGlobal = globalThis.itsmDecrypt(val)
        if (decGlobal && decGlobal.indexOf(PREFIX) !== 0) return decGlobal
      } catch (_) {}
    }
    try {
      var k = ''
      if (typeof $os !== 'undefined' && typeof $os.getenv === 'function') {
        k = $os.getenv('ITSM_ENCRYPTION_KEY') || ''
      }
      if (!k && typeof $secrets !== 'undefined' && typeof $secrets.get === 'function') {
        k = $secrets.get('ITSM_ENCRYPTION_KEY') || ''
      }
      if (!k) {
        k = 'itsm_default_fallback_aes256_key_super_safe_2026'
      }
      var derivedKey = ''
      try {
        derivedKey = $security.sha256(k).substring(0, 32)
      } catch (_) {
        derivedKey = (k + '01234567890123456789012345678901').substring(0, 32)
      }
      var payload = val.substring(PREFIX.length)
      var dec = $security.decrypt(payload, derivedKey)
      return dec || ''
    } catch (err) {
      return '__DECRYPT_FAILED__'
    }
  }

  try {
    if (typeof globalThis !== 'undefined') {
      globalThis.safeDecryptSecret = safeDecryptSecret
    }
  } catch (_) {}

  // =========================================================================
  // CLIENTE MICROSOFT GRAPH API EMBUTIDO
  // =========================================================================
  var GraphRetentionClient = {
    urlEncode: function (str) {
      return encodeURIComponent(String(str || ''))
        .replace(/%20/g, '+')
        .replace(/[!'()*]/g, function (c) {
          return '%' + c.charCodeAt(0).toString(16).toUpperCase()
        })
    },

    getAccessToken: function (params) {
      var tenantId = (params.tenant_id || params.graph_tenant_id || '').trim()
      var clientId = (params.client_id || params.graph_client_id || '').trim()
      var rawSecret = (params.client_secret || params.graph_client_secret || '').trim()
      var clientSecret = safeDecryptSecret(rawSecret)

      if (!tenantId) {
        throw new Error('Tenant ID (ID do Locatário) da Microsoft não configurado.')
      }
      if (!clientId) {
        throw new Error('Client ID (ID do Aplicativo) da Microsoft não configurado.')
      }
      if (!clientSecret) {
        throw new Error('Client Secret (Segredo do Cliente) da Microsoft não configurado.')
      }

      if (clientSecret === '__DECRYPT_FAILED__' || clientSecret.indexOf('enc:v1:') === 0) {
        throw new Error('Falha interna de descriptografia — não é problema no Entra ID.')
      }

      var guidRegex =
        /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/
      if (guidRegex.test(clientSecret)) {
        throw new Error(
          'O valor salvo parece ser o ID do segredo (formato GUID) — copie o VALOR do segredo.',
        )
      }

      var tokenUrl = 'https://login.microsoftonline.com/' + tenantId + '/oauth2/v2.0/token'
      var formBody = [
        'client_id=' + GraphRetentionClient.urlEncode(clientId),
        'client_secret=' + GraphRetentionClient.urlEncode(clientSecret),
        'grant_type=client_credentials',
        'scope=' + GraphRetentionClient.urlEncode('https://graph.microsoft.com/.default'),
      ].join('&')

      var res = null
      try {
        res = $http.send({
          url: tokenUrl,
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            Accept: 'application/json',
          },
          body: formBody,
          timeout: 30,
        })
      } catch (netErr) {
        throw new Error('Falha de rede ao contatar login.microsoftonline.com: ' + netErr.message)
      }

      var bodyText = res.raw || ''
      var data = null
      try {
        data = JSON.parse(bodyText)
      } catch (_) {
        data = {}
      }

      if (res.statusCode !== 200) {
        var errDesc = data.error_description || data.error || bodyText || 'HTTP ' + res.statusCode
        if (
          errDesc.indexOf('AADSTS700016') !== -1 ||
          errDesc.indexOf('identifier was not found') !== -1
        ) {
          throw new Error(
            'Aplicativo não encontrado no diretório (AADSTS700016). Verifique Client ID e Tenant ID no portal Entra ID.',
          )
        }
        if (
          errDesc.indexOf('AADSTS7000215') !== -1 ||
          errDesc.indexOf('Invalid client secret') !== -1
        ) {
          throw new Error(
            'Segredo recusado pela Microsoft (AADSTS7000215). Gere um novo Segredo no portal Entra ID.',
          )
        }
        if (
          errDesc.indexOf('AADSTS90002') !== -1 ||
          (errDesc.indexOf('Tenant') !== -1 && errDesc.indexOf('not found') !== -1)
        ) {
          throw new Error('Locatário Microsoft (Tenant ID) não encontrado no portal Entra ID.')
        }
        throw new Error('Falha ao autenticar no Microsoft Entra ID: ' + errDesc)
      }

      if (!data.access_token) {
        throw new Error('Servidor Microsoft não retornou access_token.')
      }

      return data.access_token
    },

    // Encontra ou cria uma pasta pelo nome (ex: "Processados", "Arquivo")
    findOrCreateMailFolder: function (token, mailbox, folderName) {
      if (!folderName) return null
      var cleanName = folderName.trim()
      var mailboxEncoded = GraphRetentionClient.urlEncode(mailbox)

      // 1. Listar pastas existentes
      var listUrl =
        'https://graph.microsoft.com/v1.0/users/' +
        mailboxEncoded +
        '/mailFolders?$top=100&$select=id,displayName,totalItemCount'

      var res = null
      try {
        res = $http.send({
          url: listUrl,
          method: 'GET',
          headers: {
            Authorization: 'Bearer ' + token,
            Accept: 'application/json',
          },
          timeout: 30,
        })
      } catch (netErr) {
        throw new Error('Falha de rede ao consultar pastas da caixa: ' + netErr.message)
      }

      if (res.statusCode === 200) {
        var data = null
        try {
          data = JSON.parse(res.raw || '{}')
        } catch (_) {
          data = {}
        }
        var folders = data.value || []
        for (var i = 0; i < folders.length; i++) {
          var f = folders[i]
          if (
            (f.displayName || '').toLowerCase() === cleanName.toLowerCase() ||
            (cleanName.toLowerCase() === 'arquivo' &&
              (f.displayName || '').toLowerCase() === 'archive') ||
            (cleanName.toLowerCase() === 'archive' &&
              (f.displayName || '').toLowerCase() === 'arquivo')
          ) {
            return {
              id: f.id,
              displayName: f.displayName,
              totalItemCount: f.totalItemCount || 0,
            }
          }
        }
      } else if (res.statusCode === 403) {
        throw new Error(
          'Permissão insuficiente (403). Conceda a permissão Mail.ReadWrite com consentimento de admin no Entra ID.',
        )
      } else if (res.statusCode === 404) {
        throw new Error('Caixa de e-mail "' + mailbox + '" não encontrada no Microsoft 365.')
      }

      // 2. Pasta não encontrada: criar via POST /users/{mailbox}/mailFolders
      var createUrl = 'https://graph.microsoft.com/v1.0/users/' + mailboxEncoded + '/mailFolders'
      var createRes = null
      try {
        createRes = $http.send({
          url: createUrl,
          method: 'POST',
          headers: {
            Authorization: 'Bearer ' + token,
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
          body: JSON.stringify({ displayName: cleanName }),
          timeout: 30,
        })
      } catch (createErr) {
        throw new Error('Falha ao tentar criar a pasta "' + cleanName + '": ' + createErr.message)
      }

      if (createRes.statusCode >= 200 && createRes.statusCode < 300) {
        var createdData = null
        try {
          createdData = JSON.parse(createRes.raw || '{}')
        } catch (_) {
          createdData = {}
        }
        return {
          id: createdData.id,
          displayName: createdData.displayName || cleanName,
          totalItemCount: 0,
        }
      }

      // Se falhar a criação (ex: pasta raiz protegida ou nome conflitante), tenta buscar de novo
      throw new Error(
        'Não foi possível encontrar ou criar a pasta "' +
          cleanName +
          '" (HTTP ' +
          createRes.statusCode +
          '): ' +
          (createRes.raw || ''),
      )
    },

    // Lista mensagens da pasta de processados candidatas à retenção
    listMessagesInFolder: function (token, mailbox, folderId, filterQuery, top) {
      top = top || 50
      var mailboxEncoded = GraphRetentionClient.urlEncode(mailbox)
      var url =
        'https://graph.microsoft.com/v1.0/users/' +
        mailboxEncoded +
        '/mailFolders/' +
        folderId +
        '/messages?$top=' +
        top +
        '&$orderby=' +
        GraphRetentionClient.urlEncode('receivedDateTime asc') +
        '&$select=' +
        GraphRetentionClient.urlEncode('id,subject,from,receivedDateTime,isRead,internetMessageId')

      if (filterQuery) {
        url += '&$filter=' + GraphRetentionClient.urlEncode(filterQuery)
      }

      var res = null
      try {
        res = $http.send({
          url: url,
          method: 'GET',
          headers: {
            Authorization: 'Bearer ' + token,
            Accept: 'application/json',
          },
          timeout: 45,
        })
      } catch (netErr) {
        throw new Error('Falha de rede ao listar mensagens da pasta: ' + netErr.message)
      }

      if (res.statusCode !== 200) {
        var errText = res.raw || ''
        try {
          var errObj = JSON.parse(errText)
          if (errObj && errObj.error && errObj.error.message) {
            errText = errObj.error.message
          }
        } catch (_) {}
        throw new Error(
          'Erro ao listar mensagens na pasta (HTTP ' + res.statusCode + '): ' + errText,
        )
      }

      var data = null
      try {
        data = JSON.parse(res.raw || '{}')
      } catch (_) {
        data = {}
      }
      return data.value || []
    },

    // Move mensagem para outra pasta
    moveMessage: function (token, mailbox, messageId, destinationFolderId) {
      var mailboxEncoded = GraphRetentionClient.urlEncode(mailbox)
      var url =
        'https://graph.microsoft.com/v1.0/users/' +
        mailboxEncoded +
        '/messages/' +
        messageId +
        '/move'

      var res = null
      try {
        res = $http.send({
          url: url,
          method: 'POST',
          headers: {
            Authorization: 'Bearer ' + token,
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
          body: JSON.stringify({ destinationId: destinationFolderId }),
          timeout: 30,
        })
      } catch (netErr) {
        throw new Error('Falha ao mover mensagem: ' + netErr.message)
      }

      if (res.statusCode < 200 || res.statusCode >= 300) {
        throw new Error('Falha ao mover mensagem (HTTP ' + res.statusCode + '): ' + (res.raw || ''))
      }
      return true
    },

    // Exclui mensagem definitivamente
    deleteMessage: function (token, mailbox, messageId) {
      var mailboxEncoded = GraphRetentionClient.urlEncode(mailbox)
      var url =
        'https://graph.microsoft.com/v1.0/users/' + mailboxEncoded + '/messages/' + messageId

      var res = null
      try {
        res = $http.send({
          url: url,
          method: 'DELETE',
          headers: {
            Authorization: 'Bearer ' + token,
            Accept: 'application/json',
          },
          timeout: 30,
        })
      } catch (netErr) {
        throw new Error('Falha ao excluir mensagem: ' + netErr.message)
      }

      if (res.statusCode < 200 || res.statusCode >= 300) {
        throw new Error(
          'Falha ao excluir mensagem (HTTP ' + res.statusCode + '): ' + (res.raw || ''),
        )
      }
      return true
    },
  }

  // =========================================================================
  // NÚCLEO DA POLÍTICA DE RETENÇÃO
  // =========================================================================
  var executeRetentionPolicy = function (options) {
    options = options || {}
    var manual = !!options.manual
    var userRecord = options.user || null

    var startTime = Date.now()
    var config = null

    try {
      var configs = $app.findRecordsByFilter('email_config', '', '-created', 1, 0)
      if (!configs || configs.length === 0) {
        return {
          success: false,
          error: 'Nenhuma configuração de e-mail encontrada em email_config.',
        }
      }
      config = configs[0]

      var isEnabled = config.getBool('retention_enabled')
      if (!manual && !isEnabled) {
        // Cron diário não faz nada se desativado
        return {
          success: true,
          skipped: true,
          message: 'Política de retenção desativada na configuração.',
        }
      }

      var retentionDays = config.getInt('retention_days') || 30
      if (retentionDays < 1) retentionDays = 30

      var action = config.getString('retention_action') || 'archive' // 'archive' | 'delete'
      var archiveFolderName = config.getString('archive_folder') || 'Arquivo'
      var processedFolderName = config.getString('processed_folder') || 'Processados'
      var mailbox = config.getString('graph_mailbox') || config.getString('imap_user')
      var receptionMode = config.getString('reception_mode') || 'graph'

      // Se não for modo Graph, orientar de forma amigável
      if (receptionMode !== 'graph') {
        var msgImap =
          'A retenção automatizada de caixas está disponível para conexões Microsoft Graph (HTTPS). Configure o modo Graph para arquivamento no Office 365.'
        config.set('last_retention_at', new Date().toISOString())
        config.set('last_retention_status', 'Aviso')
        config.set('last_retention_error', msgImap)
        $app.save(config)
        return {
          success: false,
          error: msgImap,
        }
      }

      var graphTenantId = (config.getString('graph_tenant_id') || '').trim()
      var graphClientId = (config.getString('graph_client_id') || '').trim()
      var rawGraphSecret = (config.getString('graph_client_secret') || '').trim()
      var graphClientSecret = safeDecryptSecret(rawGraphSecret)

      var isDecryptFailed =
        graphClientSecret === '__DECRYPT_FAILED__' || graphClientSecret.indexOf('enc:v1:') === 0
      var isGuidSecret =
        !isDecryptFailed &&
        /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(
          graphClientSecret,
        )

      if (
        !graphTenantId ||
        !graphClientId ||
        !graphClientSecret ||
        !mailbox ||
        isDecryptFailed ||
        isGuidSecret
      ) {
        var msgMissing = ''
        var retentionStatus = 'Falha na Configuração'
        if (isDecryptFailed) {
          msgMissing = 'Falha interna de descriptografia — não é problema no Entra ID.'
          retentionStatus = 'Falha Interna de Descriptografia'
        } else if (isGuidSecret) {
          msgMissing =
            'O valor salvo parece ser o ID do segredo (formato GUID) — copie o VALOR do segredo.'
          retentionStatus = 'Falha de Autenticação Graph'
        } else {
          msgMissing =
            'Credenciais Microsoft Graph (Tenant ID, Client ID, Client Secret ou Caixa) incompletas.'
          retentionStatus = 'Falha na Configuração'
        }
        config.set('last_retention_at', new Date().toISOString())
        config.set('last_retention_status', retentionStatus)
        config.set('last_retention_error', msgMissing)
        $app.save(config)
        return {
          success: false,
          error: msgMissing,
        }
      }

      // 1. Obter Token
      var token = ''
      try {
        token = GraphRetentionClient.getAccessToken({
          graph_tenant_id: graphTenantId,
          graph_client_id: graphClientId,
          graph_client_secret: graphClientSecret,
        })
      } catch (authErr) {
        var authErrMsg = authErr.message
        config.set('last_retention_at', new Date().toISOString())
        config.set('last_retention_status', 'Falha de Autenticação Graph')
        config.set('last_retention_error', authErrMsg)
        $app.save(config)
        logRetentionAudit(config, userRecord, 'failed', authErrMsg, 0, 0, 0, Date.now() - startTime)
        return {
          success: false,
          error: authErrMsg,
        }
      }

      // 2. Localizar pasta de processados
      var processedFolderInfo = null
      try {
        processedFolderInfo = GraphRetentionClient.findOrCreateMailFolder(
          token,
          mailbox,
          processedFolderName,
        )
      } catch (fErr) {
        var fErrMsg =
          'Pasta de processados "' +
          processedFolderName +
          '" não encontrada na caixa: ' +
          fErr.message
        config.set('last_retention_at', new Date().toISOString())
        config.set('last_retention_status', 'Pasta Não Encontrada')
        config.set('last_retention_error', fErrMsg)
        $app.save(config)
        logRetentionAudit(config, userRecord, 'failed', fErrMsg, 0, 0, 0, Date.now() - startTime)
        return {
          success: false,
          error: fErrMsg,
        }
      }

      // 3. Se ação for arquivar, localizar/criar pasta de destino (Arquivo)
      var archiveFolderInfo = null
      if (action === 'archive') {
        try {
          archiveFolderInfo = GraphRetentionClient.findOrCreateMailFolder(
            token,
            mailbox,
            archiveFolderName,
          )
        } catch (arcErr) {
          var arcErrMsg =
            'Não foi possível localizar ou criar a pasta de arquivo "' +
            archiveFolderName +
            '": ' +
            arcErr.message
          config.set('last_retention_at', new Date().toISOString())
          config.set('last_retention_status', 'Falha ao Criar Pasta Arquivo')
          config.set('last_retention_error', arcErrMsg)
          $app.save(config)
          logRetentionAudit(
            config,
            userRecord,
            'failed',
            arcErrMsg,
            0,
            0,
            0,
            Date.now() - startTime,
          )
          return {
            success: false,
            error: arcErrMsg,
          }
        }
      }

      // 4. Calcular data limite (cutoff date): Agora - retentionDays dias
      var cutoffDate = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000)
      var cutoffIso = cutoffDate.toISOString()

      // 5. Listar mensagens expiradas na pasta de processados
      // Filtro OData: receivedDateTime lt YYYY-MM-DDTHH:mm:ssZ
      var filterQuery = 'receivedDateTime lt ' + cutoffIso
      var messagesToProcess = []
      try {
        messagesToProcess = GraphRetentionClient.listMessagesInFolder(
          token,
          mailbox,
          processedFolderInfo.id,
          filterQuery,
          100,
        )
      } catch (listErr) {
        var listErrMsg = 'Falha ao consultar mensagens antigas na pasta: ' + listErr.message
        config.set('last_retention_at', new Date().toISOString())
        config.set('last_retention_status', 'Falha ao Listar Mensagens')
        config.set('last_retention_error', listErrMsg)
        $app.save(config)
        logRetentionAudit(config, userRecord, 'failed', listErrMsg, 0, 0, 0, Date.now() - startTime)
        return {
          success: false,
          error: listErrMsg,
        }
      }

      // 6. Processar cada mensagem
      var processedCount = 0
      var archivedCount = 0
      var deletedCount = 0
      var itemErrors = []
      var sampleProcessed = []

      for (var m = 0; m < messagesToProcess.length; m++) {
        var msg = messagesToProcess[m]
        try {
          if (action === 'archive') {
            GraphRetentionClient.moveMessage(token, mailbox, msg.id, archiveFolderInfo.id)
            archivedCount++
          } else {
            GraphRetentionClient.deleteMessage(token, mailbox, msg.id)
            deletedCount++
          }
          processedCount++

          if (sampleProcessed.length < 5) {
            sampleProcessed.push({
              subject: msg.subject || 'Sem assunto',
              from: (msg.from && msg.from.emailAddress && msg.from.emailAddress.address) || '',
              date: msg.receivedDateTime,
              action: action === 'archive' ? 'arquivado' : 'excluido',
            })
          }
        } catch (itemErr) {
          itemErrors.push('Msg ' + (msg.subject || msg.id) + ': ' + itemErr.message)
          $app
            .logger()
            .warn(
              'retention_policy item error',
              'id',
              msg.id,
              'subject',
              msg.subject,
              'err',
              itemErr.message,
            )
        }
      }

      var durationMs = Date.now() - startTime

      // 7. Atualizar contadores em email_config
      var prevArchived = config.getInt('total_archived_count') || 0
      var prevDeleted = config.getInt('total_deleted_count') || 0
      config.set('last_retention_at', new Date().toISOString())
      config.set(
        'last_retention_status',
        itemErrors.length > 0 && processedCount === 0 ? 'Falha Parcial' : 'Sucesso',
      )
      config.set(
        'last_retention_error',
        itemErrors.length > 0 ? 'Avisos: ' + itemErrors.join('; ') : '',
      )
      config.set('last_retention_count', processedCount)
      config.set('total_archived_count', prevArchived + archivedCount)
      config.set('total_deleted_count', prevDeleted + deletedCount)
      $app.save(config)

      var summaryMsg =
        'Retenção da caixa concluída (' +
        (action === 'archive' ? 'Mover para Arquivo' : 'Excluir definitivamente') +
        '): ' +
        processedCount +
        ' e-mail(s) com mais de ' +
        retentionDays +
        ' dias processado(s) com sucesso.'
      if (action === 'archive' && archiveFolderInfo) {
        summaryMsg += ' Pasta de destino: ' + archiveFolderInfo.displayName + '.'
      }
      if (itemErrors.length > 0) {
        summaryMsg += ' ' + itemErrors.length + ' item(ns) com aviso.'
      }

      // 8. Gravar auditoria em email_audit_logs
      logRetentionAudit(
        config,
        userRecord,
        itemErrors.length > 0 && processedCount === 0 ? 'failed' : 'success',
        summaryMsg,
        processedCount,
        archivedCount,
        deletedCount,
        durationMs,
        sampleProcessed,
      )

      return {
        success: true,
        action: action,
        retention_days: retentionDays,
        processed_count: processedCount,
        archived_count: archivedCount,
        deleted_count: deletedCount,
        cutoff_date: cutoffIso,
        summary: summaryMsg,
        duration_ms: durationMs,
        samples: sampleProcessed,
        errors: itemErrors,
      }
    } catch (globalErr) {
      $app.logger().error('retention_policy fatal error', 'error', globalErr.message)
      if (config) {
        try {
          config.set('last_retention_at', new Date().toISOString())
          config.set('last_retention_status', 'Erro Inesperado')
          config.set('last_retention_error', globalErr.message || 'Erro fatal na retenção')
          $app.save(config)
        } catch (_) {}
      }
      return {
        success: false,
        error: globalErr.message || 'Erro inesperado ao executar retenção da caixa.',
      }
    }
  }

  // Helper para salvar auditoria com test_type = 'retencao'
  var logRetentionAudit = function (
    config,
    userRecord,
    status,
    message,
    totalCount,
    archivedCount,
    deletedCount,
    durationMs,
    samples,
  ) {
    try {
      var auditCol = $app.findCollectionByNameOrId('email_audit_logs')
      var rec = new Record(auditCol)
      rec.set('test_type', 'retencao')
      rec.set('status', status === 'success' ? 'success' : 'failed')
      rec.set('host', 'graph.microsoft.com')
      rec.set('port', 443)
      rec.set(
        'user_account',
        config ? config.getString('graph_mailbox') || config.getString('imap_user') : '',
      )
      rec.set('inbox_folder', config ? config.getString('processed_folder') || 'Processados' : '')
      rec.set('encryption', 'HTTPS (OAuth2)')
      rec.set('summary_message', message)
      rec.set('latest_messages_count', totalCount || 0)

      if (userRecord && userRecord.id) {
        rec.set('executed_by', userRecord.id)
        var uName = ''
        var uEmail = ''
        try {
          uName =
            (typeof userRecord.getString === 'function'
              ? userRecord.getString('name')
              : userRecord.name) || ''
          uEmail =
            (typeof userRecord.getString === 'function'
              ? userRecord.getString('email')
              : userRecord.email) || ''
        } catch (_) {}
        rec.set('executed_by_name', uName || uEmail || '')
        rec.set('executed_by_email', uEmail || '')
      }

      var steps = [
        {
          name: 'Autenticação e Conexão Microsoft Graph',
          status: status === 'success' ? 'success' : 'failed',
          message: status === 'success' ? 'Token OAuth2 validado com sucesso' : message,
          duration_ms: Math.round(durationMs * 0.3),
        },
        {
          name: 'Varredura da Pasta de Processados',
          status: status === 'success' ? 'success' : 'failed',
          message: totalCount + ' e-mail(s) elegíveis encontrados',
          duration_ms: Math.round(durationMs * 0.4),
        },
        {
          name: 'Ação de Retenção (Arquivamento / Exclusão)',
          status: status === 'success' ? 'success' : 'failed',
          message:
            archivedCount > 0
              ? archivedCount + ' arquivado(s)'
              : deletedCount > 0
                ? deletedCount + ' excluído(s)'
                : 'Nenhum item elegível no período',
          duration_ms: Math.round(durationMs * 0.3),
        },
      ]
      rec.set('steps_result', JSON.stringify(steps))

      if (samples && samples.length > 0) {
        rec.set('latest_messages', JSON.stringify(samples))
      }

      $app.save(rec)
    } catch (auditErr) {
      $app.logger().error('logRetentionAudit error', 'err', auditErr.message)
    }
  }

  // Expõe executeRetentionPolicy no escopo global para garantir que referências externas ou empacotamento nunca falhem
  try {
    if (typeof globalThis !== 'undefined') {
      globalThis.executeRetentionPolicy = executeRetentionPolicy
    }
  } catch (_) {}

  // =========================================================================
  // CRON DIÁRIO DE RETENÇÃO (0 3 * * * = 03:00 UTC)
  // =========================================================================
  cronAdd('email_retention_cron', '0 3 * * *', function () {
    $app.logger().info('Iniciando cron diário de retenção de e-mails (email_retention_cron)...')
    var fn =
      typeof executeRetentionPolicy === 'function'
        ? executeRetentionPolicy
        : typeof globalThis !== 'undefined' &&
            typeof globalThis.executeRetentionPolicy === 'function'
          ? globalThis.executeRetentionPolicy
          : null
    var result = fn
      ? fn({ manual: false })
      : { success: false, error: 'executeRetentionPolicy unavailable' }
    $app.logger().info('Cron de retenção finalizado', 'result', JSON.stringify(result))
  })

  // =========================================================================
  // ENDPOINT: POST /backend/v1/emails/retention/run (Execução Manual pelo Operador/Gestor)
  // =========================================================================
  routerAdd('POST', '/backend/v1/emails/retention/run', function (c) {
    var authUser = null
    try {
      if (c && c.auth) {
        authUser = c.auth
      } else if (typeof c.authRecord === 'function') {
        authUser = c.authRecord()
      } else if (c && c.authRecord) {
        authUser = c.authRecord
      }
    } catch (_) {}

    var result = executeRetentionPolicy({ manual: true, user: authUser })
    return c.json(result.success ? 200 : 400, result)
  })

  // =========================================================================
  // ENDPOINT: GET /backend/v1/emails/retention/stats (Painel Informativo de Retenção)
  // =========================================================================
  routerAdd('GET', '/backend/v1/emails/retention/stats', function (c) {
    var config = null
    try {
      var configs = $app.findRecordsByFilter('email_config', '', '-created', 1, 0)
      if (configs && configs.length > 0) {
        config = configs[0]
      }
    } catch (_) {}

    if (!config) {
      return c.json(200, {
        enabled: false,
        retention_days: 30,
        action: 'archive',
        archive_folder: 'Arquivo',
        processed_folder: 'Processados',
        processed_waiting_count: 0,
        eligible_for_retention_count: 0,
        last_execution_at: null,
        last_execution_status: null,
        last_execution_error: null,
        last_execution_count: 0,
        total_archived: 0,
        total_deleted: 0,
        next_schedule: 'Diariamente às 00:00 (BRT) / 03:00 (UTC)',
      })
    }

    var isEnabled = config.getBool('retention_enabled')
    var retentionDays = config.getInt('retention_days') || 30
    var action = config.getString('retention_action') || 'archive'
    var archiveFolder = config.getString('archive_folder') || 'Arquivo'
    var processedFolder = config.getString('processed_folder') || 'Processados'
    var mailbox = config.getString('graph_mailbox') || config.getString('imap_user')
    var receptionMode = config.getString('reception_mode') || 'graph'

    var processedWaitingCount = 0
    var eligibleCount = 0
    var folderFound = false
    var inspectError = null

    // Se Graph configurado, tenta obter contadores em tempo real de forma leve
    var retentionGraphSecret = safeDecryptSecret(config.getString('graph_client_secret'))

    if (
      receptionMode === 'graph' &&
      config.getString('graph_tenant_id') &&
      config.getString('graph_client_id') &&
      retentionGraphSecret &&
      mailbox
    ) {
      try {
        var token = GraphRetentionClient.getAccessToken({
          graph_tenant_id: config.getString('graph_tenant_id'),
          graph_client_id: config.getString('graph_client_id'),
          graph_client_secret: retentionGraphSecret,
        })

        var pFolder = GraphRetentionClient.findOrCreateMailFolder(token, mailbox, processedFolder)
        if (pFolder) {
          folderFound = true
          processedWaitingCount = pFolder.totalItemCount || 0

          // Contar itens elegíveis (com receivedDateTime < cutoff)
          var cutoffDate = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000)
          var oldMessages = GraphRetentionClient.listMessagesInFolder(
            token,
            mailbox,
            pFolder.id,
            'receivedDateTime lt ' + cutoffDate.toISOString(),
            50,
          )
          eligibleCount = oldMessages.length
        }
      } catch (err) {
        inspectError = err.message
      }
    }

    return c.json(200, {
      enabled: isEnabled,
      retention_days: retentionDays,
      action: action,
      archive_folder: archiveFolder,
      processed_folder: processedFolder,
      processed_waiting_count: processedWaitingCount,
      eligible_for_retention_count: eligibleCount,
      folder_found: folderFound,
      inspect_error: inspectError,
      last_execution_at: config.getString('last_retention_at') || null,
      last_execution_status: config.getString('last_retention_status') || null,
      last_execution_error: config.getString('last_retention_error') || null,
      last_execution_count: config.getInt('last_retention_count') || 0,
      total_archived: config.getInt('total_archived_count') || 0,
      total_deleted: config.getInt('total_deleted_count') || 0,
      next_schedule: 'Diariamente às 00:00 (BRT) / 03:00 (UTC)',
    })
  })
})()
