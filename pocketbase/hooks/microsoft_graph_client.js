// Cliente Microsoft Graph API (HTTPS via $http.send) para Goja JSVM no PocketBase
// Permite autenticação OAuth2 (Client Credentials) e operações de leitura/marcar como lida de mensagens
// Não depende de sockets TCP (tls/net/bufio), operando 100% via HTTPS.

;(function () {
  var GraphClient = {}

  // Helper para URL form-urlencoded
  GraphClient.urlEncode = function (str) {
    return encodeURIComponent(String(str || ''))
      .replace(/%20/g, '+')
      .replace(/[!'()*]/g, function (c) {
        return '%' + c.charCodeAt(0).toString(16).toUpperCase()
      })
  }

  // Converte HTML em texto simples legível
  GraphClient.htmlToText = function (html) {
    if (!html) return ''
    return String(html)
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<br\s*[\/]?>/gi, '\n')
      .replace(/<\/p>/gi, '\n\n')
      .replace(/<\/div>/gi, '\n')
      .replace(/<li[^>]*>/gi, '• ')
      .replace(/<\/li>/gi, '\n')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/\r\n/g, '\n')
      .replace(/[ \t]+/g, ' ')
      .replace(/\n\s*\n\s*\n+/g, '\n\n')
      .trim()
  }

  // 1. Obter Token OAuth2 Client Credentials
  // POST https://login.microsoftonline.com/{tenant_id}/oauth2/v2.0/token
  GraphClient.getAccessToken = function (params) {
    var tenantId = (params.tenant_id || params.graph_tenant_id || '').trim()
    var clientId = (params.client_id || params.graph_client_id || '').trim()
    var clientSecret = (params.client_secret || params.graph_client_secret || '').trim()

    if (!tenantId) {
      throw new Error('Tenant ID (ID do Locatário) da Microsoft não configurado.')
    }
    if (!clientId) {
      throw new Error('Client ID (ID do Aplicativo) da Microsoft não configurado.')
    }
    if (!clientSecret) {
      throw new Error('Client Secret (Segredo do Cliente) da Microsoft não configurado.')
    }

    var tokenUrl = 'https://login.microsoftonline.com/' + tenantId + '/oauth2/v2.0/token'
    var formBody = [
      'client_id=' + GraphClient.urlEncode(clientId),
      'client_secret=' + GraphClient.urlEncode(clientSecret),
      'grant_type=client_credentials',
      'scope=' + GraphClient.urlEncode('https://graph.microsoft.com/.default'),
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
          'Aplicativo não encontrado no diretório (AADSTS700016). Verifique se o Client ID (' +
            clientId +
            ') e o Tenant ID (' +
            tenantId +
            ') estão corretos no portal Microsoft Entra ID.',
        )
      }
      if (
        errDesc.indexOf('AADSTS7000215') !== -1 ||
        errDesc.indexOf('Invalid client secret') !== -1
      ) {
        throw new Error(
          'Segredo do Cliente inválido ou expirado (AADSTS7000215). Gere um novo Segredo do Cliente em Registros de Aplicativo > Certificados e Segredos no Entra ID.',
        )
      }
      if (
        errDesc.indexOf('AADSTS90002') !== -1 ||
        (errDesc.indexOf('Tenant') !== -1 && errDesc.indexOf('not found') !== -1)
      ) {
        throw new Error(
          'Locatário Microsoft (Tenant ID) não encontrado. Verifique se o Tenant ID (' +
            tenantId +
            ') está correto no portal Entra ID.',
        )
      }
      throw new Error('Falha ao obter token OAuth2 do Microsoft Entra ID: ' + errDesc)
    }

    if (!data.access_token) {
      throw new Error('Servidor Microsoft não retornou access_token.')
    }

    return {
      accessToken: data.access_token,
      expiresIn: data.expires_in || 3600,
      tokenType: data.token_type || 'Bearer',
    }
  }

  // 2. Testar acesso à caixa de e-mail (Mail.Read / Mail.ReadWrite)
  // GET https://graph.microsoft.com/v1.0/users/{mailbox}
  GraphClient.getMailboxInfo = function (token, mailbox) {
    var mailboxEncoded = GraphClient.urlEncode(mailbox)
    var url = 'https://graph.microsoft.com/v1.0/users/' + mailboxEncoded

    var res = null
    try {
      res = $http.send({
        url: url,
        method: 'GET',
        headers: {
          Authorization: 'Bearer ' + token,
          Accept: 'application/json',
        },
        timeout: 30,
      })
    } catch (netErr) {
      throw new Error('Falha de rede ao acessar Graph API: ' + netErr.message)
    }

    var bodyText = res.raw || ''
    var data = null
    try {
      data = JSON.parse(bodyText)
    } catch (_) {
      data = {}
    }

    if (res.statusCode !== 200) {
      var err = data.error || {}
      var code = err.code || ''
      var msg = err.message || bodyText

      if (
        res.statusCode === 404 ||
        code === 'ResourceNotFound' ||
        code === 'Request_ResourceNotFound'
      ) {
        throw new Error(
          'Caixa de e-mail "' +
            mailbox +
            '" não encontrada no locatário Microsoft. Verifique se o e-mail está correto e ativo no Microsoft 365.',
        )
      }
      if (
        res.statusCode === 403 ||
        code === 'ErrorAccessDenied' ||
        code === 'Authorization_RequestDenied'
      ) {
        throw new Error(
          'Permissão insuficiente no Microsoft Entra ID (403 Acesso Negado). Conceda a permissão de aplicativo "Mail.Read" ou "Mail.ReadWrite" no registro do aplicativo e clique em "Conceder consentimento do administrador".',
        )
      }
      throw new Error(
        'Erro ao verificar caixa "' +
          mailbox +
          '" via Graph API (HTTP ' +
          res.statusCode +
          '): ' +
          msg,
      )
    }

    return {
      id: data.id,
      displayName: data.displayName,
      mail: data.mail || data.userPrincipalName || mailbox,
      userPrincipalName: data.userPrincipalName,
    }
  }

  // 3. Listar mensagens não lidas
  // GET https://graph.microsoft.com/v1.0/users/{mailbox}/messages?$filter=isRead eq false&$top={top}&$orderby=receivedDateTime desc
  GraphClient.listUnreadMessages = function (token, mailbox, top) {
    top = top || 25
    var mailboxEncoded = GraphClient.urlEncode(mailbox)
    var url =
      'https://graph.microsoft.com/v1.0/users/' +
      mailboxEncoded +
      '/messages?$filter=' +
      GraphClient.urlEncode('isRead eq false') +
      '&$top=' +
      top +
      '&$orderby=' +
      GraphClient.urlEncode('receivedDateTime desc') +
      '&$select=' +
      GraphClient.urlEncode(
        'id,conversationId,createdDateTime,receivedDateTime,hasAttachments,internetMessageId,subject,bodyPreview,body,from,toRecipients,ccRecipients,isRead',
      )

    var res = null
    try {
      res = $http.send({
        url: url,
        method: 'GET',
        headers: {
          Authorization: 'Bearer ' + token,
          Accept: 'application/json',
          Prefer: 'outlook.body-content-type="html"',
        },
        timeout: 45,
      })
    } catch (netErr) {
      throw new Error('Falha de rede ao listar mensagens da Graph API: ' + netErr.message)
    }

    var bodyText = res.raw || ''
    var data = null
    try {
      data = JSON.parse(bodyText)
    } catch (_) {
      data = {}
    }

    if (res.statusCode !== 200) {
      var err = data.error || {}
      var code = err.code || ''
      var msg = err.message || bodyText

      if (
        res.statusCode === 403 ||
        code === 'ErrorAccessDenied' ||
        code === 'Authorization_RequestDenied'
      ) {
        throw new Error(
          'Permissão insuficiente para ler mensagens (403). Certifique-se de que a permissão de aplicativo "Mail.Read" ou "Mail.ReadWrite" possui "Consentimento do Administrador Concedido" no Microsoft Entra ID.',
        )
      }
      throw new Error('Erro ao listar mensagens não lidas (HTTP ' + res.statusCode + '): ' + msg)
    }

    return data.value || []
  }

  // 4. Listar mensagens recentes (para diagnóstico e amostras no teste)
  // GET https://graph.microsoft.com/v1.0/users/{mailbox}/messages?$top={top}&$orderby=receivedDateTime desc
  GraphClient.listRecentMessages = function (token, mailbox, top) {
    top = top || 10
    var mailboxEncoded = GraphClient.urlEncode(mailbox)
    var url =
      'https://graph.microsoft.com/v1.0/users/' +
      mailboxEncoded +
      '/messages?$top=' +
      top +
      '&$orderby=' +
      GraphClient.urlEncode('receivedDateTime desc') +
      '&$select=' +
      GraphClient.urlEncode('id,receivedDateTime,internetMessageId,subject,from,isRead')

    var res = null
    try {
      res = $http.send({
        url: url,
        method: 'GET',
        headers: {
          Authorization: 'Bearer ' + token,
          Accept: 'application/json',
        },
        timeout: 30,
      })
    } catch (netErr) {
      throw new Error('Falha de rede ao obter mensagens recentes: ' + netErr.message)
    }

    var bodyText = res.raw || ''
    var data = null
    try {
      data = JSON.parse(bodyText)
    } catch (_) {
      data = {}
    }

    if (res.statusCode !== 200) {
      var err = data.error || {}
      throw new Error(
        'Erro ao listar mensagens recentes (HTTP ' +
          res.statusCode +
          '): ' +
          (err.message || bodyText),
      )
    }

    return data.value || []
  }

  // 5. Obter anexos de uma mensagem
  // GET https://graph.microsoft.com/v1.0/users/{mailbox}/messages/{message_id}/attachments
  GraphClient.getMessageAttachments = function (token, mailbox, messageId) {
    var mailboxEncoded = GraphClient.urlEncode(mailbox)
    var url =
      'https://graph.microsoft.com/v1.0/users/' +
      mailboxEncoded +
      '/messages/' +
      messageId +
      '/attachments'

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
      return []
    }

    if (res.statusCode !== 200) {
      return []
    }

    var bodyText = res.raw || ''
    var data = null
    try {
      data = JSON.parse(bodyText)
    } catch (_) {
      data = {}
    }

    var rawAttachments = data.value || []
    var attachments = []

    for (var i = 0; i < rawAttachments.length; i++) {
      var att = rawAttachments[i]
      // Considerar apenas anexos de arquivo (#microsoft.graph.fileAttachment)
      if (att.contentBytes) {
        attachments.push({
          filename: att.name || 'anexo_' + (i + 1),
          content_type: att.contentType || 'application/octet-stream',
          data_base64: att.contentBytes,
          file_size: att.size || 0,
          is_inline: !!att.isInline,
        })
      }
    }

    return attachments
  }

  // 6. Marcar mensagem como lida
  // PATCH https://graph.microsoft.com/v1.0/users/{mailbox}/messages/{message_id}
  GraphClient.markMessageAsRead = function (token, mailbox, messageId) {
    var mailboxEncoded = GraphClient.urlEncode(mailbox)
    var url = 'https://graph.microsoft.com/v1.0/users/' + mailboxEncoded + '/messages/' + messageId

    var res = null
    try {
      res = $http.send({
        url: url,
        method: 'PATCH',
        headers: {
          Authorization: 'Bearer ' + token,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({ isRead: true }),
        timeout: 20,
      })
      return res.statusCode >= 200 && res.statusCode < 300
    } catch (err) {
      return false
    }
  }

  // 7. Mover mensagem para outra pasta (opcional se configurado)
  // POST https://graph.microsoft.com/v1.0/users/{mailbox}/messages/{message_id}/move
  GraphClient.moveMessage = function (token, mailbox, messageId, destinationFolderId) {
    if (!destinationFolderId) return false
    var mailboxEncoded = GraphClient.urlEncode(mailbox)
    var url =
      'https://graph.microsoft.com/v1.0/users/' +
      mailboxEncoded +
      '/messages/' +
      messageId +
      '/move'

    try {
      var res = $http.send({
        url: url,
        method: 'POST',
        headers: {
          Authorization: 'Bearer ' + token,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({ destinationId: destinationFolderId }),
        timeout: 20,
      })
      return res.statusCode >= 200 && res.statusCode < 300
    } catch (err) {
      return false
    }
  }

  // 8. Normaliza uma mensagem Graph no formato padrão do pipeline de ingestão
  GraphClient.normalizeGraphMessage = function (graphMsg, attachments) {
    var fromObj = graphMsg.from || {}
    var emailAddress = fromObj.emailAddress || {}
    var fromEmail = (emailAddress.address || '').trim()
    var fromName = (emailAddress.name || '').trim()
    var subject = (graphMsg.subject || '').trim()
    var bodyObj = graphMsg.body || {}
    var rawBodyContent = bodyObj.content || graphMsg.bodyPreview || ''

    var cleanBody = ''
    if (bodyObj.contentType === 'html' || rawBodyContent.indexOf('<') !== -1) {
      cleanBody = GraphClient.htmlToText(rawBodyContent)
    } else {
      cleanBody = rawBodyContent
    }

    var messageId =
      (graphMsg.internetMessageId || '').replace(/[<>]/g, '').trim() || 'GRAPH-' + graphMsg.id

    return {
      id: graphMsg.id,
      message_id: messageId,
      from: fromEmail,
      from_name: fromName,
      subject: subject || 'Sem assunto',
      body: cleanBody,
      raw_html: bodyObj.contentType === 'html' ? rawBodyContent : null,
      received_at: graphMsg.receivedDateTime,
      attachments: attachments || [],
    }
  }

  // Expor no globalThis e no module.exports
  globalThis.MicrosoftGraphClient = GraphClient
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = GraphClient
  }
})()
