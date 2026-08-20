import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  UserCheck,
  Loader2,
  AlertCircle,
  KeyRound,
  Shield,
  Phone,
  Mail,
  Building,
} from 'lucide-react'
import {
  OperatorItem,
  CreateOperatorData,
  UpdateOperatorData,
  OperatorType,
} from '@/types/operators'
import { ProfileRecord } from '@/types/profiles'

interface OperatorDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  operator: OperatorItem | null
  profiles: ProfileRecord[]
  teams: string[]
  onSave: (data: CreateOperatorData | UpdateOperatorData) => Promise<void>
}

export function OperatorDialog({
  open,
  onOpenChange,
  operator,
  profiles,
  teams,
  onSave,
}: OperatorDialogProps) {
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [passwordConfirm, setPasswordConfirm] = useState('')
  const [team, setTeam] = useState('')
  const [customTeam, setCustomTeam] = useState('')
  const [type, setType] = useState<OperatorType>('Interno')
  const [extension, setExtension] = useState('')
  const [mobile, setMobile] = useState('')
  const [profileId, setProfileId] = useState('')
  const [active, setActive] = useState(true)
  const [position, setPosition] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isEditing = !!operator

  useEffect(() => {
    if (open) {
      if (operator) {
        // Splitting full name if first_name is not yet populated
        const parts = (operator.name || '').split(' ')
        setFirstName(operator.first_name || parts[0] || '')
        setLastName(operator.last_name || parts.slice(1).join(' ') || '')
        setEmail(operator.email || '')
        setPassword('')
        setPasswordConfirm('')

        if (operator.team && teams.includes(operator.team)) {
          setTeam(operator.team)
          setCustomTeam('')
        } else if (operator.team) {
          setTeam('custom')
          setCustomTeam(operator.team)
        } else {
          setTeam(teams[0] || '')
          setCustomTeam('')
        }

        setType(operator.type || 'Interno')
        setExtension(operator.extension || '')
        setMobile(operator.mobile || operator.phone || '')
        setProfileId(operator.profile_id || '')
        setActive(operator.active ?? true)
        setPosition(operator.position || '')
      } else {
        setFirstName('')
        setLastName('')
        setEmail('')
        setPassword('Skip@Pass')
        setPasswordConfirm('Skip@Pass')
        setTeam(teams[0] || 'Suporte N1')
        setCustomTeam('')
        setType('Interno')
        setExtension('')
        setMobile('')
        // Pick default profile (e.g. Técnico N1 or first non-admin)
        const defaultProfile = profiles.find((p) => p.name === 'Técnico N1') || profiles[0]
        setProfileId(defaultProfile?.id || '')
        setActive(true)
        setPosition('Analista de Suporte')
      }
      setError(null)
    }
  }, [open, operator, profiles, teams])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!firstName.trim()) {
      setError('O Nome é obrigatório.')
      return
    }

    if (!email.trim() || !email.includes('@')) {
      setError('Insira um e-mail válido para login.')
      return
    }

    if (!isEditing && (!password || password.length < 8)) {
      setError('A senha deve conter no mínimo 8 caracteres.')
      return
    }

    if (!isEditing && password !== passwordConfirm) {
      setError('As senhas digitadas não coincidem.')
      return
    }

    const finalTeam = team === 'custom' ? customTeam.trim() : team

    // Map profile to legacy role for PB hooks compatibility
    const selectedProfile = profiles.find((p) => p.id === profileId)
    let mappedRole = 'tecnico'
    if (selectedProfile?.is_system || selectedProfile?.name.toLowerCase().includes('admin')) {
      mappedRole = 'admin'
    } else if (
      selectedProfile?.name.toLowerCase().includes('supervisor') ||
      selectedProfile?.name.toLowerCase().includes('gestor')
    ) {
      mappedRole = 'gestor'
    }

    try {
      setSaving(true)
      setError(null)

      const payload: any = {
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        email: email.trim().toLowerCase(),
        team: finalTeam,
        type,
        extension: extension.trim(),
        mobile: mobile.trim(),
        phone: mobile.trim(),
        profile_id: profileId,
        role: mappedRole,
        active,
        position: position.trim() || 'Operador',
      }

      if (!isEditing) {
        payload.password = password
        payload.passwordConfirm = passwordConfirm
      }

      await onSave(payload)
      onOpenChange(false)
    } catch (err: any) {
      setError(err?.message || 'Erro ao salvar operador. Verifique os dados inseridos.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col p-0 gap-0 overflow-hidden">
        <DialogHeader className="px-6 pt-6 pb-4 border-b border-border bg-card">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300">
              <UserCheck className="h-6 w-6" />
            </div>
            <div>
              <DialogTitle className="text-xl font-bold">
                {isEditing ? `Editar Operador: ${operator.name}` : 'Cadastrar Novo Operador'}
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                {isEditing
                  ? 'Atualize os dados cadastrais, perfil de acesso e configurações do operador.'
                  : 'Crie uma nova conta de operador com acesso ao sistema PocketBase.'}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex-1 flex flex-col min-h-0">
          <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
            {error && (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-red-50 text-red-700 border border-red-200 text-xs dark:bg-red-950/50 dark:border-red-900 dark:text-red-300">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* Identificação */}
            <div className="space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Dados Pessoais & Login
              </h4>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="first-name" className="text-xs font-semibold">
                    Nome <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="first-name"
                    required
                    placeholder="Ex: Carlos"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    disabled={saving}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="last-name" className="text-xs font-semibold">
                    Sobrenome
                  </Label>
                  <Input
                    id="last-name"
                    placeholder="Ex: Eduardo Silva"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    disabled={saving}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="email" className="text-xs font-semibold flex items-center gap-1.5">
                  <Mail className="h-3.5 w-3.5 text-muted-foreground" />
                  E-mail de Acesso (Login) <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="email"
                  type="email"
                  required
                  placeholder="operador@empresa.com.br"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={saving}
                />
              </div>

              {/* Senha no cadastro */}
              {!isEditing && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 rounded-xl bg-muted/40 border border-border">
                  <div className="space-y-1.5">
                    <Label
                      htmlFor="pass"
                      className="text-xs font-semibold flex items-center gap-1.5"
                    >
                      <KeyRound className="h-3.5 w-3.5 text-muted-foreground" />
                      Senha Inicial <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      id="pass"
                      type="password"
                      required
                      placeholder="Mínimo 8 caracteres"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      disabled={saving}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="pass-confirm" className="text-xs font-semibold">
                      Confirmar Senha <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      id="pass-confirm"
                      type="password"
                      required
                      placeholder="Repita a senha"
                      value={passwordConfirm}
                      onChange={(e) => setPasswordConfirm(e.target.value)}
                      disabled={saving}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Atribuição e Perfil */}
            <div className="space-y-3 pt-2 border-t border-border">
              <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Perfil de Acesso & Equipe
              </h4>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label
                    htmlFor="profile"
                    className="text-xs font-semibold flex items-center gap-1.5"
                  >
                    <Shield className="h-3.5 w-3.5 text-muted-foreground" />
                    Perfil de Acesso <span className="text-red-500">*</span>
                  </Label>
                  <Select value={profileId} onValueChange={setProfileId} disabled={saving}>
                    <SelectTrigger id="profile">
                      <SelectValue placeholder="Selecione um perfil..." />
                    </SelectTrigger>
                    <SelectContent>
                      {profiles.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          <div className="flex items-center gap-2">
                            <span>{p.name}</span>
                            {p.is_system && (
                              <span className="text-[10px] text-amber-600 dark:text-amber-400 font-medium">
                                (Admin)
                              </span>
                            )}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="position" className="text-xs font-semibold">
                    Cargo / Função
                  </Label>
                  <Input
                    id="position"
                    placeholder="Ex: Analista de Suporte N2"
                    value={position}
                    onChange={(e) => setPosition(e.target.value)}
                    disabled={saving}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="team" className="text-xs font-semibold">
                    Equipe de Atuação
                  </Label>
                  <Select value={team} onValueChange={setTeam} disabled={saving}>
                    <SelectTrigger id="team">
                      <SelectValue placeholder="Selecione a equipe..." />
                    </SelectTrigger>
                    <SelectContent>
                      {teams.map((t) => (
                        <SelectItem key={t} value={t}>
                          {t}
                        </SelectItem>
                      ))}
                      <SelectItem value="custom">+ Outra equipe...</SelectItem>
                    </SelectContent>
                  </Select>

                  {team === 'custom' && (
                    <Input
                      placeholder="Digite o nome da equipe..."
                      value={customTeam}
                      onChange={(e) => setCustomTeam(e.target.value)}
                      className="mt-2 text-xs"
                      disabled={saving}
                    />
                  )}
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="type" className="text-xs font-semibold">
                    Tipo de Atendimento
                  </Label>
                  <Select
                    value={type}
                    onValueChange={(v) => setType(v as OperatorType)}
                    disabled={saving}
                  >
                    <SelectTrigger id="type">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Interno">Interno (Service Desk / Mesa)</SelectItem>
                      <SelectItem value="Externo">Externo (Campo / Visitas Técnicas)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {/* Contato & Telefonia */}
            <div className="space-y-3 pt-2 border-t border-border">
              <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Contato & Ramal
              </h4>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label
                    htmlFor="extension"
                    className="text-xs font-semibold flex items-center gap-1.5"
                  >
                    <Phone className="h-3.5 w-3.5 text-muted-foreground" />
                    Ramal
                  </Label>
                  <Input
                    id="extension"
                    placeholder="Ex: 4022"
                    value={extension}
                    onChange={(e) => setExtension(e.target.value)}
                    disabled={saving}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label
                    htmlFor="mobile"
                    className="text-xs font-semibold flex items-center gap-1.5"
                  >
                    <Phone className="h-3.5 w-3.5 text-muted-foreground" />
                    Celular / WhatsApp
                  </Label>
                  <Input
                    id="mobile"
                    placeholder="(11) 98765-4321"
                    value={mobile}
                    onChange={(e) => setMobile(e.target.value)}
                    disabled={saving}
                  />
                </div>
              </div>
            </div>

            {/* Status Ativo */}
            <div className="flex items-center justify-between p-3 rounded-xl bg-muted/40 border border-border">
              <div className="space-y-0.5">
                <Label htmlFor="active-toggle" className="text-xs font-semibold cursor-pointer">
                  Status da Conta
                </Label>
                <p className="text-[11px] text-muted-foreground">
                  Operadores inativos não conseguem realizar login nem receber chamados.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span
                  className={`text-xs font-medium ${active ? 'text-emerald-600' : 'text-slate-400'}`}
                >
                  {active ? 'Ativo' : 'Inativo'}
                </span>
                <Switch
                  id="active-toggle"
                  checked={active}
                  onCheckedChange={setActive}
                  disabled={saving}
                />
              </div>
            </div>
          </div>

          <DialogFooter className="px-6 py-3 border-t border-border bg-card flex justify-between items-center">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={saving}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold"
              disabled={saving}
            >
              {saving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Salvando...
                </>
              ) : isEditing ? (
                'Salvar Alterações'
              ) : (
                'Cadastrar Operador'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
