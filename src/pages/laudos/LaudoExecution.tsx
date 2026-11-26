// Execução do Laudo Fotográfico — detalhe com ambientes, checklist, fotos antes/depois,
// observações e finalização com assinatura de quem acompanhou (SignatureDialog).
import { useCallback, useEffect, useState } from 'react'
import { ArrowLeft, Loader2, PenTool, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Progress } from '@/components/ui/progress'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useToast } from '@/hooks/use-toast'
import { formatDateOnly, formatDateTime } from '@/lib/date-format'
import { SignatureDialog } from '@/components/laudos/SignatureDialog'
import {
  Laudo,
  LaudoAmbiente,
  LaudoChecklistItemJson,
  ambientChecklistProgress,
  companyLabel,
  deleteLaudo,
  finalizeLaudo,
  laudoOverallProgress,
  laudoSignatureUrl,
  listAmbientes,
  getLaudo,
  updateAmbiente,
} from '@/services/laudos'
import AmbienteCard from './LaudoAmbienteCard'

export default function LaudoExecution({
  laudoId,
  fallback,
  onBack,
}: {
  laudoId: string
  fallback?: Laudo | null
  onBack: () => void
}) {
  const { toast } = useToast()
  const [laudo, setLaudo] = useState<Laudo | null>(fallback)
  const [ambientes, setAmbientes] = useState<LaudoAmbiente[]>([])
  const [loading, setLoading] = useState(!fallback)
  const [savingId, setSavingId] = useState<string | null>(null)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [signOpen, setSignOpen] = useState(false)
  const [finalNotes, setFinalNotes] = useState('')
  const [finalizing, setFinalizing] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const load = useCallback(async () => {
    try {
      const [l, amb] = await Promise.all([getLaudo(laudoId), listAmbientes(laudoId)])
      setLaudo(l)
      setAmbientes(amb)
      setFinalNotes(l.final_notes || '')
    } catch (e) {
      toast({
        title: 'Erro ao carregar laudo',
        description: e instanceof Error ? e.message : 'Tente novamente.',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }, [laudoId, toast])

  useEffect(() => {
    load()
  }, [load])

  const readOnly = laudo?.status === 'concluido'
  const overall = laudoOverallProgress(ambientes)
  const allAmbientsDone =
    ambientes.length > 0 &&
    ambientes.every((a) => ambientChecklistProgress(a).done === ambientChecklistProgress(a).total)
  const pct = overall.total > 0 ? (overall.done / overall.total) * 100 : 0

  const handleUpdateItem = async (
    ambiente: LaudoAmbiente,
    itemIndex: number,
    patch: Partial<LaudoChecklistItemJson>,
  ) => {
    const nextItems = (ambiente.checklist_items || []).map((it, idx) =>
      idx === itemIndex ? { ...it, ...patch } : it,
    )
    setAmbientes((prev) =>
      prev.map((a) => (a.id === ambiente.id ? { ...a, checklist_items: nextItems } : a)),
    )
    setSavingId(ambiente.id)
    try {
      const updated = await updateAmbiente(ambiente.id, {
        checklist_items: nextItems,
        status: nextItems.every((i) => i.status !== 'pendente')
          ? 'concluido'
          : nextItems.some((i) => i.status !== 'pendente')
            ? 'em_andamento'
            : 'pendente',
      })
      setAmbientes((prev) => prev.map((a) => (a.id === updated.id ? updated : a)))
    } catch (e) {
      setAmbientes((prev) =>
        prev.map((a) =>
          a.id === ambiente.id ? { ...a, checklist_items: ambiente.checklist_items } : a,
        ),
      )
      toast({
        title: 'Erro ao salvar item',
        description: e instanceof Error ? e.message : 'Tente novamente.',
        variant: 'destructive',
      })
    } finally {
      setSavingId(null)
    }
  }

  const handleUpdateObservation = async (ambiente: LaudoAmbiente, observation: string) => {
    setAmbientes((prev) =>
      prev.map((a) => (a.id === ambiente.id ? { ...a, observations: observation } : a)),
    )
    setSavingId(ambiente.id)
    try {
      const updated = await updateAmbiente(ambiente.id, { observations: observation })
      setAmbientes((prev) => prev.map((a) => (a.id === updated.id ? updated : a)))
    } catch (e) {
      toast({
        title: 'Erro ao salvar observações',
        description: e instanceof Error ? e.message : 'Tente novamente.',
        variant: 'destructive',
      })
    } finally {
      setSavingId(null)
    }
  }

  const handleUpload = async (
    ambiente: LaudoAmbiente,
    kind: 'before' | 'after',
    files: FileList | null,
  ) => {
    if (!files || files.length === 0) return
    const field = kind === 'before' ? 'photos_before' : 'photos_after'
    const existing = (kind === 'before' ? ambiente.photos_before : ambiente.photos_after) || []
    setSavingId(ambiente.id)
    try {
      const updated = await updateAmbiente(ambiente.id, {
        [field]: [...existing, ...Array.from(files)],
      })
      setAmbientes((prev) => prev.map((a) => (a.id === updated.id ? updated : a)))
      toast({ title: 'Fotos enviadas' })
    } catch (e) {
      toast({
        title: 'Erro ao enviar fotos',
        description: e instanceof Error ? e.message : 'Tente novamente.',
        variant: 'destructive',
      })
    } finally {
      setSavingId(null)
    }
  }

  const handleRemovePhoto = async (
    ambiente: LaudoAmbiente,
    kind: 'before' | 'after',
    filename: string,
  ) => {
    const field = kind === 'before' ? 'photos_before' : 'photos_after'
    const existing = (kind === 'before' ? ambiente.photos_before : ambiente.photos_after) || []
    setSavingId(ambiente.id)
    try {
      const updated = await updateAmbiente(ambiente.id, {
        [field]: existing.filter((f) => f !== filename),
      })
      setAmbientes((prev) => prev.map((a) => (a.id === updated.id ? updated : a)))
    } catch (e) {
      toast({
        title: 'Erro ao remover foto',
        description: e instanceof Error ? e.message : 'Tente novamente.',
        variant: 'destructive',
      })
    } finally {
      setSavingId(null)
    }
  }

  const handleFinalize = async (data: { name: string; role: string; signatureDataUrl: string }) => {
    setFinalizing(true)
    try {
      const updated = await finalizeLaudo(laudoId, {
        companionName: data.name,
        companionRole: data.role,
        signatureDataUrl: data.signatureDataUrl,
        finalNotes: finalNotes,
      })
      setLaudo(updated)
      setSignOpen(false)
      setConfirmOpen(false)
      toast({
        title: 'Laudo finalizado!',
        description: 'Assinatura registrada. O laudo agora é somente leitura.',
      })
    } catch (e) {
      toast({
        title: 'Erro ao finalizar laudo',
        description: e instanceof Error ? e.message : 'Tente novamente.',
        variant: 'destructive',
      })
    } finally {
      setFinalizing(false)
    }
  }

  const handleDelete = async () => {
    setDeleting(true)
    try {
      await deleteLaudo(laudoId)
      toast({ title: 'Laudo excluído' })
      onBack()
    } catch (e) {
      toast({
        title: 'Erro ao excluir laudo',
        description: e instanceof Error ? e.message : 'Tente novamente.',
        variant: 'destructive',
      })
    } finally {
      setDeleting(false)
    }
  }

  if (loading || !laudo) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="mx-auto w-full max-w-5xl space-y-4 p-4 md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <Button
            variant="ghost"
            size="sm"
            onClick={onBack}
            className="mb-1 -ml-2 h-11 px-3 lg:h-8"
          >
            <ArrowLeft className="mr-1.5 h-4 w-4" /> Voltar para a lista
          </Button>
          <h1 className="truncate text-lg font-bold">{laudo.title}</h1>
          <p className="text-xs text-muted-foreground">
            {companyLabel(laudo.expand?.company)} · Visita {formatDateOnly(laudo.visit_date)} ·
            Técnico: {laudo.expand?.technician?.name || '—'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {!readOnly && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleDelete}
              disabled={deleting}
              className="h-11 px-4 text-xs lg:h-8 lg:px-3 lg:text-sm text-destructive hover:text-destructive"
            >
              <Trash2 className="mr-2 h-4 w-4" /> Excluir
            </Button>
          )}
          {readOnly ? (
            <Badge variant="default">Concluído</Badge>
          ) : (
            <Button
              size="sm"
              onClick={() => setConfirmOpen(true)}
              disabled={!allAmbientsDone || finalizing}
              className="h-11 px-4 text-xs lg:h-8 lg:px-3 lg:text-sm"
            >
              <PenTool className="mr-2 h-4 w-4" /> Finalizar laudo
            </Button>
          )}
        </div>
      </div>

      {readOnly ? (
        <Card>
          <CardContent className="flex flex-wrap items-center gap-4 p-4">
            {laudo.companion_signature ? (
              <img
                src={laudoSignatureUrl(laudo)}
                alt={`Assinatura de ${laudo.companion_name}`}
                width={220}
                height={80}
                className="h-20 w-auto rounded-md border bg-white object-contain p-1"
              />
            ) : null}
            <div className="min-w-0 text-sm">
              <p className="font-medium">{laudo.companion_name || '—'}</p>
              <p className="text-xs text-muted-foreground">
                {laudo.companion_role || 'Acompanhante'} · Assinado em{' '}
                {formatDateTime(laudo.signed_at)}
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="space-y-2 p-4">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>
                Progresso geral: {overall.done}/{overall.total} itens
              </span>
              <span>
                {allAmbientsDone
                  ? 'Tudo pronto — finalize com a assinatura.'
                  : 'Conclua os itens de todos os ambientes para finalizar.'}
              </span>
            </div>
            <Progress value={pct} className="h-2" aria-label="Progresso geral do laudo" />
            <div className="space-y-1.5 pt-1">
              <Label htmlFor="final-notes">Observações finais (opcional)</Label>
              <Textarea
                id="final-notes"
                value={finalNotes}
                onChange={(e) => setFinalNotes(e.target.value)}
                rows={2}
                maxLength={2000}
                placeholder="Resumo da visita, pendências, combinados..."
              />
            </div>
          </CardContent>
        </Card>
      )}

      {readOnly && laudo.final_notes ? (
        <Card>
          <CardContent className="p-4">
            <p className="mb-1 text-xs font-medium text-muted-foreground">Observações finais</p>
            <p className="whitespace-pre-wrap text-sm">{laudo.final_notes}</p>
          </CardContent>
        </Card>
      ) : null}

      <div className="space-y-3">
        {ambientes.map((amb) => (
          <AmbienteCard
            key={amb.id}
            ambiente={amb}
            readOnly={readOnly}
            saving={savingId === amb.id}
            onUpdateItem={handleUpdateItem}
            onUpdateObservation={handleUpdateObservation}
            onUpload={handleUpload}
            onRemovePhoto={handleRemovePhoto}
          />
        ))}
        {ambientes.length === 0 && (
          <Card>
            <CardContent className="py-10 text-center text-sm text-muted-foreground">
              Este laudo não tem ambientes.
            </CardContent>
          </Card>
        )}
      </div>

      {/* Confirmação antes da assinatura */}
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Finalizar laudo</DialogTitle>
            <DialogDescription>
              Após finalizar, o laudo fica somente leitura com a assinatura de quem acompanhou.
            </DialogDescription>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            {overall.done}/{overall.total} itens marcados em {ambientes.length} ambiente(s). Você
            também pode revisar as observações finais antes de continuar.
          </p>
          <DialogFooter className="flex-col gap-2 sm:flex-col sm:justify-start lg:flex-row lg:justify-end">
            <Button variant="outline" className="h-11 lg:h-9" onClick={() => setConfirmOpen(false)}>
              Voltar
            </Button>
            <Button className="h-11 lg:h-9" onClick={() => setSignOpen(true)} disabled={finalizing}>
              <PenTool className="mr-2 h-4 w-4" /> Continuar para assinatura
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <SignatureDialog open={signOpen} onOpenChange={setSignOpen} onConfirm={handleFinalize} />
    </div>
  )
}
