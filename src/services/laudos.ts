// Laudo Fotográfico de Visitas Preventivas — serviço das coleções `laudos`,
// `laudo_ambientes` e `checklist_templates` (mig 0558).
// Técnico executa checklist por ambiente com fotos antes/depois; finaliza com
// assinatura de quem acompanhou (desenhada em canvas, salva como arquivo).
import pb from '@/lib/pocketbase/client'

export type LaudoStatus = 'rascunho' | 'em_andamento' | 'concluido'

export type LaudoItemStatus = 'pendente' | 'realizado' | 'nao_aplicavel'

export interface LaudoChecklistItemJson {
  description: string
  status: LaudoItemStatus
  observation: string
}

export interface LaudoAmbientJson {
  name: string
  items: string[]
}

export interface ChecklistTemplate {
  id: string
  title: string
  description: string
  company: string
  ambients: LaudoAmbientJson[]
  active: boolean
  created_by: string
  created?: string
  updated?: string
  expand?: {
    company?: { id: string; trade_name?: string; legal_name?: string; name?: string }
    created_by?: { id: string; name: string }
  }
}

export interface LaudoAmbiente {
  id: string
  laudo: string
  ambient_name: string
  sort_order: number
  checklist_items: LaudoChecklistItemJson[]
  observations: string
  status: 'pendente' | 'em_andamento' | 'concluido'
  photos_before: string[]
  photos_after: string[]
  created?: string
  updated?: string
}

export interface Laudo {
  id: string
  title: string
  description: string
  company: string
  technician: string
  template: string
  visit_date: string
  status: LaudoStatus
  companion_name: string
  companion_role: string
  companion_signature: string
  signed_at: string
  final_notes: string
  created?: string
  updated?: string
  expand?: {
    company?: { id: string; trade_name?: string; legal_name?: string; name?: string }
    technician?: { id: string; name: string }
  }
}

export const LAUDO_STATUS_LABELS: Record<LaudoStatus, string> = {
  rascunho: 'Rascunho',
  em_andamento: 'Em andamento',
  concluido: 'Concluído',
}

export const ITEM_STATUS_LABELS: Record<LaudoItemStatus, string> = {
  pendente: 'Pendente',
  realizado: 'Realizado',
  nao_aplicavel: 'N/A',
}

function fileUrl(
  collectionName: string,
  recordId: string | null | undefined,
  filename: string | null | undefined,
): string {
  if (!recordId || !filename) return ''
  return pb.files.getURL(
    { id: recordId, collectionId: collectionName, collectionName },
    filename as string,
  )
}

export function laudoPhotoUrl(
  ambiente: Pick<LaudoAmbiente, 'id'>,
  kind: 'before' | 'after',
  filename: string,
): string {
  return fileUrl('laudo_ambientes', ambiente.id, filename)
}

export function laudoSignatureUrl(laudo: Pick<Laudo, 'id' | 'companion_signature'>): string {
  return fileUrl('laudos', laudo.id, laudo.companion_signature)
}

export function companyLabel(c?: {
  trade_name?: string
  legal_name?: string
  name?: string
}): string {
  if (!c) return 'Cliente'
  return c.trade_name || c.legal_name || c.name || 'Cliente'
}

/* ------------------------------ Empresas (clientes) ------------------------------ */

export async function listCompaniesMinimal(): Promise<Array<{ id: string; label: string }>> {
  const result = await pb.collection('companies').getList(1, 200, {
    sort: 'trade_name',
  })
  return result.items.map((c: any) => ({
    id: c.id,
    label: c.trade_name || c.legal_name || c.name || '(sem nome)',
  }))
}

/* ------------------------------ Templates de checklist ------------------------------ */

function normalizeTemplate(raw: any): ChecklistTemplate {
  return {
    id: raw.id,
    title: raw.title || '',
    description: raw.description || '',
    company: raw.company || '',
    ambients: Array.isArray(raw.ambients)
      ? raw.ambients.map((a: any) => ({
          name: a?.name || '',
          items: Array.isArray(a?.items) ? a.items.filter(Boolean) : [],
        }))
      : [],
    active: raw.active !== false,
    created_by: raw.created_by || '',
    created: raw.created,
    updated: raw.updated,
    expand: raw.expand,
  }
}

export async function listTemplates(companyId?: string): Promise<ChecklistTemplate[]> {
  const filters: string[] = ['active = true']
  if (companyId) filters.push(`company = "${companyId}"`)
  const result = await pb
    .collection('checklist_templates')
    .getFullList<ChecklistTemplate>({ filter: filters.join(' && '), sort: '-created' })
  return result.map(normalizeTemplate)
}

export async function listAllTemplatesForManage(): Promise<ChecklistTemplate[]> {
  const result = await pb
    .collection('checklist_templates')
    .getFullList<ChecklistTemplate>({ sort: '-created' })
  return result.map(normalizeTemplate)
}

export async function createTemplate(data: {
  title: string
  description: string
  company: string
  ambients: LaudoAmbientJson[]
}): Promise<ChecklistTemplate> {
  const model = pb.authStore.model as { id?: string } | null
  const record = await pb.collection('checklist_templates').create({
    title: data.title,
    description: data.description,
    company: data.company,
    ambients: JSON.stringify(data.ambients),
    active: true,
    created_by: model?.id,
  })
  return normalizeTemplate(record)
}

export async function updateTemplate(
  id: string,
  data: {
    title: string
    description: string
    company: string
    ambients: LaudoAmbientJson[]
    active: boolean
  },
): Promise<ChecklistTemplate> {
  const record = await pb.collection('checklist_templates').update(id, {
    ...data,
    ambients: JSON.stringify(data.ambients),
  })
  return normalizeTemplate(record)
}

