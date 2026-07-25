import { useEffect, useState, useRef } from 'react'
import { Upload, Download, Trash2, FileText } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  getDocuments,
  uploadDocument,
  deleteDocument,
  getDocumentUrl,
  CiDocumentRecord,
} from '@/services/ci-documents'
import { useToast } from '@/hooks/use-toast'
import { useRealtime } from '@/hooks/use-realtime'

const DOC_TYPES = ['Manual', 'Certificado', 'Nota Fiscal', 'Garantia', 'Foto', 'Outro']

export function CiDetailDocuments({
  equipmentId,
  userId,
}: {
  equipmentId: string
  userId: string
}) {
  const [docs, setDocs] = useState<CiDocumentRecord[]>([])
  const [docType, setDocType] = useState('Manual')
  const fileRef = useRef<HTMLInputElement>(null)
  const { toast } = useToast()

  const loadData = () =>
    getDocuments(equipmentId)
      .then(setDocs)
      .catch(() => {})
  useEffect(() => {
    loadData()
  }, [equipmentId])
  useRealtime('ci_documents', () => loadData())

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !userId) return
    await uploadDocument(equipmentId, file, userId, docType)
    if (fileRef.current) fileRef.current.value = ''
    loadData()
    toast({ title: 'Documento enviado!' })
  }

  const handleDelete = async (id: string) => {
    await deleteDocument(id)
    loadData()
    toast({ title: 'Documento removido' })
  }

  const fmtSize = (b?: number) =>
    b
      ? b < 1024
        ? `${b} B`
        : b < 1048576
          ? `${(b / 1024).toFixed(1)} KB`
          : `${(b / 1048576).toFixed(1)} MB`
      : '-'

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Select value={docType} onValueChange={setDocType}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {DOC_TYPES.map((t) => (
              <SelectItem key={t} value={t}>
                {t}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <input ref={fileRef} type="file" className="hidden" onChange={handleUpload} />
        <Button size="sm" onClick={() => fileRef.current?.click()}>
          <Upload className="mr-1.5 h-4 w-4" /> Enviar Documento
        </Button>
      </div>

      <div className="grid gap-3">
        {docs.length === 0 ? (
          <p className="p-4 text-center text-sm text-slate-500">Nenhum documento.</p>
        ) : (
          docs.map((d) => (
            <div
              key={d.id}
              className="flex items-center gap-3 rounded-lg border bg-white p-4 dark:bg-slate-900"
            >
              <div className="p-2 rounded-lg bg-blue-50 text-blue-600">
                <FileText className="h-5 w-5" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{d.file_name || 'Documento'}</p>
                <p className="text-xs text-slate-500">
                  {d.document_type} · {fmtSize(d.file_size)} ·{' '}
                  {new Date(d.created).toLocaleDateString('pt-BR')}
                </p>
              </div>
              <a href={getDocumentUrl(d)} target="_blank" rel="noreferrer">
                <Button variant="ghost" size="icon">
                  <Download className="h-4 w-4" />
                </Button>
              </a>
              <Button variant="ghost" size="icon" onClick={() => handleDelete(d.id)}>
                <Trash2 className="h-4 w-4 text-red-500" />
              </Button>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
