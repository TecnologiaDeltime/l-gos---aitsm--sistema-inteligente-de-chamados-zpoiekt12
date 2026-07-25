import { useEffect, useState, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import {
  ZoomIn,
  ZoomOut,
  Save,
  Play,
  Send,
  AlertTriangle,
  ArrowLeft,
  CheckCircle,
} from 'lucide-react'
import { BlockSidebar } from '@/components/automation/BlockSidebar'
import { AutomationCanvas } from '@/components/automation/AutomationCanvas'
import { PropertyPanel } from '@/components/automation/PropertyPanel'
import {
  getAutomation,
  getLatestVersion,
  saveDraft,
  publishVersion,
  getVersions,
  createAuditLog,
} from '@/services/automations'
import { useAuth } from '@/hooks/use-auth'
import { useToast } from '@/hooks/use-toast'
import { getBlockMeta } from '@/lib/workflow-constants'
import type {
  WorkflowBlock,
  WorkflowConnection,
  WorkflowDefinition,
  AutomationRecord,
  WorkflowVersionRecord,
} from '@/types/automation'

export default function AutomationEditor() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const { toast } = useToast()
  const [automation, setAutomation] = useState<AutomationRecord | null>(null)
  const [blocks, setBlocks] = useState<WorkflowBlock[]>([])
  const [connections, setConnections] = useState<WorkflowConnection[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [connectingFrom, setConnectingFrom] = useState<string | null>(null)
  const [connectingPort, setConnectingPort] = useState<string | null>(null)
  const [zoom, setZoom] = useState(1)
  const [errors, setErrors] = useState<string[]>([])
  const [simResult, setSimResult] = useState<string[] | null>(null)
  const [publishOpen, setPublishOpen] = useState(false)
  const [publishReason, setPublishReason] = useState('')
  const [versions, setVersions] = useState<WorkflowVersionRecord[]>([])

  useEffect(() => {
    if (!id) return
    getAutomation(id)
      .then(setAutomation)
      .catch(() => {})
    getLatestVersion(id).then((v) => {
      if (v?.definition) {
        try {
          const def = JSON.parse(v.definition) as WorkflowDefinition
          setBlocks(def.blocks || [])
          setConnections(def.connections || [])
        } catch {
          /* intentionally ignored */
        }
      }
    })
    getVersions(id)
      .then(setVersions)
      .catch(() => {})
  }, [id])

  const selectedBlock = blocks.find((b) => b.id === selectedId) || null

  const addBlock = (type: string) => {
    const meta = getBlockMeta(type)
    const newBlock: WorkflowBlock = {
      id: `blk_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      type,
      label: meta.label,
      x: 200 + Math.random() * 100,
      y: 150 + Math.random() * 100,
      config: {},
    }
    setBlocks([...blocks, newBlock])
  }

  const addBlockAt = (type: string, x: number, y: number) => {
    const meta = getBlockMeta(type)
    setBlocks([
      ...blocks,
      {
        id: `blk_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        type,
        label: meta.label,
        x,
        y,
        config: {},
      },
    ])
  }

  const handleDragStart = (type: string) => {
    const meta = getBlockMeta(type)
  }

  const updateBlock = (id: string, updates: Partial<WorkflowBlock>) => {
    setBlocks(blocks.map((b) => (b.id === id ? { ...b, ...updates } : b)))
  }

  const deleteBlock = (id: string) => {
    setBlocks(blocks.filter((b) => b.id !== id))
    setConnections(connections.filter((c) => c.source !== id && c.target !== id))
    setSelectedId(null)
  }

  const startConnect = (blockId: string, port: string | null) => {
    setConnectingFrom(blockId)
    setConnectingPort(port)
  }

  const completeConnect = (targetId: string) => {
    if (connectingFrom && connectingFrom !== targetId) {
      const exists = connections.some(
        (c) =>
          c.source === connectingFrom && c.target === targetId && c.sourcePort === connectingPort,
      )
      if (!exists) {
        setConnections([
          ...connections,
          {
            id: `conn_${Date.now()}`,
            source: connectingFrom,
            target: targetId,
            sourcePort: connectingPort || undefined,
          },
        ])
      }
    }
    setConnectingFrom(null)
    setConnectingPort(null)
  }

  const deleteConnection = (connId: string) =>
    setConnections(connections.filter((c) => c.id !== connId))

  const validate = useCallback((): string[] => {
    const errs: string[] = []
    const startBlocks = blocks.filter((b) => b.type === 'start')
    const endBlocks = blocks.filter((b) => b.type === 'end')
    if (startBlocks.length === 0) errs.push('Falta bloco de Início')
    if (startBlocks.length > 1) errs.push('Apenas um bloco de Início é permitido')
    if (endBlocks.length === 0) errs.push('Falta bloco de Fim')
    blocks.forEach((b) => {
      const hasIncoming = connections.some((c) => c.target === b.id)
      const hasOutgoing = connections.some((c) => c.source === b.id)
      if (b.type !== 'start' && !hasIncoming)
        errs.push(`Bloco "${b.label}" não está conectado (sem entrada)`)
      if (b.type !== 'end' && !hasOutgoing)
        errs.push(`Bloco "${b.label}" não está conectado (sem saída)`)
      if (b.type === 'notification' && !b.config?.recipient)
        errs.push(`Notificação "${b.label}" sem destinatário`)
      if (b.type === 'task' && !b.config?.taskTitle) errs.push(`Tarefa "${b.label}" sem título`)
      if (b.type === 'integration' && !b.config?.url) errs.push(`Integração "${b.label}" sem URL`)
      if (b.type === 'approval' && !b.config?.approver)
        errs.push(`Aprovação "${b.label}" sem aprovador`)
      if (b.type === 'condition' && !b.config?.field)
        errs.push(`Condição "${b.label}" sem campo definido`)
    })
    return errs
  }, [blocks, connections])

  const handleSave = async () => {
    if (!id) return
    try {
      await saveDraft(id, { blocks, connections })
      toast({ title: 'Rascunho salvo!' })
    } catch {
      toast({ title: 'Erro ao salvar', variant: 'destructive' })
    }
  }

  const handleValidate = () => {
    const errs = validate()
    setErrors(errs)
    if (errs.length === 0) toast({ title: 'Validação OK! Nenhum erro encontrado.' })
    else toast({ title: `${errs.length} erro(s) encontrado(s)`, variant: 'destructive' })
  }

  const handleSimulate = () => {
    const errs = validate()
    if (errs.length > 0) {
      setErrors(errs)
      return
    }
    const trace: string[] = []
    const start = blocks.find((b) => b.type === 'start')
    if (!start) {
      setSimResult(['Erro: Sem bloco de início'])
      return
    }
    let current = start
    let iter = 0
    trace.push(`▶ Início: ${start.config?.trigger || 'Chamado Aberto'}`)
    while (current && iter < 50) {
      iter++
      if (current.type === 'action')
        trace.push(
          `⚡ Ação: ${current.config?.actionType || 'N/A'} → ${current.config?.value || ''}`,
        )
      else if (current.type === 'condition')
        trace.push(
          `🔀 Condição: ${current.config?.field} ${current.config?.operator} ${current.config?.value} → Sim`,
        )
      else if (current.type === 'approval')
        trace.push(`✓ Aprovação: ${current.config?.approvalType} → Aguardando`)
      else if (current.type === 'notification')
        trace.push(`🔔 Notificação: ${current.config?.recipient} → ${current.config?.title || ''}`)
      else if (current.type === 'task')
        trace.push(`📋 Tarefa: ${current.config?.taskTitle || 'N/A'}`)
      else if (current.type === 'integration')
        trace.push(`🔗 Integração: ${current.config?.method} ${current.config?.url || ''}`)
      else if (current.type === 'wait')
        trace.push(`⏳ Aguardar: ${current.config?.waitType || 'N/A'}`)
      else if (current.type === 'end') {
        trace.push(`■ Fim: ${current.config?.outcome || 'Concluído'}`)
        break
      }
      const conn = connections.find((c) => c.source === current!.id)
      current = conn ? blocks.find((b) => b.id === conn.target) || null : null
    }
    setSimResult(trace)
  }

  const handlePublish = async () => {
    if (!id || !user) return
    const errs = validate()
    if (errs.length > 0) {
      setErrors(errs)
      toast({ title: 'Corrija os erros antes de publicar', variant: 'destructive' })
      return
    }
    try {
      await publishVersion(id, { blocks, connections }, publishReason || 'Publicação', user.id)
      await createAuditLog({
        automation: id,
        user: user.id,
        action: 'published',
        description: `Versão publicada: ${publishReason || 'Publicação'}`,
      })
      toast({ title: 'Automação publicada e ativada!' })
      setPublishOpen(false)
      setPublishReason('')
    } catch {
      toast({ title: 'Erro ao publicar', variant: 'destructive' })
    }
  }

  if (!automation)
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
      </div>
    )

  return (
    <div className="flex h-[calc(100vh-8rem)] flex-col">
      <div className="flex items-center justify-between border-b bg-white px-4 py-2">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => navigate('/automations')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h2 className="text-sm font-bold">{automation.name}</h2>
          <span className="text-xs text-slate-500">v{automation.current_version || 0}</span>
          <span
            className={`rounded px-2 py-0.5 text-[10px] font-semibold ${automation.status === 'Ativa' ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-600'}`}
          >
            {automation.status}
          </span>
        </div>
        <div className="flex gap-1">
          <Button size="sm" variant="ghost" onClick={() => setZoom(Math.max(0.5, zoom - 0.1))}>
            <ZoomOut className="h-4 w-4" />
          </Button>
          <span className="text-xs self-center">{Math.round(zoom * 100)}%</span>
          <Button size="sm" variant="ghost" onClick={() => setZoom(Math.min(2, zoom + 0.1))}>
            <ZoomIn className="h-4 w-4" />
          </Button>
          <Button size="sm" variant="outline" onClick={handleValidate}>
            <AlertTriangle className="mr-1 h-4 w-4" /> Validar
          </Button>
          <Button size="sm" variant="outline" onClick={handleSimulate}>
            <Play className="mr-1 h-4 w-4" /> Simular
          </Button>
          <Button size="sm" variant="outline" onClick={handleSave}>
            <Save className="mr-1 h-4 w-4" /> Salvar
          </Button>
          <Button size="sm" onClick={() => setPublishOpen(true)}>
            <Send className="mr-1 h-4 w-4" /> Publicar
          </Button>
        </div>
      </div>
      {errors.length > 0 && (
        <div className="bg-red-50 px-4 py-2">
          <p className="text-xs font-bold text-red-700">Erros de validação:</p>
          <ul className="ml-4 list-disc text-xs text-red-600">
            {errors.map((e, i) => (
              <li key={i}>{e}</li>
            ))}
          </ul>
        </div>
      )}
      <div className="flex flex-1 overflow-hidden">
        <BlockSidebar onAddBlock={addBlock} onDragStart={handleDragStart} />
        <AutomationCanvas
          blocks={blocks}
          connections={connections}
          selectedId={selectedId}
          connectingFrom={connectingFrom}
          connectingPort={connectingPort}
          zoom={zoom}
          onSelectBlock={(sid) => {
            if (connectingFrom && sid) {
              completeConnect(sid)
            } else {
              setSelectedId(sid)
            }
          }}
          onAddBlockAt={addBlockAt}
          onStartConnect={startConnect}
          onCompleteConnect={completeConnect}
          onMoveBlock={(bid, x, y) => updateBlock(bid, { x, y })}
          onDeleteConnection={deleteConnection}
        />
        <PropertyPanel
          block={selectedBlock}
          onChange={(config) => selectedBlock && updateBlock(selectedBlock.id, { config })}
          onLabelChange={(label) => selectedBlock && updateBlock(selectedBlock.id, { label })}
          onDelete={() => selectedBlock && deleteBlock(selectedBlock.id)}
        />
      </div>
      {simResult && (
        <Dialog open={!!simResult} onOpenChange={() => setSimResult(null)}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Simulação do Fluxo</DialogTitle>
            </DialogHeader>
            <div className="space-y-1 max-h-96 overflow-y-auto">
              {simResult.map((line, i) => (
                <p key={i} className="text-xs font-mono text-slate-700">
                  {line}
                </p>
              ))}
              <p className="text-[10px] text-slate-400 mt-2">Simulação não modifica dados reais.</p>
            </div>
          </DialogContent>
        </Dialog>
      )}
      <Dialog open={publishOpen} onOpenChange={setPublishOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Publicar Nova Versão</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs">Motivo da Publicação</Label>
              <Textarea
                rows={3}
                value={publishReason}
                onChange={(e) => setPublishReason(e.target.value)}
                className="text-xs"
              />
            </div>
            <div className="text-xs text-slate-500">
              Versões anteriores são preservadas. Chamados em execução continuam na versão original.
            </div>
            <Button onClick={handlePublish} className="w-full">
              <CheckCircle className="mr-1 h-4 w-4" /> Confirmar Publicação
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
