import React, { useState, useEffect, useRef } from 'react'
import { PlusCircle, Paperclip, ShieldCheck, Building2, User, X, FileIcon } from 'lucide-react'
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
import { useToast } from '@/hooks/use-toast'

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
  }
  assets: ConfigurationItemRecord[]
  onSuccess: () => void
}

export default function PortalNewTicketDialog({
  open,
  onOpenChange,
  companyId,
  companyName,
  user,
  assets,
  onSuccess,
}: PortalNewTicketDialogProps) {
  const { toast } = useToast()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [type, setType] = useState('Incidente')
  const [selectedAsset, setSelectedAsset] = useState<string>('')

  // Setores e Contatos da empresa
  const [departments, setDepartments] = useState<CompanyDepartmentRecord[]>([])
  const [contacts, setContacts] = useState<ClientContactRecord[]>([])
  const [selectedSector, setSelectedSector] = useState<string>('none')
  const [contactName, setContactName] = useState<string>(user?.name || '')
  const [contactEmail, setContactEmail] = useState<string>(user?.email || '')
  const [contactPhone, setContactPhone] = useState<string>(user?.phone || '')

  // Arquivo anexo vinculado
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [submitting, setSubmitting] = useState(false)

  // Carrega setores e colaboradores da empresa
  useEffect(() => {
    if (open && companyId) {
      getCompanyDepartments(companyId)
        .then((depts) => setDepartments(depts))
        .catch((e) => console.warn('Erro ao carregar setores:', e))

      getClientContacts(companyId)
        .then((ctts) => setContacts(ctts))
        .catch((e) => console.warn('Erro ao carregar contatos da empresa:', e))

      // Reseta para o usuário logado
      setContactName(user?.name || '')
      setContactEmail(user?.email || '')
      setContactPhone(user?.phone || '')
      setSelectedSector('none')
      setSelectedFile(null)
    }
  }, [open, companyId, user])

  // Colaboradores filtrados por setor
  const collaboratorsForSector = contacts.filter((c) => {
    if (selectedSector === 'none' || !selectedSector) return true
    // Se o contato tiver departamentos vinculados, confere
    if (c.departments && Array.isArray(c.departments)) {
      return c.departments.includes(selectedSector)
    }
    return true
  })

  // Ao selecionar um setor
  const handleSelectSector = (sectorId: string) => {
    setSelectedSector(sectorId)
    // Se o setor tiver colaboradores, o usuário pode selecionar ou manter
    // Caso haja apenas 1 colaborador daquele setor, pode sugerir, caso contrário mantém
  }

  // Ao selecionar um contato da lista do setor
  const handleSelectContactOption = (contactId: string) => {
    if (contactId === 'logged_user') {
      setContactName(user.name || '')
      setContactEmail(user.email || '')
      setContactPhone(user.phone || '')
      return
    }

    const found = contacts.find((c) => c.id === contactId)
    if (found) {
      setContactName(found.full_name)
      setContactEmail(found.email || user.email || '')
      setContactPhone(found.phone || found.cell_phone || user.phone || '')
    }
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

    try {
      setSubmitting(true)

      // Cria chamado SEM urgência (padrão Média) e SEM categoria (categorização será feita por IA/operador)
      const createdTicket = await createTicket({
        number: 'PENDENTE',
        company: companyId,
        unit: user.unit || undefined,
        department: selectedSector !== 'none' ? selectedSector : undefined,
        title: title.trim(),
        description: description.trim(),
        type,
        category: undefined, // Sem categoria no portal
        impact: 'Médio',
        urgency: 'Média', // Sem campo de urgência no portal
        priority: 'Média' as any,
        status: 'Novo',
        requester_name: contactName.trim() || user.name || 'Solicitante do Portal',
        requester_email: contactEmail.trim() || user.email,
        requester_phone: contactPhone.trim() || user.phone || undefined,
        source: 'Portal',
        sla_status: 'Dentro do Prazo',
        configuration_item: selectedAsset && selectedAsset !== 'none' ? selectedAsset : undefined,
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
      setSelectedAsset('')
      setSelectedSector('none')
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
          {/* Linha 1: Tipo de Solicitação e Ativo Envolvido */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">Tipo de Solicitação</label>
              <Select value={type} onValueChange={setType}>
                <SelectTrigger className="text-xs h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Incidente">Incidente (Algo parou de funcionar)</SelectItem>
                  <SelectItem value="Requisição de Serviço">
                    Requisição de Serviço (Solicitar algo novo)
                  </SelectItem>
                  <SelectItem value="Dúvida">Dúvida / Esclarecimento</SelectItem>
                  <SelectItem value="Visita Técnica">Visita Técnica Presencial</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">
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
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Linha 2: Selecionar o Setor e Nome do Contato */}
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

              {/* Se há colaboradores cadastrados no setor, permite selecionar da lista ou digitar */}
              {collaboratorsForSector.length > 0 ? (
                <div className="space-y-1.5">
                  <Select onValueChange={handleSelectContactOption}>
                    <SelectTrigger className="text-xs h-9">
                      <SelectValue placeholder="Escolher colaborador do setor..." />
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
                </div>
              ) : (
                <Input
                  required
                  placeholder="Nome do contato para este chamado"
                  value={contactName}
                  onChange={(e) => setContactName(e.target.value)}
                  className="text-xs h-9"
                />
              )}
            </div>
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
