import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import {
  TRIGGER_TYPES,
  CONDITION_FIELDS,
  CONDITION_OPERATORS,
  ACTION_TYPES,
  APPROVAL_TYPES,
  WAIT_TYPES,
  NOTIFICATION_RECIPIENTS,
  END_OUTCOMES,
  TASK_TYPES,
} from '@/lib/workflow-constants'
import type { WorkflowBlock } from '@/types/automation'

interface PropertyPanelProps {
  block: WorkflowBlock | null
  onChange: (config: Record<string, any>) => void
  onLabelChange: (label: string) => void
  onDelete: () => void
}

export function PropertyPanel({ block, onChange, onLabelChange, onDelete }: PropertyPanelProps) {
  if (!block) {
    return (
      <div className="w-72 flex-shrink-0 border-l bg-white p-4">
        <p className="text-xs text-slate-400">Selecione um bloco para editar suas propriedades.</p>
      </div>
    )
  }
  const c = block.config || {}
  const set = (k: string, v: any) => onChange({ ...c, [k]: v })

  return (
    <div className="w-72 flex-shrink-0 border-l bg-white p-4 overflow-y-auto">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-bold">Propriedades</h3>
        <button onClick={onDelete} className="text-xs text-red-500 hover:underline">
          Excluir
        </button>
      </div>
      <div className="space-y-3">
        <div>
          <Label className="text-xs">Nome do Bloco</Label>
          <Input
            value={block.label}
            onChange={(e) => onLabelChange(e.target.value)}
            className="h-8 text-xs"
          />
        </div>
        {block.type === 'start' && (
          <div>
            <Label className="text-xs">Gatilho</Label>
            <Select value={c.trigger || ''} onValueChange={(v) => set('trigger', v)}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue placeholder="Selecione" />
              </SelectTrigger>
              <SelectContent>
                {TRIGGER_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>
                    {t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
        {block.type === 'condition' && (
          <>
            <div>
              <Label className="text-xs">Campo</Label>
              <Select value={c.field || ''} onValueChange={(v) => set('field', v)}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {CONDITION_FIELDS.map((f) => (
                    <SelectItem key={f} value={f}>
                      {f}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Operador</Label>
              <Select value={c.operator || ''} onValueChange={(v) => set('operator', v)}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CONDITION_OPERATORS.map((o) => (
                    <SelectItem key={o} value={o}>
                      {o}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Valor</Label>
              <Input
                value={c.value || ''}
                onChange={(e) => set('value', e.target.value)}
                className="h-8 text-xs"
              />
            </div>
          </>
        )}
        {block.type === 'decision' && (
          <div>
            <Label className="text-xs">Pergunta</Label>
            <Input
              value={c.question || ''}
              onChange={(e) => set('question', e.target.value)}
              className="h-8 text-xs"
              placeholder="Ex: Requer aprovação?"
            />
          </div>
        )}
        {block.type === 'action' && (
          <>
            <div>
              <Label className="text-xs">Tipo de Ação</Label>
              <Select value={c.actionType || ''} onValueChange={(v) => set('actionType', v)}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {ACTION_TYPES.map((a) => (
                    <SelectItem key={a} value={a}>
                      {a}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Valor / Parâmetro</Label>
              <Input
                value={c.value || ''}
                onChange={(e) => set('value', e.target.value)}
                className="h-8 text-xs"
                placeholder="Valor a aplicar"
              />
            </div>
          </>
        )}
        {block.type === 'approval' && (
          <>
            <div>
              <Label className="text-xs">Tipo de Aprovação</Label>
              <Select value={c.approvalType || ''} onValueChange={(v) => set('approvalType', v)}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {APPROVAL_TYPES.map((a) => (
                    <SelectItem key={a} value={a}>
                      {a}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Aprovador (ID ou e-mail)</Label>
              <Input
                value={c.approver || ''}
                onChange={(e) => set('approver', e.target.value)}
                className="h-8 text-xs"
              />
            </div>
            <div>
              <Label className="text-xs">Prazo (horas)</Label>
              <Input
                type="number"
                value={c.deadlineHours || ''}
                onChange={(e) => set('deadlineHours', e.target.value)}
                className="h-8 text-xs"
              />
            </div>
          </>
        )}
        {block.type === 'wait' && (
          <>
            <div>
              <Label className="text-xs">Tipo de Espera</Label>
              <Select value={c.waitType || ''} onValueChange={(v) => set('waitType', v)}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {WAIT_TYPES.map((w) => (
                    <SelectItem key={w} value={w}>
                      {w}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Duração (horas)</Label>
              <Input
                type="number"
                value={c.duration || ''}
                onChange={(e) => set('duration', e.target.value)}
                className="h-8 text-xs"
              />
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={!!c.pauseSla} onCheckedChange={(v) => set('pauseSla', v)} />
              <Label className="text-xs">Pausar SLA</Label>
            </div>
          </>
        )}
        {block.type === 'notification' && (
          <>
            <div>
              <Label className="text-xs">Destinatário</Label>
              <Select value={c.recipient || ''} onValueChange={(v) => set('recipient', v)}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {NOTIFICATION_RECIPIENTS.map((r) => (
                    <SelectItem key={r} value={r}>
                      {r}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Título</Label>
              <Input
                value={c.title || ''}
                onChange={(e) => set('title', e.target.value)}
                className="h-8 text-xs"
              />
            </div>
            <div>
              <Label className="text-xs">Mensagem</Label>
              <Textarea
                rows={3}
                value={c.message || ''}
                onChange={(e) => set('message', e.target.value)}
                className="text-xs"
              />
            </div>
          </>
        )}
        {block.type === 'task' && (
          <>
            <div>
              <Label className="text-xs">Título da Tarefa</Label>
              <Input
                value={c.taskTitle || ''}
                onChange={(e) => set('taskTitle', e.target.value)}
                className="h-8 text-xs"
              />
            </div>
            <div>
              <Label className="text-xs">Descrição</Label>
              <Textarea
                rows={2}
                value={c.taskDesc || ''}
                onChange={(e) => set('taskDesc', e.target.value)}
                className="text-xs"
              />
            </div>
            <div>
              <Label className="text-xs">Tipo</Label>
              <Select value={c.taskType || ''} onValueChange={(v) => set('taskType', v)}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {TASK_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </>
        )}
        {block.type === 'integration' && (
          <>
            <div>
              <Label className="text-xs">Método</Label>
              <Select value={c.method || 'GET'} onValueChange={(v) => set('method', v)}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].map((m) => (
                    <SelectItem key={m} value={m}>
                      {m}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">URL</Label>
              <Input
                value={c.url || ''}
                onChange={(e) => set('url', e.target.value)}
                className="h-8 text-xs"
                placeholder="https://..."
              />
            </div>
            <div>
              <Label className="text-xs">Corpo (JSON)</Label>
              <Textarea
                rows={2}
                value={c.body || ''}
                onChange={(e) => set('body', e.target.value)}
                className="text-xs"
              />
            </div>
            <p className="text-[10px] text-amber-600">
              Integrações com AD, Entra ID, Power Automate não são suportadas. Use webhooks.
            </p>
          </>
        )}
        {block.type === 'end' && (
          <div>
            <Label className="text-xs">Desfecho</Label>
            <Select value={c.outcome || ''} onValueChange={(v) => set('outcome', v)}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue placeholder="Selecione" />
              </SelectTrigger>
              <SelectContent>
                {END_OUTCOMES.map((o) => (
                  <SelectItem key={o} value={o}>
                    {o}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>
    </div>
  )
}
