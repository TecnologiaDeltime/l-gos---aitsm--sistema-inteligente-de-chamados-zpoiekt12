import { useEffect, useState, useMemo } from 'react'
import { Plus, Trash2, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  getRelationships,
  createRelationship,
  deleteRelationship,
  RELATIONSHIP_TYPES,
  CiRelationshipRecord,
} from '@/services/ci-relationships'
import { getEquipments, EquipmentRecord } from '@/services/equipments'
import { useToast } from '@/hooks/use-toast'
import { useRealtime } from '@/hooks/use-realtime'

export function CiDetailRelationships({ equipmentId }: { equipmentId: string }) {
  const [rels, setRels] = useState<CiRelationshipRecord[]>([])
  const [showAdd, setShowAdd] = useState(false)
  const [search, setSearch] = useState('')
  const [allEquipments, setAllEquipments] = useState<EquipmentRecord[]>([])
  const [targetCi, setTargetCi] = useState('')
  const [relType, setRelType] = useState(RELATIONSHIP_TYPES[0])
  const [desc, setDesc] = useState('')
  const { toast } = useToast()

  const loadData = () =>
    getRelationships(equipmentId)
      .then(setRels)
      .catch(() => {})
  useEffect(() => {
    loadData()
  }, [equipmentId])
  useRealtime('ci_relationships', () => loadData())

  const filteredEqs = useMemo(
    () =>
      allEquipments
        .filter(
          (e) =>
            e.id !== equipmentId &&
            (search
              ? [e.name, e.serial_number].some((v) =>
                  v?.toLowerCase().includes(search.toLowerCase()),
                )
              : true),
        )
        .slice(0, 20),
    [allEquipments, search, equipmentId],
  )

  const openModal = () => {
    getEquipments()
      .then(setAllEquipments)
      .catch(() => {})
    setShowAdd(true)
  }

  const handleAdd = async () => {
    if (!targetCi) return
    await createRelationship({
      source_ci: equipmentId,
      target_ci: targetCi,
      relationship_type: relType,
      description: desc,
    })
    setShowAdd(false)
    setTargetCi('')
    setDesc('')
    setSearch('')
    loadData()
    toast({ title: 'Relacionamento adicionado!' })
  }

  const handleRemove = async (id: string) => {
    await deleteRelationship(id)
    loadData()
    toast({ title: 'Relacionamento removido' })
  }

  const relNodes = rels.map((r) => ({
    rel: r,
    other: r.source_ci === equipmentId ? r.expand?.target_ci : r.expand?.source_ci,
    direction: r.source_ci === equipmentId ? 'out' : 'in',
  }))
  const centerName =
    rels.length > 0 && rels[0].expand?.source_ci?.id === equipmentId
      ? rels[0].expand.source_ci.name
      : rels[0]?.expand?.target_ci?.name || 'CI'

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button size="sm" onClick={openModal}>
          <Plus className="mr-1.5 h-4 w-4" /> Adicionar Relacionamento
        </Button>
      </div>

      {/* Simple diagram */}
      <div className="rounded-xl border bg-white p-6 dark:bg-slate-900">
        <svg viewBox="0 0 500 300" className="w-full h-auto">
          <circle
            cx="250"
            cy="150"
            r="50"
            fill="#3b82f6"
            opacity="0.2"
            stroke="#3b82f6"
            strokeWidth="2"
          />
          <text
            x="250"
            y="155"
            textAnchor="middle"
            className="text-xs font-bold fill-slate-800 dark:fill-slate-100"
          >
            {centerName.substring(0, 20)}
          </text>
          {relNodes.map((n, i) => {
            const angle = (i / Math.max(relNodes.length, 1)) * 2 * Math.PI - Math.PI / 2
            const x = 250 + 160 * Math.cos(angle),
              y = 150 + 110 * Math.sin(angle)
            return (
              <g key={n.rel.id}>
                <line
                  x1="250"
                  y1="150"
                  x2={x}
                  y2={y}
                  stroke="#94a3b8"
                  strokeWidth="1.5"
                  strokeDasharray="4"
                />
                <text
                  x={(250 + x) / 2}
                  y={(150 + y) / 2 - 5}
                  textAnchor="middle"
                  className="text-[8px] fill-slate-500"
                >
                  {n.rel.relationship_type}
                </text>
                <circle
                  cx={x}
                  cy={y}
                  r="35"
                  fill="#e2e8f0"
                  opacity="0.6"
                  stroke="#94a3b8"
                  strokeWidth="1.5"
                />
                <text x={x} y={y + 3} textAnchor="middle" className="text-[8px] fill-slate-700">
                  {(n.other?.name || 'CI').substring(0, 15)}
                </text>
              </g>
            )
          })}
          {relNodes.length === 0 && (
            <text x="250" y="220" textAnchor="middle" className="text-xs fill-slate-400">
              Nenhum relacionamento
            </text>
          )}
        </svg>
      </div>

      {/* Table */}
      <div className="rounded-xl border bg-white overflow-hidden dark:bg-slate-900">
        <table className="w-full text-left text-xs text-slate-600">
          <thead className="bg-slate-50 border-b font-semibold text-slate-700 dark:bg-slate-800">
            <tr>
              <th className="p-3">CI Origem</th>
              <th className="p-3">Tipo Relação</th>
              <th className="p-3">CI Destino</th>
              <th className="p-3">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {rels.length === 0 ? (
              <tr>
                <td colSpan={4} className="p-4 text-center text-slate-500">
                  Nenhum relacionamento.
                </td>
              </tr>
            ) : (
              rels.map((r) => (
                <tr key={r.id} className="hover:bg-slate-50">
                  <td className="p-3">{r.expand?.source_ci?.name || '-'}</td>
                  <td className="p-3 font-medium">{r.relationship_type}</td>
                  <td className="p-3">{r.expand?.target_ci?.name || '-'}</td>
                  <td className="p-3">
                    <Button variant="ghost" size="icon" onClick={() => handleRemove(r.id)}>
                      <Trash2 className="h-4 w-4 text-red-500" />
                    </Button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Adicionar Relacionamento</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Buscar CI por nome..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <div className="max-h-40 overflow-y-auto space-y-1">
              {filteredEqs.map((e) => (
                <div
                  key={e.id}
                  onClick={() => setTargetCi(e.id)}
                  className={`p-2 rounded cursor-pointer text-sm ${targetCi === e.id ? 'bg-blue-100' : 'hover:bg-slate-100'}`}
                >
                  {e.name} {e.serial_number ? `(${e.serial_number})` : ''}
                </div>
              ))}
            </div>
            <Select value={relType} onValueChange={setRelType}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {RELATIONSHIP_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>
                    {t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              placeholder="Descrição (opcional)"
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAdd(false)}>
              Cancelar
            </Button>
            <Button onClick={handleAdd} disabled={!targetCi}>
              Adicionar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
