import pb from '@/lib/pocketbase/client'

export interface TicketAttachmentRecord {
  id: string
  ticket: string
  interaction?: string
  file: string
  file_name?: string
  file_size?: number
  file_type?: string
  uploaded_by: string
  created: string
  updated: string
  expand?: {
    uploaded_by?: {
      id: string
      name?: string
      email?: string
      avatar?: string
    }
    interaction?: {
      id: string
      content?: string
      type?: string
    }
  }
}

/**
 * Busca todos os anexos de um determinado chamado
 */
export const getTicketAttachments = async (ticketId: string): Promise<TicketAttachmentRecord[]> => {
  return pb.collection('ticket_attachments').getFullList<TicketAttachmentRecord>({
    filter: `ticket = "${ticketId}"`,
    sort: '-created',
    expand: 'uploaded_by,interaction',
  })
}

/**
 * Faz upload de um novo anexo para o chamado
 */
export const uploadAttachment = async (
  ticketId: string,
  file: File,
  uploadedBy: string,
  interactionId?: string,
): Promise<TicketAttachmentRecord> => {
  const formData = new FormData()
  formData.append('ticket', ticketId)
  formData.append('file', file)
  formData.append('file_name', file.name)
  formData.append('file_size', String(file.size))
  formData.append('file_type', file.type || 'application/octet-stream')
  formData.append('uploaded_by', uploadedBy)
  if (interactionId) {
    formData.append('interaction', interactionId)
  }

  return pb.collection('ticket_attachments').create<TicketAttachmentRecord>(formData, {
    expand: 'uploaded_by,interaction',
  })
}

/**
 * Remove um anexo
 */
export const deleteAttachment = async (attachmentId: string): Promise<boolean> => {
  return pb.collection('ticket_attachments').delete(attachmentId)
}

/**
 * Retorna a URL pública de download/visualização de um arquivo de anexo
 */
export const getAttachmentFileUrl = (attachment: TicketAttachmentRecord): string => {
  if (!attachment.file) return ''
  return pb.files.getURL(attachment, attachment.file)
}
