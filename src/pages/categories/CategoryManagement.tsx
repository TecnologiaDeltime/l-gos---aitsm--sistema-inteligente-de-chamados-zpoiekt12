import { useEffect, useState } from 'react'
import { Tags, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { getCategories, createCategory, CategoryRecord } from '@/services/categories'
import { useToast } from '@/hooks/use-toast'

export default function CategoryManagement() {
  const [categories, setCategories] = useState<CategoryRecord[]>([])
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const { toast } = useToast()

  const loadData = () => {
    getCategories()
      .then(setCategories)
      .catch(() => {})
  }

  useEffect(() => {
    loadData()
  }, [])

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name) return
    await createCategory({ name, description, active: true })
    setName('')
    setDescription('')
    toast({ title: 'Categoria criada com sucesso!' })
    loadData()
  }

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-bold">Categorias de Chamados</h2>

      <div className="grid gap-6 md:grid-cols-3">
        <div className="rounded-xl border bg-white p-5 shadow-sm space-y-4 dark:bg-slate-900 md:col-span-1">
          <h3 className="font-semibold text-sm">Nova Categoria</h3>
          <form onSubmit={handleCreate} className="space-y-3">
            <div className="space-y-1">
              <label className="text-xs font-semibold">Nome</label>
              <Input
                placeholder="Ex: Infraestrutura"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold">Descrição</label>
              <Input
                placeholder="Redes, servidores e conectividade"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>
            <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-700" size="sm">
              <Plus className="mr-1 h-4 w-4" /> Adicionar Categoria
            </Button>
          </form>
        </div>

        <div className="space-y-3 md:col-span-2">
          {categories.map((cat) => (
            <div
              key={cat.id}
              className="rounded-xl border bg-white p-4 shadow-sm flex items-center justify-between dark:bg-slate-900"
            >
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-purple-50 text-purple-600">
                  <Tags className="h-5 w-5" />
                </div>
                <div>
                  <p className="font-bold text-sm text-slate-900 dark:text-slate-100">{cat.name}</p>
                  <p className="text-xs text-slate-500">{cat.description || 'Sem descrição'}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
