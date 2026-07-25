import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { createUser } from '@/services/users'
import { useToast } from '@/hooks/use-toast'

export default function TeamDetail() {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('Skip@Pass')
  const [role, setRole] = useState('tecnico')
  const [position, setPosition] = useState('Analista de Suporte')

  const navigate = useNavigate()
  const { toast } = useToast()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    await createUser({
      name,
      email,
      password,
      passwordConfirm: password,
      role,
      position,
      active: true,
    })
    toast({ title: 'Usuário cadastrado com sucesso!' })
    navigate('/team')
  }

  return (
    <div className="max-w-xl mx-auto space-y-6">
      <div className="rounded-xl border bg-white p-6 shadow-sm space-y-4 dark:bg-slate-900">
        <h2 className="text-lg font-bold">Novo Membro da Equipe</h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <label className="text-xs font-semibold">Nome Completo</label>
            <Input required value={name} onChange={(e) => setName(e.target.value)} />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold">E-mail</label>
            <Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-semibold">Perfil / Role</label>
              <Select value={role} onValueChange={setRole}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Administrador</SelectItem>
                  <SelectItem value="gestor">Gestor</SelectItem>
                  <SelectItem value="tecnico">Técnico/Analista</SelectItem>
                  <SelectItem value="cliente_solicitante">Cliente Solicitante</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold">Cargo</label>
              <Input value={position} onChange={(e) => setPosition(e.target.value)} />
            </div>
          </div>

          <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-700">
            Salvar Usuário
          </Button>
        </form>
      </div>
    </div>
  )
}
