import { useState, useMemo } from 'react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Check, ChevronsUpDown, Search, User, X, Mail, Phone, Building2 } from 'lucide-react'
import type { ClientContactRecord } from '@/services/client-contacts'

export interface ResponsibleUserComboboxProps {
  /**
   * Lista de colaboradores disponíveis para seleção (geralmente da empresa do ativo ou geral).
   */
  contacts: ClientContactRecord[]
  /**
   * Valor atual de texto armazenado em responsible_user (ex: "FERNANDO PINCELLI DA MATA" ou nome legado).
   */
  value?: string
  /**
   * Callback disparado ao alterar o responsável.
   * Retorna o nome textual do responsável e, se houver colaborador correspondente, o objeto completo do contato.
   */
  onChange: (fullName: string, contact?: ClientContactRecord) => void
  /**
   * Texto de placeholder quando vazio.
   */
  placeholder?: string
  /**
   * Se o campo está desabilitado.
   */
  disabled?: boolean
  /**
   * Classes extras para o gatilho.
   */
  className?: string
  /**
   * Se deve permitir digitar um valor de texto livre personalizado caso o usuário não esteja na lista.
   * Default: true (mantém total compatibilidade com legados e casos especiais).
   */
  allowCustomText?: boolean
  /**
   * Informação complementar da empresa (nome) para exibição de contexto quando relevante.
   */
  companyName?: string
}