export async function deleteTemplate(id: string): Promise<void> {
  await pb.collection('checklist_templates').delete(id)
}

/* ------------------------------ Laudos ------------------------------ */

export interface LaudoFilters {
  mineOnly?: boolean
  company?: string
  status?: string
}

export async function listLaudos(filters: LaudoFilters = {}): Promise<Laudo[]> {
  const parts: string[] = []
  const model = pb.authStore.model as { id?: string } | null
  if (filters.mineOnly && model?.id) parts.push(`technician = "${model.id}"`)
  if (filters.company) parts.push(`company = "${filters.company}"`)
  if (filters.status) parts.push(`status = "${filters.status}"`)
  return pb.collection('laudos').getFullList<Laudo>({
    filter: parts.length ? parts.join(' && ') : undefined,
    sort: '-created',
    expand: 'company,technician',
  })
}

export async function getLaudo(id: string): Promise<Laudo> {
  return pb.collection('laudos').getOne<Laudo>(id, { expand: 'company,technician' })
}

export async function createLaudo(data: {
  title: string
  description: string
  company: string
  technician: string
  template: string
  visit_date: string
}): Promise<Laudo> {
  return pb.collection('laudos').create<Laudo>({
    ...data,
    status: 'rascunho',
  })
}

export async function deleteLaudo(id: string): Promise<void> {
  await pb.collection('laudos').delete(id)
}

/* ------------------------------ Ambientes do laudo ------------------------------ */

export async function listAmbientes(laudoId: string): Promise<LaudoAmbiente[]> {
  return pb.collection('laudo_ambientes').getFullList<LaudoAmbiente>({
    filter: `laudo = "${laudoId}"`,
    sort: 'sort_order',
  })
}

function dataUrlToBlob(dataUrl: string): Blob {
  const [meta, base64] = dataUrl.split(',')
  const mimeMatch = /data:([^;]+)/.exec(meta || '')
  const mime = mimeMatch ? mimeMatch[1] : 'image/png'
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return new Blob([bytes], { type: mime })
}

export async function updateAmbiente(
  id: string,
  data: {
    checklist_items?: LaudoChecklistItemJson[]
    observations?: string
    status?: LaudoAmbiente['status']
    /** Novos arquivos de foto; strings preservam fotos já enviadas. */
    photos_before?: Array<File | string>
    photos_after?: Array<File | string>
  },
): Promise<LaudoAmbiente> {
  const formData = new FormData()
  ;(['photos_before', 'photos_after'] as const).forEach((field) => {
    const value = data[field]
    if (!value) return
    const keepExisting: string[] = []
    value.forEach((entry) => {
      if (entry instanceof File) {
        formData.append(field, entry, entry.name)
      } else if (typeof entry === 'string' && entry) {
        keepExisting.push(entry)
      }
    })
    if (keepExisting.length) formData.append(field, JSON.stringify(keepExisting))
  })
  if (data.checklist_items !== undefined) {
    formData.append('checklist_items', JSON.stringify(data.checklist_items))
  }
  if (data.observations !== undefined) formData.append('observations', data.observations)
  if (data.status !== undefined) formData.append('status', data.status)
  return pb.collection('laudo_ambientes').update<LaudoAmbiente>(id, formData)
}

export async function createAmbiente(laudoId: string, ambientName: string): Promise<LaudoAmbiente> {
  const existing = await listAmbientes(laudoId)
  return pb.collection('laudo_ambientes').create<LaudoAmbiente>({
    laudo: laudoId,
    ambient_name: ambientName,
    sort_order: existing.length,
    checklist_items: JSON.stringify([]),
    observations: '',
    status: 'pendente',
  })
}

export async function deleteAmbiente(id: string): Promise<void> {
  await pb.collection('laudo_ambientes').delete(id)
}

export async function createAmbientesFromTemplate(
  laudoId: string,
  template: ChecklistTemplate | null,
  fallbackAmbients: LaudoAmbientJson[],
): Promise<void> {
  const ambients: LaudoAmbientJson[] = template ? template.ambients : fallbackAmbients
  for (const ambient of ambients) {
    await pb.collection('laudo_ambientes').create({
      laudo: laudoId,
      ambient_name: ambient.name,
      sort_order: 0,
      checklist_items: JSON.stringify(
        (ambient.items || []).map((description) => ({
          description,
          status: 'pendente' as LaudoItemStatus,
          observation: '',
        })),
      ),
      observations: '',
      status: 'pendente',
    })
  }
}

/* ------------------------------ Finalização com assinatura ------------------------------ */

export async function finalizeLaudo(
  laudoId: string,
  data: {
    companionName: string
    companionRole: string
    signatureDataUrl: string
    finalNotes: string
  },
): Promise<Laudo> {
  const formData = new FormData()
  formData.append('companion_name', data.companionName)
  formData.append('companion_role', data.companionRole)
  formData.append('final_notes', data.finalNotes)
  formData.append('status', 'concluido')
  formData.append('signed_at', new Date().toISOString())
  const blob = dataUrlToBlob(data.signatureDataUrl)
  formData.append('companion_signature', blob, 'assinatura.png')
  return pb.collection('laudos').update<Laudo>(laudoId, formData)
}

/* ------------------------------ Progresso ------------------------------ */

export function ambientChecklistProgress(ambiente: LaudoAmbiente): { done: number; total: number } {
  const items = ambiente.checklist_items || []
  const done = items.filter((i) => i.status !== 'pendente').length
  return { done, total: items.length }
}

export function laudoOverallProgress(ambientes: LaudoAmbiente[]): { done: number; total: number } {
  let done = 0
  let total = 0
  ambientes.forEach((a) => {
    const p = ambientChecklistProgress(a)
    done += p.done
    total += p.total
  })
  return { done, total }
}
