import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { KeyRound, Shield, Eye, EyeOff, Loader2 } from 'lucide-react'
import {
  VaultCredential,
  CredentialType,
  EnvironmentType,
  createVaultCredential,
  updateVaultCredential,
} from '@/services/vault'
import { CompanyRecord, getCompanies } from '@/services/companies'
import { ProfileRecord } from '@/types/profiles'
import { getProfiles } from '@/services/profiles'
import { useToast } from '@/hooks/use-toast'

interface CredentialDialogProps {
  open: boolean
  credential: VaultCredential | null
  onClose: () => void
  onSuccess: () => void
}

export function CredentialDialog({ open, credential, onClose, onSuccess }: CredentialDialogProps) {
  const { toast } = useToast()
  const isEditing = !!credential

  const [companies, setCompanies] = useState<CompanyRecord[]>([])
  const [profiles, setProfiles] = useState<ProfileRecord[]>([])
  const [loadingInitial, setLoadingInitial] = useState(false)
  const [saving, setSaving] = useState(false)

  // Campos do formulário
  const [companyId, setCompanyId] = useState('')
  const [type, setType] = useState<CredentialType>('Portal')
  const [name, setName] = useState('')
  const [environment, setEnvironment] = useState<EnvironmentType>('Produção')
  const [urlOrAddress, setUrlOrAddress] = useState('')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [notes, setNotes] = useState('')
  const [selectedProfiles, setSelectedProfiles] = useState<string[]>([])
  const [showPassword, setShowPassword] = useState(false)

  // Carregar empresas e perfis
  useEffect(() => {
    if (open) {
      setLoadingInitial(true)
      Promise.all([getCompanies(), getProfiles()])
        .then(([comps, profs]) => {
          setCompanies(comps)
          setProfiles(profs)
        })
        .catch(() => {})
        .finally(() => setLoadingInitial(false))
    }
  }, [open])

  // Preencher formulário ao abrir para edição ou resetar
  useEffect(() => {
    if (credential) {
      setCompanyId(credential.company || '')
      setType(credential.type || 'Portal')
      setName(credential.name || '')
      setEnvironment(credential.environment || 'Produção')
      setUrlOrAddress(credential.url_or_address || '')
      setUsername(credential.username || '')
      setPassword('') // Em edição, senha vazia significa manter a atual
      setNotes(credential.notes || '')
      setSelectedProfiles(credential.allowed_profiles || [])
      setShowPassword(false)
    } else {
      setCompanyId('')
      setType('Portal')
      setName('')
      setEnvironment('Produção')
      setUrlOrAddress('')
      setUsername('')
      setPassword('')
      setNotes('')
      setSelectedProfiles([])
      setShowPassword(false)
    }
  }, [credential, open])

  const toggleProfile = (profileId: string) => {
    setSelectedProfiles((prev) =>
      prev.includes(profileId) ? prev.filter((id) => id !== profileId) : [...prev, profileId],
    )
  }

  const handleSelectAllProfiles = () => {
    if (selectedProfiles.length === profiles.length) {
      setSelectedProfiles([])
    } else {
      setSelectedProfiles(profiles.map((p) => p.id))
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!companyId) {
      toast({ title: 'Selecione o cliente / empresa.', variant: 'destructive' })
      return
    }
    if (!name.trim()) {
      toast({ title: 'Informe o nome / identificação do item.', variant: 'destructive' })
      return
    }
    if (!username.trim()) {
      toast({ title: 'Informe o usuário / login da credencial.', variant: 'destructive' })
      return
    }
    if (!isEditing && !password) {
      toast({ title: 'Informe a senha da credencial.', variant: 'destructive' })
      return
    }

    setSaving(true)

    const selectedCompany = companies.find((c) => c.id === companyId)
    const clientName = selectedCompany?.trade_name || selectedCompany?.legal_name || ''

    try {
      if (isEditing && credential) {
        const updateData: any = {
          company: companyId,
          type,
          name: name.trim(),
          environment,
          url_or_address: urlOrAddress.trim(),
          username: username.trim(),
          notes: notes.trim(),
          allowed_profiles: selectedProfiles,
          client_name: clientName,
        }
        if (password) {
          updateData.password = password
        }

        await updateVaultCredential(credential.id, updateData)
        toast({ title: 'Credencial atualizada com sucesso!' })
      } else {
        await createVaultCredential({
          company: companyId,
          type,
          name: name.trim(),
          environment,
          url_or_address: urlOrAddress.trim(),
          username: username.trim(),
          password,
          notes: notes.trim(),
          allowed_profiles: selectedProfiles,
          client_name: clientName,
        })
        toast({ title: 'Credencial cadastrada no cofre com sucesso!' })
      }

      onSuccess()
      onClose()
    } catch (err: any) {
      toast({
        title: 'Erro ao salvar credencial',
        description: err?.message || 'Verifique os dados informados.',
        variant: 'destructive',
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400">
              <KeyRound className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-base font-semibold text-slate-900 dark:text-slate-100">
                {isEditing ? 'Editar Credencial do Cofre' : 'Cadastrar Nova Credencial no Cofre'}
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-500 mt-0.5">
                Armazene acessos a portais, equipamentos ou aplicações com controle de acesso por
                perfil
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          {/* Cliente e Tipo */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Cliente <span className="text-red-500">*</span>
              </Label>
              <Select value={companyId} onValueChange={setCompanyId}>
                <SelectTrigger className="itsm-select text-xs">
                  <SelectValue placeholder="Selecione o cliente..." />
                </SelectTrigger>
                <SelectContent className="max-h-60">
                  {companies.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.trade_name || c.legal_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Tipo de Item <span className="text-red-500">*</span>
              </Label>
              <Select value={type} onValueChange={(val: CredentialType) => setType(val)}>
                <SelectTrigger className="itsm-select text-xs">
                  <SelectValue placeholder="Tipo de item" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Portal">Portal (Web, Intranet, Painel)</SelectItem>
                  <SelectItem value="Equipamento">
                    Equipamento (Roteador, Switch, Servidor)
                  </SelectItem>
                  <SelectItem value="Aplicação">Aplicação / Banco de Dados / API</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Nome e Ambiente */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Nome / Identificação <span className="text-red-500">*</span>
              </Label>
              <Input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex: Portal do Cliente ERP, Switch Core N2..."
                className="itsm-input text-xs"
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Ambiente <span className="text-red-500">*</span>
              </Label>
              <Select
                value={environment}
                onValueChange={(val: EnvironmentType) => setEnvironment(val)}
              >
                <SelectTrigger className="itsm-select text-xs">
                  <SelectValue placeholder="Ambiente" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Produção">Produção</SelectItem>
                  <SelectItem value="Homologação">Homologação</SelectItem>
                  <SelectItem value="Teste">Teste</SelectItem>
                  <SelectItem value="Desenvolvimento">Desenvolvimento</SelectItem>
                  <SelectItem value="DR / Contingência">DR / Contingência</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* URL ou IP */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
              URL / Endereço / IP de Acesso (opcional)
            </Label>
            <Input
              type="text"
              value={urlOrAddress}
              onChange={(e) => setUrlOrAddress(e.target.value)}
              placeholder="Ex: https://portal.cliente.com.br ou 192.168.1.1:8443"
              className="itsm-input text-xs"
            />
          </div>

          {/* Usuário e Senha */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Usuário / Login <span className="text-red-500">*</span>
              </Label>
              <Input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Ex: admin, root, operador_suporte"
                className="itsm-input text-xs font-mono"
                required
              />
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Senha {isEditing ? '(deixe em branco para manter)' : ''}{' '}
                  {!isEditing && <span className="text-red-500">*</span>}
                </Label>
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="text-[10px] text-primary hover:underline flex items-center gap-1"
                >
                  {showPassword ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                  {showPassword ? 'Ocultar' : 'Exibir'}
                </button>
              </div>
              <Input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={isEditing ? '••••••••' : 'Digite a senha do item'}
                className="itsm-input text-xs font-mono"
                required={!isEditing}
              />
            </div>
          </div>

          {/* Atribuição de Perfis Autorizados */}
          <div className="space-y-2 pt-2 border-t border-slate-200 dark:border-slate-800">
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <Shield className="h-3.5 w-3.5 text-blue-600" />
                  Perfis de Operadores Autorizados a Visualizar
                </Label>
                <p className="text-[11px] text-slate-500">
                  Selecione quais perfis de operadores poderão consultar o usuário e a senha deste
                  item.
                </p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleSelectAllProfiles}
                className="text-[11px] h-7 px-2"
              >
                {selectedProfiles.length === profiles.length
                  ? 'Desmarcar todos'
                  : 'Selecionar todos'}
              </Button>
            </div>

            {loadingInitial ? (
              <p className="text-xs text-slate-400">Carregando perfis...</p>
            ) : profiles.length === 0 ? (
              <p className="text-xs text-slate-400">Nenhum perfil cadastrado.</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-40 overflow-y-auto p-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40">
                {profiles.map((p) => {
                  const checked = selectedProfiles.includes(p.id)
                  return (
                    <label
                      key={p.id}
                      className="flex items-center gap-2 p-1.5 rounded hover:bg-slate-100 dark:hover:bg-slate-800/80 cursor-pointer text-xs"
                    >
                      <Checkbox
                        checked={checked}
                        onCheckedChange={() => toggleProfile(p.id)}
                        id={`profile-${p.id}`}
                      />
                      <span className="font-medium text-slate-800 dark:text-slate-200 truncate">
                        {p.name}
                      </span>
                    </label>
                  )
                })}
              </div>
            )}
            <p className="text-[10px] text-slate-400 italic">
              * Nota: Administradores sempre possuem acesso irrestrito para gestão e visualização.
              Se nenhum perfil for marcado, o item ficará visível apenas para a gestão/admin.
            </p>
          </div>

          {/* Observações */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
              Observações / Instruções de Uso
            </Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Instruções adicionais, regras de expiração de senha, VPN necessária, etc."
              className="itsm-textarea text-xs min-h-[70px]"
            />
          </div>

          <DialogFooter className="pt-2">
            <Button type="button" variant="outline" size="sm" onClick={onClose} disabled={saving}>
              Cancelar
            </Button>
            <Button type="submit" size="sm" disabled={saving} className="bg-primary">
              {saving ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                  Salvando...
                </>
              ) : isEditing ? (
                'Salvar Alterações'
              ) : (
                'Cadastrar Credencial'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
