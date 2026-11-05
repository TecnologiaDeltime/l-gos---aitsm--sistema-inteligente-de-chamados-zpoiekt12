import React, { useState, useEffect, useMemo, useRef } from 'react'
import {
  PlusCircle,
  Paperclip,
  ShieldCheck,
  Building2,
  User,
  X,
  FileIcon,
  UserCheck,
  Laptop,
  Tag,
} from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ConfigurationItemRecord } from '@/services/configuration-items'
import { createTicket } from '@/services/tickets'
import { getCompanyDepartments, CompanyDepartmentRecord } from '@/services/companies'
import { getClientContacts, ClientContactRecord } from '@/services/client-contacts'
import { uploadAttachment } from '@/services/attachments'
import { getEquipments, EquipmentRecord } from '@/services/equipments'
import { getCategories, CategoryRecord } from '@/services/categories'
import { getQueues, QueueRecord } from '@/services/queues'
import { useToast } from '@/hooks/use-toast'
import { usePermissions } from '@/hooks/use-permissions'
import { Users, Inbox } from 'lucide-react'

interface PortalNewTicketDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  companyId: string
  companyName: string
  user: {
    id: string
    name: string
    email: string
    unit?: string
    phone?: string
    company_id?: string
  }
  assets: ConfigurationItemRecord[]
  initialAssetId?: string
  onSuccess: () => void
}

