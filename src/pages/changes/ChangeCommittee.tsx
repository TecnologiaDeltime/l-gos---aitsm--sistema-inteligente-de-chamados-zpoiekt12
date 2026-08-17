import { useEffect, useMemo, useState } from 'react'
import {
  Users,
  Plus,
  Trash2,
  Pencil,
  Building2,
  Crown,
  ShieldAlert,
  ShieldCheck,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Check } from 'lucide-react'
import {
  getCommittees,
  createCommittee,
  updateCommittee,
  deleteCommittee,
  MAX_MEMBERS_BY_TYPE,
  VOTING_RULE_BY_TYPE,
  type ChangeCommitteeRecord,
} from '@/services/change-committee'
import { getCompanies, type CompanyRecord } from '@/services/companies'
import { getUsers, type UserItem } from '@/services/users'
import pb from '@/lib/pocketbase/client'
import type { ClientContactRecord } from '@/services/client-contacts'
import { useRealtime } from '@/hooks/use-realtime'
import { useToast } from '@/hooks/use-toast'

type CommitteeType = 'Emergencial' | 'Padrão'

interface MemberOption {
  id: string
  name: string
  origin: 'Operador' | 'Ponto Focal' | 'Colaborador'
  rawType: 'user' | 'client_contact'
  email?: string
}

interface GroupedCommittees {
  company: CompanyRecord
  committees: ChangeCommitteeRecord[]
}

