import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Users, Wifi, Shield } from 'lucide-react'
import type { OnlineUserItem } from '@/services/tv-mode'

interface TvOnlineUsersDashboardProps {
  data: OnlineUserItem[]
  loading?: boolean
}

export function TvOnlineUsersDashboard({ data, loading }: TvOnlineUsersDashboardProps) {
  const onlineCount = data.filter((u) => u.isOnline).length

  if (loading && data.length === 0) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-amber-500 border-t-transparent" />
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col gap-6 p-2">
      {/* Banner Superior */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <Card className="bg-[#17181C] border-emerald-500/40 text-white shadow-xl">
          <CardContent className="p-6 flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-wider text-emerald-400">
                Operadores / Usuários Online Agora
              </p>
              <p className="text-4xl lg:text-6xl font-black text-emerald-400 mt-1">{onlineCount}</p>
              <p className="text-xs text-slate-400 mt-1">
                Atividade detectada nos últimos 15 minutos
              </p>
            </div>
            <div className="p-4 rounded-2xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
              <Wifi className="h-12 w-12 animate-pulse" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-[#17181C] border-amber-500/30 text-white shadow-xl">
          <CardContent className="p-6 flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-wider text-amber-400">
                Total de Usuários Cadastrados
              </p>
              <p className="text-4xl lg:text-6xl font-black text-white mt-1">{data.length}</p>
              <p className="text-xs text-slate-400 mt-1">
                Equipe técnica, administrativa e gestores
              </p>
            </div>
            <div className="p-4 rounded-2xl bg-amber-500/20 text-amber-400 border border-amber-500/30">
              <Users className="h-12 w-12" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Grid de Usuários */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 flex-1 overflow-y-auto pr-1">
        {data.map((user) => (
          <Card
            key={user.id}
            className={`bg-[#17181C] text-white p-4 flex flex-col justify-between shadow-lg transition-all ${
              user.isOnline
                ? 'border-emerald-500/50 shadow-emerald-500/10'
                : 'border-white/10 opacity-70'
            }`}
          >
            <div>
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2.5 truncate">
                  <div className="relative">
                    <div className="h-10 w-10 rounded-full bg-amber-500/20 text-amber-300 font-bold flex items-center justify-center border border-amber-500/40 text-sm">
                      {user.name.slice(0, 2).toUpperCase()}
                    </div>
                    <span
                      className={`absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-2 border-[#17181C] ${
                        user.isOnline ? 'bg-emerald-500 animate-pulse' : 'bg-slate-600'
                      }`}
                    />
                  </div>
                  <div className="truncate">
                    <p className="text-base font-bold text-white truncate">{user.name}</p>
                    <p className="text-xs text-slate-400 truncate">{user.email}</p>
                  </div>
                </div>

                <Badge
                  className={
                    user.isOnline
                      ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40 text-xs font-semibold'
                      : 'bg-slate-800 text-slate-400 border-slate-700 text-xs'
                  }
                >
                  {user.isOnline ? 'ONLINE' : 'AUSENTE'}
                </Badge>
              </div>

              {/* Perfil & Time */}
              <div className="mt-3 flex flex-wrap gap-1.5 items-center">
                <Badge
                  variant="outline"
                  className="text-[11px] bg-black/40 border-white/15 text-slate-300 flex items-center gap-1"
                >
                  <Shield className="h-3 w-3 text-amber-400" />
                  {user.profileName}
                </Badge>
                {user.team && (
                  <Badge
                    variant="outline"
                    className="text-[11px] bg-black/40 border-white/15 text-slate-300"
                  >
                    {user.team}
                  </Badge>
                )}
              </div>
            </div>

            {/* Filas */}
            <div className="mt-3 pt-2.5 border-t border-white/10">
              <p className="text-[10px] uppercase font-semibold text-slate-400 mb-1">
                Filas de Atendimento:
              </p>
              {user.queues.length === 0 ? (
                <span className="text-xs text-slate-500 italic">Sem fila atribuída</span>
              ) : (
                <div className="flex flex-wrap gap-1">
                  {user.queues.slice(0, 3).map((q) => (
                    <span
                      key={q}
                      className="px-2 py-0.5 text-[10px] rounded bg-amber-500/10 text-amber-300 border border-amber-500/20"
                    >
                      {q}
                    </span>
                  ))}
                  {user.queues.length > 3 && (
                    <span className="text-[10px] text-slate-400 self-center">
                      +{user.queues.length - 3}
                    </span>
                  )}
                </div>
              )}
            </div>
          </Card>
        ))}
      </div>
    </div>
  )
}