export default function PortalNewTicketDialog({
  open,
  onOpenChange,
  companyId,
  companyName,
  user,
  assets,
  initialAssetId,
  onSuccess,
}: PortalNewTicketDialogProps) {
  const { toast } = useToast()
  const { canView } = usePermissions()
  // Guard do catálogo de permissões: item "Atalho Meu chamado (Portal)" — nível Visualizar exibe o botão
  const canUseMyTicketShortcut = canView('tickets.tickets_portal_meu_chamado')
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [type, setType] = useState('Incidente')
  const [selectedMainCategory, setSelectedMainCategory] = useState<string>('none')
  const [selectedActivity, setSelectedActivity] = useState<string>('none')
  const [activities, setActivities] = useState<CategoryRecord[]>([])
  const [selectedAsset, setSelectedAsset] = useState<string>(initialAssetId || 'none')
  const [queueId, setQueueId] = useState<string>('')
  const [queues, setQueues] = useState<QueueRecord[]>([])

  useEffect(() => {
    if (open) {
      setSelectedAsset(initialAssetId || 'none')
      Promise.all([getCategories().catch(() => []), getQueues().catch(() => [])]).then(
        ([cats, qs]) => {
          setActivities((cats as CategoryRecord[]).filter((c) => c.active !== false))
          setQueues((qs as QueueRecord[]).filter((q) => q.active !== false))
        },
      )
    }
  }, [open, initialAssetId])

  // Setores e Contatos da empresa
  const [departments, setDepartments] = useState<CompanyDepartmentRecord[]>([])
  const [contacts, setContacts] = useState<ClientContactRecord[]>([])
  const [contactsLoading, setContactsLoading] = useState(false)
  const [contactsLoadError, setContactsLoadError] = useState(false)
  const [selectedSector, setSelectedSector] = useState<string>('none')
  const [preferredContactId, setPreferredContactId] = useState<string>('')
  const [contactName, setContactName] = useState<string>(user?.name || '')
  const [contactEmail, setContactEmail] = useState<string>(user?.email || '')
  const [contactPhone, setContactPhone] = useState<string>(user?.phone || '')

  // Arquivo anexo vinculado
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [submitting, setSubmitting] = useState(false)

  // Equipamento localizado na coleção equipments que não consta nos assets (configuration_items):
  // é oferecido como opção extra no seletor e enviado no campo "equipment" do chamado.
  const [extraEquipment, setExtraEquipment] = useState<EquipmentRecord | null>(null)

  // Carrega setores e colaboradores da empresa.
  // Depende apenas de open/companyId — NUNCA do objeto `user`, que o pai recria
  // a cada render (literal no JSX); depender dele apagava a seleção do cliente.
  useEffect(() => {
    if (!open || !companyId) return

    getCompanyDepartments(companyId)
      .then((depts) => setDepartments(depts))
      .catch((e) => console.warn('Erro ao carregar setores:', e))

    setContactsLoading(true)
    setContactsLoadError(false)
    getClientContacts(companyId)
      .then((ctts) => {
        setContacts(ctts)
        setContactsLoadError(false)
      })
      .catch((e) => {
        console.warn('Erro ao carregar contatos da empresa:', e)
        setContacts([])
        setContactsLoadError(true)
      })
      .finally(() => setContactsLoading(false))
  }, [open, companyId])

  // Referência sempre atualizada do usuário: permite ler os dados dele dentro do
  // efeito de reset sem colocá-lo nas dependências (a identidade do objeto muda
  // a cada render do pai e não deve reiniciar o formulário).
  const userRef = useRef(user)
  userRef.current = user

  // Reseta o formulário SOMENTE na transição fechado -> aberto. Um re-render do
  // pai com o diálogo aberto (atualização de dados, refresh silencioso) não pode
  // apagar o setor e o contato que o cliente já escolheu.
  const wasOpenRef = useRef(false)
  useEffect(() => {
    const justOpened = open && !wasOpenRef.current
    wasOpenRef.current = open
    if (!justOpened) return

    // Reseta para o usuário logado
    const currentUser = userRef.current
    setContactName(currentUser?.name || '')
    setContactEmail(currentUser?.email || '')
    setContactPhone(currentUser?.phone || '')
    setSelectedSector('none')
    setPreferredContactId('')
    setSelectedActivity('none')
    setQueueId('')
    setSelectedFile(null)
    setExtraEquipment(null)
  }, [open])

  // Colaboradores exibidos no campo "Nome do contato":
  // sem setor -> todos os colaboradores da empresa; com setor -> somente os daquele setor.
  const collaboratorsForSector = useMemo(() => {
    if (selectedSector === 'none' || !selectedSector) return contacts
    return contacts.filter((c) => (c.departments || []).includes(selectedSector))
  }, [contacts, selectedSector])

  // Ao selecionar um setor: grava a escolha e refaz a lista de contatos do setor
  const handleSelectSector = (sectorId: string) => {
    setSelectedSector(sectorId)
    setPreferredContactId('')
  }

  // Normaliza texto para comparação tolerante (nomes de responsáveis em ativos podem conter traço, departamento ou acentos)
  const normalizeText = (v?: string | null) =>
    (v || '')
      .toString()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .trim()

  // Extrai o nome limpo descartando qualquer sufixo " — Departamento" ou " - Departamento"
  const cleanResponsibleName = (raw?: string | null): string => {
    if (!raw) return ''
    const parts = raw.split(/\s+[—–-]\s+/)
    return parts[0].trim()
  }

  // Verifica se o responsável do ativo bate com o contato selecionado (por id, nome exato ou primeiro+último nome)
  const matchAssetToContact = (
    asset: ConfigurationItemRecord | EquipmentRecord,
    targetId: string,
    targetName: string,
  ): boolean => {
    if (!targetName && !targetId) return false
    const rawResp = (
      (asset as any).responsible_user ||
      (asset as any).owner ||
      (asset as any).custodian ||
      (asset as any).user ||
      ''
    )
      .toString()
      .trim()
    if (!rawResp) return false

    // Se o campo guarda o ID do contato/usuário
    if (targetId && rawResp === targetId) return true

    const normTarget = normalizeText(targetName)
    const normRaw = normalizeText(rawResp)
    const normClean = normalizeText(cleanResponsibleName(rawResp))

    // Casamento exato ou do nome limpo antes do travessão do departamento
    if (normTarget && (normRaw === normTarget || normClean === normTarget)) return true

    // Casamento se o nome do contato estiver contido no responsável (ex: "Nome (Kairós)")
    if (normTarget && normTarget.length >= 4) {
      if (normClean.includes(normTarget) || normTarget.includes(normClean)) {
        return true
      }
    }

    return false
  }

  // Busca e seleciona o ativo vinculado a uma pessoa (pelo id e/ou nome)
  const findAndSelectAssetForPerson = async (personId: string, personName: string) => {
    if (!personName && !personId) return

    // 1) Busca nos ativos já carregados da empresa (props.assets)
    const matchedAsset = assets.find((a) => matchAssetToContact(a, personId, personName))
    if (matchedAsset) {
      setSelectedAsset(matchedAsset.id)
      return
    }

    // 2) Fallback: busca na coleção equipments da empresa
    try {
      const companyIdToSearch = companyId || user.company_id
      if (companyIdToSearch) {
        const equipments = await getEquipments({ company: companyIdToSearch })
        const matchedEquipment = equipments.find((eq) =>
          matchAssetToContact(eq, personId, personName),
        )
        if (matchedEquipment) {
          setExtraEquipment(matchedEquipment)
          setSelectedAsset(matchedEquipment.id)
          return
        }
      }
    } catch (e) {
      console.warn('Erro ao buscar equipamento do contato em equipments:', e)
    }

    // Se não encontrou ativo específico para a pessoa, limpa o ativo apenas se havia sido selecionado anteriormente
    setSelectedAsset('none')
  }

  // Ao selecionar um contato da lista
  const handleSelectContactOption = (contactId: string) => {
    setPreferredContactId(contactId)
    if (contactId === 'logged_user') {
      const uName = user.name || ''
      setContactName(uName)
      setContactEmail(user.email || '')
      setContactPhone(user.phone || '')
      findAndSelectAssetForPerson(user.id, uName)
      return
    }

    const found = contacts.find((c) => c.id === contactId)
    if (found) {
      setContactName(found.full_name)
      setContactEmail(found.email || user.email || '')
      setContactPhone(found.phone || found.cell_phone || user.phone || '')
      findAndSelectAssetForPerson(found.id, found.full_name)
    }
  }

  // Botão "Meu chamado": preenche automaticamente os dados do usuário logado
  const handleAutoFillMyTicket = async () => {
    setSelectedSector('none')
    setPreferredContactId('logged_user')
    const uName = user.name || ''
    setContactName(uName)
    setContactEmail(user.email || '')
    setContactPhone(user.phone || '')

    await findAndSelectAssetForPerson(user.id, uName)

    toast({
      title: 'Dados preenchidos',
      description: 'Setor, contato e equipamento foram preenchidos com os seus dados.',
    })
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0]
      // Limite de 20MB
      if (file.size > 20 * 1024 * 1024) {
        toast({
          title: 'Arquivo muito grande',
          description: 'O anexo deve ter no máximo 20MB.',
          variant: 'destructive',
        })
        return
      }
      setSelectedFile(file)
    }
  }

  const parentActivities = useMemo(() => {
    return activities.filter((a) => !a.parent && a.active !== false)
  }, [activities])

  const subActivitiesOfMain = useMemo(() => {
    if (!selectedMainCategory || selectedMainCategory === 'none') return []
    return activities.filter((a) => a.parent === selectedMainCategory && a.active !== false)
  }, [activities, selectedMainCategory])

  const handleSelectMainCategory = (mainId: string) => {
    setSelectedMainCategory(mainId)
    setSelectedActivity('none')
  }

  const handleSelectActivity = (activityId: string) => {
    setSelectedActivity(activityId)
    if (activityId && activityId !== 'none') {
      const act = activities.find((a) => a.id === activityId)
      if (act?.parent && act.parent !== selectedMainCategory) {
        setSelectedMainCategory(act.parent)
      }
      if (act?.type) {
        setType(act.type)
      }
      // Pré-seleção da equipe responsável vinculada à atividade ou à atividade pai
      const designatedQueue =
        act?.queue || (act?.parent ? activities.find((c) => c.id === act.parent)?.queue : undefined)
      if (designatedQueue) {
        setQueueId(designatedQueue)
      }
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!companyId) {
      toast({
        title: 'Empresa não vinculada',
        description: 'Seu usuário precisa estar associado a uma empresa para abrir chamados.',
        variant: 'destructive',
      })
      return
    }

    if (!queueId) {
      toast({
        title: 'Selecione a equipe responsável',
        description: 'É necessário direcionar o chamado para uma equipe de atendimento.',
        variant: 'destructive',
      })
      return
    }

    try {
      setSubmitting(true)

      const act = activities.find((a) => a.id === selectedActivity)
      const ticketCategory = act ? (act.parent ? act.parent : act.id) : undefined
      const ticketSubcategory = act && act.parent ? act.id : undefined
      const ticketType = act?.type || type || 'Incidente'
      const ticketImpact = act?.impact || 'Médio'
      const ticketUrgency = act?.urgency || 'Média'
      const ticketPriority = act?.priority || 'Média'

      const createdTicket = await createTicket({
        number: 'PENDENTE',
        company: companyId,
        unit: user.unit || undefined,
        department: selectedSector !== 'none' ? selectedSector : undefined,
        title: title.trim(),
        description: description.trim(),
        type: ticketType,
        category: ticketCategory,
        subcategory: ticketSubcategory,
        queue: queueId || undefined,
        impact: ticketImpact,
        urgency: ticketUrgency,
        priority: ticketPriority as any,
        status: 'Novo',
        requester_name: contactName.trim() || user.name || 'Solicitante do Portal',
        requester_email: contactEmail.trim() || user.email,
        requester_phone: contactPhone.trim() || user.phone || undefined,
        source: 'Portal',
        sla_status: 'Dentro do Prazo',
        configuration_item:
          selectedAsset &&
          selectedAsset !== 'none' &&
          assets.some((a) => a.id === selectedAsset && a.source_collection !== 'equipments')
            ? selectedAsset
            : undefined,
        equipment:
          selectedAsset && selectedAsset !== 'none'
            ? extraEquipment && selectedAsset === extraEquipment.id
              ? extraEquipment.id
              : assets.some((a) => a.id === selectedAsset && a.source_collection === 'equipments')
                ? selectedAsset
                : undefined
            : undefined,
      } as any)

      // Se houver anexo, faz o upload vinculado ao chamado criado
      if (selectedFile && createdTicket?.id) {
        try {
          await uploadAttachment(createdTicket.id, selectedFile, user.id)
        } catch (uploadErr) {
          console.warn('Erro ao fazer upload do anexo do portal:', uploadErr)
          toast({
            title: 'Chamado aberto, mas houve falha no anexo',
            description: 'O chamado foi criado com sucesso, mas o anexo não pôde ser salvo.',
            variant: 'destructive',
          })
        }
      }

      toast({
        title: 'Chamado aberto com sucesso!',
        description: `Sua solicitação foi vinculada à empresa ${companyName} e já está na fila de atendimento.`,
      })

      // Limpa campos
      setTitle('')
      setDescription('')
      setType('Incidente')
      setSelectedAsset('none')
      setExtraEquipment(null)
      setSelectedSector('none')
      setPreferredContactId('')
      setSelectedMainCategory('none')
      setSelectedActivity('none')
      setQueueId('')
      setSelectedFile(null)
      if (fileInputRef.current) fileInputRef.current.value = ''

      onOpenChange(false)
      onSuccess()
    } catch (err: any) {
      toast({
        title: 'Erro ao abrir chamado',
        description: err?.message || 'Falha ao registrar chamado no sistema.',
        variant: 'destructive',
      })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <PlusCircle className="h-5 w-5 text-amber-500" />
            Abrir Novo Chamado
          </DialogTitle>
          <DialogDescription>
            Sua solicitação será amarrada automaticamente à empresa{' '}
            <strong>{companyName || 'Sua Empresa'}</strong>.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-1">
          {/* Atalho: Meu chamado (visível apenas com a permissão "Atalho Meu chamado (Portal)" concedida) */}
          {canUseMyTicketShortcut && (
            <div className="flex justify-end">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleAutoFillMyTicket}
                className="text-xs gap-1.5 h-8 border-amber-500/50 text-amber-700 dark:text-amber-400 hover:bg-amber-500/10"
              >
                <UserCheck className="h-3.5 w-3.5" />
                Meu chamado
              </Button>
            </div>
          )}

          {/* Linha 1: Selecionar o Setor e Nome do Contato */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Selecionar o Setor */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                <Building2 className="h-3.5 w-3.5 text-amber-500" />
                Selecionar o Setor
              </label>
              <Select value={selectedSector} onValueChange={handleSelectSector}>
                <SelectTrigger className="text-xs h-9">
                  <SelectValue placeholder="Selecione o setor" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Geral / Sem setor específico</SelectItem>
                  {departments.map((d) => (
                    <SelectItem key={d.id} value={d.id}>
                      {d.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Nome do Contato */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <User className="h-3.5 w-3.5 text-amber-500" />
                  Nome do contato
                </span>
                <span className="text-[10px] text-muted-foreground font-normal">
                  Padrão: quem está logado
                </span>
              </label>

              <div className="space-y-1.5">
                <Select value={preferredContactId} onValueChange={handleSelectContactOption}>
                  <SelectTrigger className="text-xs h-9">
                    <SelectValue
                      placeholder={
                        selectedSector !== 'none' &&
                        !contactsLoading &&
                        collaboratorsForSector.length === 0
                          ? 'Nenhum colaborador no setor — contato será o usuário logado'
                          : 'Escolher colaborador do setor...'
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="logged_user">{user.name} (Meu usuário logado)</SelectItem>
                    {collaboratorsForSector.map((collab) => (
                      <SelectItem key={collab.id} value={collab.id}>
                        {collab.full_name} {collab.email ? `(${collab.email})` : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Input
                  placeholder="Nome do colaborador / contato"
                  value={contactName}
                  onChange={(e) => setContactName(e.target.value)}
                  className="text-xs h-8"
                />

                {selectedSector !== 'none' &&
                  !contactsLoading &&
                  collaboratorsForSector.length === 0 && (
                    <p className="text-[10px] text-amber-600 dark:text-amber-400 text-center leading-snug">
                      {contactsLoadError
                        ? 'Não foi possível carregar os colaboradores deste setor.'
                        : 'Nenhum colaborador cadastrado neste setor — o contato será o usuário logado.'}
                    </p>
                  )}
              </div>
            </div>
          </div>

          {/* Linha 2: Equipamento/Ativo Envolvido e Atividade do Catálogo */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                <Laptop className="h-3.5 w-3.5 text-amber-500" />
                Equipamento / Ativo Envolvido (Opcional)
              </label>
              <Select value={selectedAsset} onValueChange={setSelectedAsset}>
                <SelectTrigger className="text-xs h-9">
                  <SelectValue placeholder="Nenhum ativo específico" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nenhum ativo específico</SelectItem>
                  {assets.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.name} {a.serial_number ? `(${a.serial_number})` : ''}
                    </SelectItem>
                  ))}
                  {extraEquipment && !assets.some((a) => a.id === extraEquipment.id) && (
                    <SelectItem key={extraEquipment.id} value={extraEquipment.id}>
                      {extraEquipment.name}{' '}
                      {extraEquipment.serial_number ? `(${extraEquipment.serial_number})` : ''}
                    </SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                <Tag className="h-3.5 w-3.5 text-amber-500" />
                Atividade Principal *
              </label>
              <Select value={selectedMainCategory} onValueChange={handleSelectMainCategory}>
                <SelectTrigger className="text-xs h-9">
                  <SelectValue placeholder="Selecione a atividade principal" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Selecione uma atividade principal...</SelectItem>
                  {parentActivities.map((act) => (
                    <SelectItem key={act.id} value={act.id}>
                      {act.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Subatividade vinculada à Atividade Principal */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
              <Tag className="h-3.5 w-3.5 text-amber-500" />
              Subatividade do Catálogo *
            </label>
            <Select
              value={selectedActivity}
              onValueChange={handleSelectActivity}
              disabled={selectedMainCategory === 'none' || subActivitiesOfMain.length === 0}
            >
              <SelectTrigger className="text-xs h-9">
                <SelectValue
                  placeholder={
                    selectedMainCategory === 'none'
                      ? 'Selecione a atividade principal primeiro'
                      : subActivitiesOfMain.length === 0
                        ? 'Nenhuma subatividade cadastrada nesta atividade principal'
                        : 'Selecione a subatividade...'
                  }
                />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Selecione uma subatividade...</SelectItem>
                {subActivitiesOfMain.map((act) => (
                  <SelectItem key={act.id} value={act.id}>
                    {act.name} {act.type ? `(${act.type})` : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-[11px] text-muted-foreground">
              Lista somente as subatividades pertencentes à atividade principal selecionada.
            </p>
          </div>

          {/* Linha 2.1: Equipe Responsável (Obrigatória, pré-selecionada pela atividade) */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
              <Users className="h-3.5 w-3.5 text-amber-500" />
              Equipe Responsável (Fila de Atendimento) *
            </label>
            {queues.length === 0 ? (
              <div className="flex items-center gap-2 h-9 px-3 rounded-md border border-amber-200 bg-amber-50 dark:bg-amber-950/30 text-xs text-amber-700 dark:text-amber-300">
                <Inbox className="h-3.5 w-3.5 shrink-0" />
                Nenhuma equipe cadastrada em Gerenciamento de Filas
              </div>
            ) : (
              <Select value={queueId} onValueChange={setQueueId}>
                <SelectTrigger className="text-xs h-9">
                  <SelectValue placeholder="Selecione a equipe responsável *" />
                </SelectTrigger>
                <SelectContent>
                  {queues.map((q) => (
                    <SelectItem key={q.id} value={q.id}>
                      {q.name} {q.level ? `(${q.level})` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <p className="text-[11px] text-muted-foreground">
              Pré-selecionada automaticamente ao escolher a atividade do catálogo, permitindo troca.
            </p>
          </div>

          {/* Linha 3: Título */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-foreground">Título do Chamado</label>
            <Input
              required
              placeholder="Ex: Impressora do financeiro não conecta à rede"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="text-xs h-9"
            />
          </div>

          {/* Linha 4: Descrição detalhada */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-foreground">Descrição do Problema</label>
            <Textarea
              required
              rows={4}
              placeholder="Descreva detalhadamente o ocorrido, mensagens de erro que apareceram e o que foi feito..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="text-xs resize-none"
            />
          </div>

          {/* Linha 5: Anexo (upload de arquivo) */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-foreground flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Paperclip className="h-3.5 w-3.5 text-amber-500" />
                Anexo (Upload de arquivo)
              </span>
              <span className="text-[10px] text-muted-foreground">Opcional • até 20MB</span>
            </label>

            <div className="flex items-center gap-2">
              <input
                ref={fileInputRef}
                type="file"
                id="portal-ticket-attachment"
                onChange={handleFileChange}
                className="hidden"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                className="text-xs gap-1.5 h-8 border-dashed"
              >
                <Paperclip className="h-3.5 w-3.5" />
                {selectedFile ? 'Substituir Arquivo' : 'Selecionar Arquivo'}
              </Button>

              {selectedFile ? (
                <div className="flex items-center gap-2 bg-muted/60 px-2.5 py-1 rounded-md border text-xs text-foreground flex-1 truncate">
                  <FileIcon className="h-3.5 w-3.5 text-amber-500 flex-shrink-0" />
                  <span className="truncate flex-1 font-medium">{selectedFile.name}</span>
                  <span className="text-[10px] text-muted-foreground flex-shrink-0">
                    ({Math.round(selectedFile.size / 1024)} KB)
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedFile(null)
                      if (fileInputRef.current) fileInputRef.current.value = ''
                    }}
                    className="text-muted-foreground hover:text-rose-500 p-0.5"
                    title="Remover anexo"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ) : (
                <span className="text-xs text-muted-foreground">Nenhum arquivo selecionado.</span>
              )}
            </div>
          </div>

          {/* Informações do Solicitante e Empresa */}
          <div className="p-3 rounded-lg bg-muted/40 border text-xs text-muted-foreground flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-emerald-500" />
              <span>
                Ponto focal / Solicitante logado:{' '}
                <strong className="text-foreground">{user.name}</strong> ({user.email})
              </span>
            </div>
            <span className="font-medium text-amber-600 dark:text-amber-400">{companyName}</span>
          </div>

          <DialogFooter className="pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={submitting}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={submitting || !title.trim() || !description.trim()}
              className="bg-amber-600 hover:bg-amber-700 text-white"
            >
              {submitting ? 'Registrando Chamado...' : 'Abrir Chamado'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
