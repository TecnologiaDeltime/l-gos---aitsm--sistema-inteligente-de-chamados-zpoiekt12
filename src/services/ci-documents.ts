import pb from '@/lib/pocketbase/client'

export interface CiDocumentRecord {
  id: string
  equipment: string
  file: string
  file_name?: string
  file_type?: string
  file_size?: number
  document_type?: string
  uploaded_by: string
  created: string
  updated: string
  expand?: any
}

export const getDocuments = (equipmentId: string) =>
  pb.collection('ci_documents').getFullList<CiDocumentRecord>({
    filter: `equipment = "${equipmentId}"`,
    sort: '-created',
    expand: 'uploaded_by',
  })

export const uploadDocument = (
  equipmentId: string,
  file: File,
  userId: string,
  documentType: string,
) => {
  const formData = new FormData()
  formData.append('equipment', equipmentId)
  formData.append('file', file)
  formData.append('file_name', file.name)
  formData.append('file_type', file.type)
  formData.append('file_size', file.size.toString())
  formData.append('uploaded_by', userId)
  formData.append('document_type', documentType)
  return pb.collection('ci_documents').create<CiDocumentRecord>(formData)
}

export const deleteDocument = (id: string) => pb.collection('ci_documents').delete(id)

export const getDocumentUrl = (record: CiDocumentRecord) =>
  pb.files.getUrl(record, record.file, { download: true })
