import { useEffect, useState } from 'react'
import { Plus, Trash2, Tags } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { getCiTypes, createCiType, deleteCiType, CiTypeRecord } from '@/services/ci-types'
import { useToast } from '@/hooks/use-toast'

const DEFAULT_ICONS = [
  'Server',
  'Monitor',
  'Printer',
  'Network',
  'Battery',
  'Shield',
  'Box',
  'Laptop',
]

export default function CiTypes() {
  const [types, setTypes] = useState<CiTypeRecord[]>([])
  const [name, setName] = useState('')
  const [desc, setDesc] = useState('')
  const [icon, setIcon] = useState(DEFAULT_ICONS[0])
  const { toast } = useToast()

  const loadData = () =>
    getCiTypes()
      .then(setTypes)
      .catch(() => {})
  useEffect(() => {
    loadData()
  }, [])

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name) return
    await createCiType({ name, description: desc, icon, active: true })
    setName('')
    setDesc('')
    setIcon(DEFAULT_ICONS[0])
    loadData()
    toast({ title: 'Tipo criado!' })
  }

  const handleDelete = async (id: string) => {
    await deleteCiType(id)
    loadData()
    toast({ title: 'Tipo removido' })
  }

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-bold">Tipos de Ativo</h2>
      <div className="grid gap-6 md:grid-cols-3">
        <div className="rounded-xl border bg-white p-5 shadow-sm space-y-4 dark:bg-slate-900 md:col-span-1">
          <h3 className="font-semibold text-sm">Novo Tipo</h3>
          <form onSubmit={handleCreate} className="space-y-3">
            <div>
              <Label className="text-xs">Nome</Label>
              <Input
                placeholder="Ex: Servidor"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div>
              <Label className="text-xs">Descrição</Label>
              <Input
                placeholder="Servidores e racks"
                value={desc}
                onChange={(e) => setDesc(e.target.value)}
              />
            </div>
            <div>
              <Label className="text-xs">Ícone</Label>
              <select
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={icon}
                onChange={(e) => setIcon(e.target.value)}
              >
                {DEFAULT_ICONS.map((i) => (
                  <option key={i} value={i}>
                    {i}
                  </option>
                ))}
              </select>
            </div>
            <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-700" size="sm">
              <Plus className="mr-1 h-4 w-4" /> Adicionar
            </Button>
          </form>
        </div>
        <div className="space-y-3 md:col-span-2">
          {types.map((t) => (
            <div
              key={t.id}
              className="rounded-xl border bg-white p-4 shadow-sm flex items-center justify-between dark:bg-slate-900"
            >
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-purple-50 text-purple-600">
                  <Tags className="h-5 w-5" />
                </div>
                <div>
                  <p className="font-bold text-sm">{t.name}</p>
                  <p className="text-xs text-slate-500">{t.description || 'Sem descrição'}</p>
                </div>
              </div>
              <Button variant="ghost" size="icon" onClick={() => handleDelete(t.id)}>
                <Trash2 className="h-4 w-4 text-red-500" />
              </Button>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