export function ResponsibleUserCombobox({
  contacts = [],
  value = '',
  onChange,
  placeholder = 'Buscar colaborador responsável...',
  disabled = false,
  className = '',
  allowCustomText = true,
  companyName,
}: ResponsibleUserComboboxProps) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')

  // Encontra se o valor atual bate exatamente com algum colaborador cadastrado
  const matchedContact = useMemo(() => {
    if (!value) return undefined
    const clean = value.trim().toLowerCase()
    return contacts.find(
      (c) =>
        c.full_name?.trim().toLowerCase() === clean ||
        c.id === value ||
        (c.email && c.email.trim().toLowerCase() === clean),
    )
  }, [contacts, value])

  // Filtra colaboradores por nome, e-mail ou telefone
  const filteredContacts = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return contacts
    return contacts.filter((c) => {
      const name = (c.full_name || '').toLowerCase()
      const email = (c.email || '').toLowerCase()
      const phone = (c.phone || c.cell_phone || '').toLowerCase()
      return name.includes(q) || email.includes(q) || phone.includes(q)
    })
  }, [contacts, search])

  const handleSelectContact = (contact: ClientContactRecord) => {
    onChange(contact.full_name || '', contact)
    setOpen(false)
    setSearch('')
  }

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation()
    onChange('', undefined)
    setSearch('')
  }

  const handleUseCustomText = () => {
    if (!search.trim()) return
    onChange(search.trim(), undefined)
    setOpen(false)
    setSearch('')
  }

  const displayLabel = value || ''
  const isCustomValue = !!value && !matchedContact

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={`h-8 w-full justify-between text-left text-sm font-normal border-input bg-background hover:bg-accent hover:text-accent-foreground ${
            !displayLabel ? 'text-muted-foreground' : 'text-foreground'
          } ${className}`}
        >
          <div className="flex items-center gap-2 flex-1 truncate">
            <User className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            {displayLabel ? (
              <span className="truncate font-medium flex items-center gap-1.5">
                <span>{displayLabel}</span>
                {isCustomValue && (
                  <span className="text-[10px] uppercase font-semibold tracking-wider px-1.5 py-0.2 rounded bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20">
                    Manual
                  </span>
                )}
                {matchedContact?.is_focal_point && (
                  <span className="text-[10px] uppercase font-semibold tracking-wider px-1.5 py-0.2 rounded bg-primary/10 text-primary border border-primary/20">
                    Ponto Focal
                  </span>
                )}
              </span>
            ) : (
              <span className="text-muted-foreground text-xs">{placeholder}</span>
            )}
          </div>
          <div className="flex items-center gap-1 shrink-0 ml-1">
            {displayLabel && !disabled && (
              <span
                role="button"
                tabIndex={0}
                onClick={handleClear}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    onChange('', undefined)
                  }
                }}
                className="p-0.5 rounded-full hover:bg-muted text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                title="Limpar responsável"
              >
                <X className="h-3.5 w-3.5" />
              </span>
            )}
            <ChevronsUpDown className="h-3.5 w-3.5 opacity-50" />
          </div>
        </Button>
      </PopoverTrigger>

      <PopoverContent
        className="w-[--radix-popover-trigger-width] min-w-[320px] p-0 shadow-lg border-border"
        align="start"
      >
        <div className="p-2 border-b bg-muted/40">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              autoFocus
              placeholder="Buscar colaborador por nome, e-mail..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-8 pl-8 text-xs bg-background"
            />
          </div>
          {companyName && (
            <p className="text-[11px] text-muted-foreground mt-1.5 px-1 flex items-center gap-1">
              <Building2 className="h-3 w-3 shrink-0" />
              Empresa:{' '}
              <strong className="font-semibold text-foreground truncate">{companyName}</strong>
            </p>
          )}
        </div>

        <ScrollArea className="max-h-60 overflow-y-auto">
          <div className="p-1 space-y-0.5">
            {contacts.length === 0 ? (
              <div className="p-4 text-center text-xs text-muted-foreground space-y-1">
                <p>Nenhum colaborador cadastrado para esta empresa.</p>
                <p className="text-[11px] text-slate-400">
                  Cadastre em <strong>Clientes → Colaboradores</strong> ou digite um nome manual
                  abaixo.
                </p>
              </div>
            ) : filteredContacts.length === 0 ? (
              <div className="p-3 text-center text-xs text-muted-foreground">
                Nenhum colaborador encontrado para &quot;{search}&quot;.
              </div>
            ) : (
              filteredContacts.map((contact) => {
                const isSelected =
                  value?.trim().toLowerCase() === contact.full_name?.trim().toLowerCase() ||
                  value === contact.id

                return (
                  <button
                    key={contact.id}
                    type="button"
                    onClick={() => handleSelectContact(contact)}
                    className={`w-full text-left flex items-start gap-2.5 px-2.5 py-2 rounded-md text-xs transition-colors hover:bg-accent hover:text-accent-foreground cursor-pointer ${
                      isSelected
                        ? 'bg-amber-500/10 text-amber-900 dark:text-amber-200 font-medium'
                        : ''
                    }`}
                  >
                    <div className="pt-0.5 shrink-0">
                      <div
                        className={`h-4 w-4 rounded-full border flex items-center justify-center ${
                          isSelected
                            ? 'bg-amber-600 text-white border-amber-600'
                            : 'border-muted-foreground/30'
                        }`}
                      >
                        {isSelected && <Check className="h-2.5 w-2.5" />}
                      </div>
                    </div>

                    <div className="flex-1 min-w-0 space-y-0.5">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-medium text-foreground truncate">
                          {contact.full_name}
                        </span>
                        {contact.is_focal_point && (
                          <span className="text-[10px] px-1 py-0.2 rounded bg-amber-500/20 text-amber-700 dark:text-amber-400 font-semibold border border-amber-500/30">
                            Ponto Focal
                          </span>
                        )}
                      </div>
                      {contact.email && (
                        <p className="text-[11px] text-muted-foreground flex items-center gap-1 truncate">
                          <Mail className="h-3 w-3 shrink-0" />
                          <span className="truncate">{contact.email}</span>
                        </p>
                      )}
                      {(contact.cell_phone || contact.phone) && (
                        <p className="text-[11px] text-muted-foreground flex items-center gap-1 truncate">
                          <Phone className="h-3 w-3 shrink-0" />
                          <span>{contact.cell_phone || contact.phone}</span>
                        </p>
                      )}
                    </div>
                  </button>
                )
              })
            )}

            {/* Opção de texto livre / customizado para compatibilidade */}
            {allowCustomText && search.trim() && (
              <div className="border-t pt-1 mt-1">
                <button
                  type="button"
                  onClick={handleUseCustomText}
                  className="w-full text-left flex items-center gap-2 px-2.5 py-2 rounded-md text-xs text-amber-700 dark:text-amber-300 hover:bg-amber-500/10 transition-colors cursor-pointer"
                >
                  <User className="h-3.5 w-3.5 shrink-0 text-amber-600" />
                  <div className="flex-1 min-w-0 truncate">
                    Usar texto livre:{' '}
                    <strong className="font-semibold">&quot;{search.trim()}&quot;</strong>
                  </div>
                </button>
              </div>
            )}
          </div>
        </ScrollArea>

        {value && isCustomValue && (
          <div className="p-2 border-t bg-muted/30 text-[11px] text-muted-foreground flex items-center justify-between">
            <span className="truncate">
              Responsável atual salvo: <strong>{value}</strong>
            </span>
          </div>
        )}
      </PopoverContent>
    </Popover>
  )
}