export default function ChangeCommittee() {
  const { toast } = useToast()
  const [committees, setCommittees] = useState<ChangeCommitteeRecord[]>([])
  const [companies, setCompanies] = useState<CompanyRecord[]>([])
  const [users, setUsers] = useState<UserItem[]>([])
  const [contacts, setContacts] = useState<ClientContactRecord[]>([])
  const [open, setOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<ChangeCommitteeRecord | null>(null)

  // form state
  const [committeeType, setCommitteeType] = useState<CommitteeType>('Padrão')
  const [companyId, setCompanyId] = useState('')
  const [name, setName] = useState('')
  const [desc, setDesc] = useState('')
  const [chairperson, setChairperson] = useState('')
  const [selectedMembers, setSelectedMembers] = useState<string[]>([])
  const [memberType, setMemberType] = useState<Record<string, 'user' | 'client_contact'>>({})
  const [active, setActive] = useState(true)
  const [votingDeadlineHours, setVotingDeadlineHours] = useState(48)
  const [saving, setSaving] = useState(false)

  const loadData = () => {
    getCommittees()
      .then(setCommittees)
      .catch(() => {})
    getCompanies()
      .then(setCompanies)
      .catch(() => {})
    getUsers()
      .then(setUsers)
      .catch(() => {})
    pb.collection('client_contacts')
      .getFullList<ClientContactRecord>({ sort: 'full_name' })
      .then(setContacts)
      .catch(() => {})
  }
  useEffect(() => {
    loadData()
  }, [])
  useRealtime('change_committee', () => loadData())

  // Member options for the selected company
  const memberOptions: MemberOption[] = useMemo(() => {
    if (!companyId) return []
    const ops: MemberOption[] = []
    users
      .filter(
        (u) =>
          u.company === companyId &&
          (u.role === 'admin' || u.role === 'gestor' || u.role === 'tecnico'),
      )
      .forEach((u) =>
        ops.push({
          id: u.id,
          name: u.name || u.email,
          origin: 'Operador',
          rawType: 'user',
          email: u.email,
        }),
      )
    contacts
      .filter((c) => c.client === companyId)
      .forEach((c) =>
        ops.push({
          id: c.id,
          name: c.full_name,
          origin: c.is_focal_point ? 'Ponto Focal' : 'Colaborador',
          rawType: 'client_contact',
          email: c.email,
        }),
      )
    return ops.sort((a, b) => a.name.localeCompare(b.name))
  }, [companyId, users, contacts])

  const maxMembers = MAX_MEMBERS_BY_TYPE[committeeType]

  const grouped: GroupedCommittees[] = useMemo(() => {
    const map = new Map<string, GroupedCommittees>()
    companies.forEach((c) => {
      map.set(c.id, { company: c, committees: [] })
    })
    committees.forEach((c) => {
      const key = c.company || ''
      if (!map.has(key)) {
        // empresa desconhecida — cria entrada genérica
        map.set(key, {
          company: {
            id: key,
            trade_name: 'Empresa removida',
            legal_name: '',
            code: '',
            document: '',
          } as CompanyRecord,
          committees: [],
        })
      }
      map.get(key)!.committees.push(c)
    })
    return Array.from(map.values()).filter((g) => g.committees.length > 0)
  }, [committees, companies])

  const openNew = () => {
    setEditTarget(null)
    setCommitteeType('Padrão')
    setCompanyId('')
    setName('')
    setDesc('')
    setChairperson('')
    setSelectedMembers([])
    setMemberType({})
    setActive(true)
    setVotingDeadlineHours(48)
    setOpen(true)
  }

  const openEdit = (c: ChangeCommitteeRecord) => {
    setEditTarget(c)
    setCommitteeType((c.committee_type as CommitteeType) || 'Padrão')
    setCompanyId(c.company || '')
    setName(c.name || '')
    setDesc(c.description || '')
    setChairperson(c.chairperson || '')
    setSelectedMembers(c.members || [])
    setMemberType(c.member_type || {})
    setActive(c.active ?? true)
    setVotingDeadlineHours(c.voting_deadline_hours ?? 48)
    setOpen(true)
  }

  const handleTypeChange = (t: CommitteeType) => {
    setCommitteeType(t)
    // ajustar max_members em runtime: se exceder, cortar
    const limit = MAX_MEMBERS_BY_TYPE[t]
    if (selectedMembers.length > limit) {
      const trimmed = selectedMembers.slice(0, limit)
      const newMt: Record<string, 'user' | 'client_contact'> = {}
      trimmed.forEach((id) => {
        newMt[id] = memberType[id] || 'user'
      })
      setSelectedMembers(trimmed)
      setMemberType(newMt)
      // remover chairperson se foi cortado
      if (chairperson && !trimmed.includes(chairperson)) setChairperson('')
    }
    // sugerir nome automático se vazio
    if (!name.trim()) {
      const comp = companies.find((x) => x.id === companyId)
      if (comp) {
        setName(`Comitê ${t} - ${comp.trade_name}`)
      }
    }
  }

  const handleCompanyChange = (id: string) => {
    setCompanyId(id)
    // limpar membros e presidente (outra empresa)
    setSelectedMembers([])
    setMemberType({})
    setChairperson('')
    // sugerir nome
    const comp = companies.find((x) => x.id === id)
    if (comp && (!name.trim() || name.startsWith('Comitê '))) {
      setName(`Comitê ${committeeType} - ${comp.trade_name}`)
    }
  }

  const toggleMember = (id: string, rawType: 'user' | 'client_contact') => {
    if (selectedMembers.includes(id)) {
      setSelectedMembers(selectedMembers.filter((m) => m !== id))
      const nm = { ...memberType }
      delete nm[id]
      setMemberType(nm)
      if (chairperson === id) setChairperson('')
    } else {
      if (selectedMembers.length >= maxMembers) {
        toast({
          title: `Limite atingido`,
          description: `Máximo de ${maxMembers} membros para comitê ${committeeType}.`,
          variant: 'destructive',
        })
        return
      }
      setSelectedMembers([...selectedMembers, id])
      setMemberType({ ...memberType, [id]: rawType })
    }
  }

  // valida: não permitir 2 comitês do mesmo tipo para a mesma empresa
  const duplicateCheck = useMemo(() => {
    if (!companyId) return false
    return committees.some(
      (c) =>
        c.company === companyId && c.committee_type === committeeType && c.id !== editTarget?.id,
    )
  }, [committees, companyId, committeeType, editTarget])

  const canSave =
    !!companyId &&
    !!committeeType &&
    selectedMembers.length === maxMembers &&
    !!chairperson &&
    !duplicateCheck

  const handleSave = async () => {
    if (!canSave) {
      toast({
        title: 'Preencha todos os campos',
        description: `Selecione empresa, presidente e exatamente ${maxMembers} membros.`,
        variant: 'destructive',
      })
      return
    }
    setSaving(true)
    try {
      const payload: Partial<ChangeCommitteeRecord> = {
        name: name.trim() || `Comitê ${committeeType}`,
        description: desc,
        committee_type: committeeType,
        company: companyId,
        max_members: maxMembers,
        voting_rule: VOTING_RULE_BY_TYPE[committeeType],
        members: selectedMembers,
        chairperson,
        member_type: memberType,
        active,
        voting_deadline_hours: votingDeadlineHours,
      }
      if (editTarget) {
        await updateCommittee(editTarget.id, payload)
        toast({ title: 'Comitê atualizado!' })
      } else {
        await createCommittee(payload)
        toast({ title: 'Comitê criado!' })
      }
      setOpen(false)
      loadData()
    } catch (err: any) {
      toast({
        title: 'Erro ao salvar',
        description: err?.message || '',
        variant: 'destructive',
      })
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    try {
      await deleteCommittee(id)
      toast({ title: 'Comitê removido' })
      loadData()
    } catch {
      toast({ title: 'Erro ao remover', variant: 'destructive' })
    }
  }

  // opções de presidente: qualquer pessoa da empresa selecionada
  const chairOptions = memberOptions

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold flex items-center gap-2">
          <Users className="h-5 w-5" /> Comitês de Mudanças
        </h2>
        <Button size="sm" onClick={openNew}>
          <Plus className="mr-1 h-4 w-4" /> Novo Comitê
        </Button>
      </div>

      {grouped.length === 0 && (
        <p className="text-center text-sm text-slate-500 py-8">
          Nenhum comitê cadastrado. Crie um comitê para cada empresa (Emergencial e Padrão).
        </p>
      )}

      {grouped.map((g) => (
        <div key={g.company.id || 'unknown'} className="space-y-2">
          <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
            <Building2 className="h-4 w-4" /> {g.company.trade_name || g.company.legal_name}
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            {g.committees.map((c) => {
              const isEmerg = c.committee_type === 'Emergencial'
              const limit = c.max_members || (isEmerg ? 3 : 5)
              const count = (c.members || []).length
              return (
                <div key={c.id} className="rounded-xl border bg-card p-4 shadow-sm space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {isEmerg ? (
                        <ShieldAlert className="h-4 w-4 text-green-600" />
                      ) : (
                        <ShieldCheck className="h-4 w-4 text-blue-600" />
                      )}
                      <h3 className="font-semibold text-sm">{c.name}</h3>
                    </div>
                    <Badge
                      className={
                        isEmerg
                          ? 'bg-green-100 text-green-700 hover:bg-green-100'
                          : 'bg-blue-100 text-blue-700 hover:bg-blue-100'
                      }
                    >
                      {c.committee_type || 'Padrão'}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {c.description || 'Sem descrição'}
                  </p>
                  <div className="flex items-center gap-2 text-xs">
                    <Crown className="h-3.5 w-3.5 text-amber-500" />
                    <span className="text-muted-foreground">Presidente:</span>
                    <span className="font-medium">
                      {c.expand?.chairperson?.name ||
                        chairOptions.find((o) => o.id === c.chairperson)?.name ||
                        '—'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Membros</span>
                    <Badge variant="outline" className="text-[10px]">
                      {count}/{limit}
                    </Badge>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {(c.expand?.members || []).slice(0, 5).map((m: any) => (
                      <Badge key={m.id} variant="outline" className="text-[10px]">
                        {m.name}
                      </Badge>
                    ))}
                    {(c.expand?.members || []).length > 5 && (
                      <Badge variant="outline" className="text-[10px]">
                        +{(c.expand?.members || []).length - 5}
                      </Badge>
                    )}
                  </div>
                  <div className="text-[10px] text-muted-foreground">
                    Regra:{' '}
                    {c.voting_rule || (isEmerg ? 'Presidente Unilateral' : 'Maioria Simples')}
                  </div>
                  <div className="text-[10px] text-muted-foreground">
                    Prazo: {c.voting_deadline_hours ? c.voting_deadline_hours + 'h' : '48h'}
                  </div>
                  <div className="flex justify-end gap-1 pt-1 border-t">
                    <Button size="sm" variant="ghost" onClick={() => openEdit(c)}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => handleDelete(c.id)}>
                      <Trash2 className="h-3.5 w-3.5 text-red-500" />
                    </Button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      ))}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editTarget ? 'Editar Comitê' : 'Novo Comitê'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Tipo do Comitê</Label>
                <Select
                  value={committeeType}
                  onValueChange={(v) => handleTypeChange(v as CommitteeType)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Emergencial">Emergencial (3 membros)</SelectItem>
                    <SelectItem value="Padrão">Padrão (5 membros)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Empresa *</Label>
                <Select value={companyId} onValueChange={handleCompanyChange}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione a empresa" />
                  </SelectTrigger>
                  <SelectContent>
                    {companies.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.trade_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {duplicateCheck && (
              <p className="text-xs text-red-600">
                Já existe um comitê {committeeType} para esta empresa.
              </p>
            )}

            <div>
              <Label className="text-xs">Nome</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">Descrição</Label>
              <Textarea value={desc} onChange={(e) => setDesc(e.target.value)} rows={2} />
            </div>

            <div>
              <Label className="text-xs">Presidente *</Label>
              <Select value={chairperson} onValueChange={setChairperson} disabled={!companyId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o presidente" />
                </SelectTrigger>
                <SelectContent>
                  {chairOptions.map((o) => (
                    <SelectItem key={o.id} value={o.id}>
                      {o.name} ({o.origin})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <Label className="text-xs">
                  Membros *{' '}
                  <span className="text-muted-foreground">
                    (Operadores, Pontos Focais e Colaboradores)
                  </span>
                </Label>
                <Badge variant="outline" className="text-[10px]">
                  {selectedMembers.length}/{maxMembers} selecionados
                </Badge>
              </div>
              {!companyId ? (
                <p className="text-xs text-slate-400 py-3 text-center border rounded-md">
                  Selecione uma empresa para listar as pessoas.
                </p>
              ) : (
                <ScrollArea className="h-48 rounded-md border">
                  <div className="p-1 space-y-0.5">
                    {memberOptions.length === 0 && (
                      <p className="text-center text-xs text-slate-400 py-4">
                        Nenhuma pessoa encontrada para esta empresa.
                      </p>
                    )}
                    {memberOptions.map((opt) => {
                      const checked = selectedMembers.includes(opt.id)
                      const disabled = !checked && selectedMembers.length >= maxMembers
                      return (
                        <div
                          key={opt.id}
                          className={
                            'flex items-center gap-2 px-2 py-1.5 rounded text-sm cursor-pointer ' +
                            (checked ? 'bg-primary/10' : 'hover:bg-slate-100') +
                            (disabled ? ' opacity-50 pointer-events-none' : '')
                          }
                          onClick={() => toggleMember(opt.id, opt.rawType)}
                        >
                          <div className="h-4 w-4 rounded border border-slate-300 flex items-center justify-center shrink-0">
                            {checked && <Check className="h-3 w-3" />}
                          </div>
                          <div className="flex-1 truncate">{opt.name}</div>
                          <Badge
                            variant="secondary"
                            className={
                              'text-[9px] ' +
                              (opt.origin === 'Operador'
                                ? 'bg-purple-100 text-purple-700'
                                : opt.origin === 'Ponto Focal'
                                  ? 'bg-amber-100 text-amber-700'
                                  : 'bg-slate-100 text-slate-600')
                            }
                          >
                            {opt.origin}
                          </Badge>
                        </div>
                      )
                    })}
                  </div>
                </ScrollArea>
              )}
            </div>

            <div className="flex items-center gap-2">
              <Switch checked={active} onCheckedChange={setActive} />
              <Label className="text-xs">Ativo</Label>
            </div>

            <div>
              <Label className="text-xs">Prazo de Votação (horas)</Label>
              <Input
                type="number"
                min={1}
                value={votingDeadlineHours}
                onChange={(e) =>
                  setVotingDeadlineHours(Math.max(1, parseInt(e.target.value || '48', 10) || 48))
                }
              />
              <p className="text-[10px] text-muted-foreground mt-1">
                Tempo que os membros têm para votar após a RDM ser enviada para aprovação. Padrão:
                48h.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={!canSave || saving}>
              {saving ? 'Salvando...' : 'Salvar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
