import pb from '@/lib/pocketbase/client'

export interface EmailAutoReplySettings {
  id?: string
  scope?: 'global'
  receipt_enabled: boolean
  receipt_subject: string
  receipt_body: string
  out_of_office_enabled: boolean
  out_of_office_subject: string
  out_of_office_body: string
  anti_loop_enabled: boolean
  created?: string
  updated?: string
}

export const DEFAULT_RECEIPT_SUBJECT =
  'Recebemos sua solicitação - Chamado #{{numero}}: {{assunto}}'

export const DEFAULT_RECEIPT_BODY =
  'Olá, {{solicitante}}!\n\n' +
  'Confirmamos o recebimento do seu e-mail. Um novo chamado foi registrado em nosso sistema de atendimento com os dados abaixo:\n\n' +
  '• Número do Chamado: #{{numero}}\n' +
  '• Assunto: {{assunto}}\n' +
  '• Solicitante: {{solicitante}}\n' +
  '• Empresa: {{empresa}}\n' +
  '• Data e Hora de Abertura: {{data}}\n\n' +
  'Nossa equipe técnica já foi notificada e dará início ao atendimento conforme a prioridade e os prazos de SLA acordados.\n\n' +
  'Para enviar informações adicionais sobre esta solicitação, basta responder a este e-mail mantendo o número #{{numero}} no assunto.\n\n' +
  'Atenciosamente,\n' +
  'Equipe de Suporte e Atendimento'

export const DEFAULT_OUT_OF_OFFICE_SUBJECT =
  'Recebemos seu e-mail [Fora do Expediente] - Chamado #{{numero}}'

export const DEFAULT_OUT_OF_OFFICE_BODY =
  'Olá, {{solicitante}}!\n\n' +
  'Recebemos seu e-mail e registramos o chamado #{{numero}} em nossa fila.\n\n' +
  'Informamos que no momento nossa equipe está fora do horário regular de expediente comercial ou em período de recesso/feriado.\n\n' +
  '• Número do Chamado: #{{numero}}\n' +
  '• Assunto: {{assunto}}\n' +
  '• Abertura registrada em: {{data}}\n\n' +
  'Sua solicitação está preservada e será atendida assim que nosso expediente for retomado pelo próximo analista disponível.\n\n' +
  'Caso se trate de uma emergência crítica contratual coberta por plantão, os canais de sobreaviso já foram alertados.\n\n' +
  'Atenciosamente,\n' +
  'Equipe de Suporte e Atendimento'

export const DEFAULT_AUTO_REPLY_SETTINGS: EmailAutoReplySettings = {
  receipt_enabled: true,
  receipt_subject: DEFAULT_RECEIPT_SUBJECT,
  receipt_body: DEFAULT_RECEIPT_BODY,
  out_of_office_enabled: false,
  out_of_office_subject: DEFAULT_OUT_OF_OFFICE_SUBJECT,
  out_of_office_body: DEFAULT_OUT_OF_OFFICE_BODY,
  anti_loop_enabled: true,
}

export interface PreviewAutoReplyPayload {
  type: 'receipt' | 'out_of_office'
  subject: string
  body: string
  ticket_number?: string
  ticket_title?: string
  requester_name?: string
  company_name?: string
  date?: string
}

export interface PreviewAutoReplyResponse {
  subject: string
  text: string
  html: string
  vars: {
    numero: string
    assunto: string
    solicitante: string
    empresa: string
    data: string
  }
}

