// Card de um ambiente do laudo: itens do checklist, fotos antes/depois e observações.
import { useRef, useState } from 'react'
import { ImagePlus, Loader2, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  ITEM_STATUS_LABELS,
  LaudoAmbiente,
  LaudoChecklistItemJson,
  LaudoItemStatus,
  ambientChecklistProgress,
  laudoPhotoUrl,
} from '@/services/laudos'

const ITEM_OPTIONS: LaudoItemStatus[] = ['pendente', 'realizado', 'nao_aplicavel']

interface Props {
  ambiente: LaudoAmbiente
  readOnly: boolean
  saving: boolean
  onUpdateItem: (
    ambiente: LaudoAmbiente,
    itemIndex: number,
    patch: Partial<LaudoChecklistItemJson>,
  ) => Promise<void>
  onUpdateObservation: (ambiente: LaudoAmbiente, observation: string) => Promise<void>
  onUpload: (
    ambiente: LaudoAmbiente,
    kind: 'before' | 'after',
    files: FileList | null,
  ) => Promise<void>
  onRemovePhoto: (
    ambiente: LaudoAmbiente,
    kind: 'before' | 'after',
    filename: string,
  ) => Promise<void>
}

function PhotoThumbs({
  ambiente,
  kind,
  photos,
  readOnly,
  saving,
  onUpload,
  onRemovePhoto,
}: Omit<Props, 'ambiente' | 'onUpdateItem' | 'onUpdateObservation'> & {
  ambiente: LaudoAmbiente
  kind: 'before' | 'after'
  photos: string[]
  label: string
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [removing, setRemoving] = useState<string | null>(null)
  const field = kind === 'before' ? 'Fotos antes' : 'Fotos depois'
  const label = kind === 'before' ? 'Fotos antes' : 'Fotos depois'
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label className="text-xs">{label}</Label>
        {!readOnly && (
          <>
            <input
              ref={inputRef}
              type="file"
              accept="image/*"
              multiple
              className="sr-only"
              aria-label={`Enviar ${field.toLowerCase()}`}
              onChange={(e) => {
                onUpload(ambiente, kind, e.target.files)
                e.target.value = ''
              }}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-7 px-2 text-xs"
              onClick={() => inputRef.current?.click()}
              disabled={saving}
            >
              {saving ? (
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              ) : (
                <ImagePlus className="mr-1.5 h-3.5 w-3.5" />
              )}
              Adicionar
            </Button>
          </>
        )}
      </div>
      {photos.length === 0 ? (
        <p className="text-xs text-muted-foreground">Nenhuma foto anexada.</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {photos.map((filename) => (
            <div key={filename} className="group relative">
              <img
                src={laudoPhotoUrl(ambiente, kind, filename)}
                alt={`${field} — ${filename}`}
                width={96}
                height={96}
                className="h-24 w-24 rounded-md border object-cover"
              />
              {!readOnly && (
                <button
                  type="button"
                  aria-label={`Remover foto ${filename}`}
                  onClick={async () => {
                    setRemoving(filename)
                    await onRemovePhoto(ambiente, kind, filename)
                    setRemoving(null)
                  }}
                  className="absolute -right-1.5 -top-1.5 rounded-full bg-destructive p-1 text-destructive-foreground shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {removing === filename ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <Trash2 className="h-3 w-3" />
                  )}
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default function AmbienteCard({
  ambiente,
  readOnly,
  saving,
  onUpdateItem,
  onUpdateObservation,
  onUpload,
  onRemovePhoto,
}: Props) {
  const { done, total } = ambientChecklistProgress(ambiente)
  const [open, setOpen] = useState(true)
  const statusVariant =
    ambiente.status === 'concluido'
      ? 'default'
      : ambiente.status === 'em_andamento'
        ? 'secondary'
        : 'outline'

  const [obsValue, setObsValue] = useState(ambiente.observations || '')
  const obsDirty = obsValue !== (ambiente.observations || '')
  const handleSaveObservation = (value: string) => onUpdateObservation(ambiente, value)

  return (
    <Card>
      <CardContent className="p-4">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex w-full items-center gap-2 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-md"
          aria-expanded={open}
        >
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="truncate text-sm font-semibold">{ambiente.ambient_name}</p>
              <Badge variant={statusVariant}>
                {done}/{total} itens
              </Badge>
              {saving && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
            </div>
          </div>
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${open ? 'rotate-180' : ''}`}
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="m6 9 6 6 6-6" />
          </svg>
        </button>

        {open && (
          <div className="mt-3 space-y-4">
            <ul className="space-y-2">
              {(ambiente.checklist_items || []).map((item, idx) => (
                <li key={idx} className="flex flex-wrap items-start gap-2 rounded-md border p-2.5">
                  <Checkbox
                    id={`item-${ambiente.id}-${idx}`}
                    checked={item.status === 'realizado'}
                    disabled={readOnly || saving}
                    onCheckedChange={(checked) =>
                      onUpdateItem(ambiente, idx, {
                        status: checked ? 'realizado' : 'pendente',
                      })
                    }
                  />
                  <div className="min-w-0 flex-1">
                    <Label
                      htmlFor={`item-${ambiente.id}-${idx}`}
                      className={`text-sm ${item.status !== 'pendente' ? 'text-muted-foreground' : ''}`}
                    >
                      {item.description}
                    </Label>
                    {item.status !== 'pendente' && (
                      <div className="mt-1.5 flex items-center gap-2">
                        <Select
                          value={item.status}
                          disabled={readOnly || saving}
                          onValueChange={(v) =>
                            onUpdateItem(ambiente, idx, { status: v as LaudoItemStatus })
                          }
                        >
                          <SelectTrigger className="h-7 w-[130px] text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {ITEM_OPTIONS.map((opt) => (
                              <SelectItem key={opt} value={opt}>
                                {ITEM_STATUS_LABELS[opt]}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                    <input
                      className="mt-1.5 w-full rounded-md border bg-transparent px-2 py-1 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      placeholder="Observação do item (opcional)"
                      value={item.observation || ''}
                      disabled={readOnly || saving}
                      onChange={(e) => onUpdateItem(ambiente, idx, { observation: e.target.value })}
                      aria-label={`Observação do item ${item.description}`}
                    />
                  </div>
                </li>
              ))}
            </ul>

            <div className="grid gap-4 sm:grid-cols-2">
              <PhotoThumbs
                ambiente={ambiente}
                kind="before"
                label="Fotos antes"
                photos={ambiente.photos_before || []}
                readOnly={readOnly}
                saving={saving}
                onUpload={onUpload}
                onRemovePhoto={onRemovePhoto}
              />
              <PhotoThumbs
                ambiente={ambiente}
                kind="after"
                label="Fotos depois"
                photos={ambiente.photos_after || []}
                readOnly={readOnly}
                saving={saving}
                onUpload={onUpload}
                onRemovePhoto={onRemovePhoto}
              />
            </div>

            {readOnly ? (
              ambiente.observations ? (
                <div>
                  <Label className="text-xs">Observações do ambiente</Label>
                  <p className="whitespace-pre-wrap text-sm">{ambiente.observations}</p>
                </div>
              ) : null
            ) : (
              <div className="space-y-1.5">
                <Label htmlFor={`obs-${ambiente.id}`} className="text-xs">
                  Observações do ambiente
                </Label>
                <Textarea
                  id={`obs-${ambiente.id}`}
                  value={obsValue}
                  onChange={(e) => setObsValue(e.target.value)}
                  onBlur={() => obsDirty && handleSaveObservation(obsValue)}
                  rows={2}
                  maxLength={2000}
                  placeholder="Detalhe o que foi feito no ambiente..."
                />
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