export const emailAutoReplyService = {
  async getSettings(): Promise<EmailAutoReplySettings> {
    try {
      const records = await pb
        .collection('email_auto_replies')
        .getFullList<EmailAutoReplySettings>({
          filter: 'scope = "global"',
          sort: '-created',
        })

      if (records.length > 0) {
        const r = records[0]
        return {
          id: r.id,
          scope: 'global',
          receipt_enabled: r.receipt_enabled ?? true,
          receipt_subject: r.receipt_subject || DEFAULT_RECEIPT_SUBJECT,
          receipt_body: r.receipt_body || DEFAULT_RECEIPT_BODY,
          out_of_office_enabled: r.out_of_office_enabled ?? false,
          out_of_office_subject: r.out_of_office_subject || DEFAULT_OUT_OF_OFFICE_SUBJECT,
          out_of_office_body: r.out_of_office_body || DEFAULT_OUT_OF_OFFICE_BODY,
          anti_loop_enabled: r.anti_loop_enabled ?? true,
          created: r.created,
          updated: r.updated,
        }
      }

      return { ...DEFAULT_AUTO_REPLY_SETTINGS }
    } catch (err) {
      console.warn('Erro ao carregar email_auto_replies:', err)
      return { ...DEFAULT_AUTO_REPLY_SETTINGS }
    }
  },

  async saveSettings(data: Partial<EmailAutoReplySettings>): Promise<EmailAutoReplySettings> {
    const current = await this.getSettings()

    const payload = {
      scope: 'global',
      receipt_enabled:
        data.receipt_enabled !== undefined ? data.receipt_enabled : current.receipt_enabled,
      receipt_subject:
        data.receipt_subject !== undefined ? data.receipt_subject : current.receipt_subject,
      receipt_body: data.receipt_body !== undefined ? data.receipt_body : current.receipt_body,
      out_of_office_enabled:
        data.out_of_office_enabled !== undefined
          ? data.out_of_office_enabled
          : current.out_of_office_enabled,
      out_of_office_subject:
        data.out_of_office_subject !== undefined
          ? data.out_of_office_subject
          : current.out_of_office_subject,
      out_of_office_body:
        data.out_of_office_body !== undefined
          ? data.out_of_office_body
          : current.out_of_office_body,
      anti_loop_enabled:
        data.anti_loop_enabled !== undefined ? data.anti_loop_enabled : current.anti_loop_enabled,
    }

    if (current.id) {
      const updated = await pb
        .collection('email_auto_replies')
        .update<EmailAutoReplySettings>(current.id, payload)
      return updated
    }

    const created = await pb
      .collection('email_auto_replies')
      .create<EmailAutoReplySettings>(payload)
    return created
  },

  async preview(payload: PreviewAutoReplyPayload): Promise<PreviewAutoReplyResponse> {
    try {
      const response = await pb.send<PreviewAutoReplyResponse>(
        '/backend/v1/emails/auto-replies/preview',
        {
          method: 'POST',
          body: payload,
        },
      )
      return response
    } catch (err) {
      // Fallback local caso o endpoint não responda
      const vars = {
        numero: payload.ticket_number || '1042',
        assunto: payload.ticket_title || 'Falha de comunicação com o servidor de banco de dados',
        solicitante: payload.requester_name || 'Mariana Souza',
        empresa: payload.company_name || 'Hospital Santa Helena',
        data: payload.date || new Date().toLocaleString('pt-BR'),
      }

      let sub = payload.subject || ''
      let bdy = payload.body || ''
      sub = sub
        .replace(/\{\{\s*numero\s*\}\}/gi, vars.numero)
        .replace(/\{\{\s*assunto\s*\}\}/gi, vars.assunto)
        .replace(/\{\{\s*solicitante\s*\}\}/gi, vars.solicitante)
        .replace(/\{\{\s*empresa\s*\}\}/gi, vars.empresa)
        .replace(/\{\{\s*data\s*\}\}/gi, vars.data)

      bdy = bdy
        .replace(/\{\{\s*numero\s*\}\}/gi, vars.numero)
        .replace(/\{\{\s*assunto\s*\}\}/gi, vars.assunto)
        .replace(/\{\{\s*solicitante\s*\}\}/gi, vars.solicitante)
        .replace(/\{\{\s*empresa\s*\}\}/gi, vars.empresa)
        .replace(/\{\{\s*data\s*\}\}/gi, vars.data)

      return {
        subject: sub,
        text: bdy,
        html: `<div style="font-family: sans-serif; padding: 20px;"><h2 style="color: #d97706;">${sub}</h2><pre style="white-space: pre-wrap; font-family: inherit;">${bdy}</pre></div>`,
        vars,
      }
    }
  },
}
