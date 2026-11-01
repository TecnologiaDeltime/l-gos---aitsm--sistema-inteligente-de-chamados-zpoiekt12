import React, { useState, useEffect } from 'react'
import { FileText, Star, X, ArrowRight, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ClientMonthlyReportRecord } from '@/services/client-monthly-reports'

interface PendingReportEvaluationNotificationProps {
  unreviewedReports: ClientMonthlyReportRecord[]
  onOpenReportTab: () => void
}

/**
 * Popup amigável que notifica o Ponto Focal / Cliente caso existam relatórios mensais liberados
 * que ainda não receberam avaliação de satisfação.
 * Texto solicitado pelo usuário: "Acesse o relatório mensal e avalie o atendimento".
 * Possui botão de dispensar por sessão e não bloqueia a tela.
 */
export default function PendingReportEvaluationNotification({
  unreviewedReports,
  onOpenReportTab,
}: PendingReportEvaluationNotificationProps) {
  const [dismissed, setDismissed] = useState(false)

  // Verifica se o usuário já dispensou para estes relatórios nesta sessão
  const count = unreviewedReports.length
  const reportsKey = unreviewedReports
    .map((r) => r.id)
    .sort()
    .join(',')

  useEffect(() => {
    if (!count) return
    const dismissedKey = sessionStorage.getItem('itsm_portal_dismissed_eval_reports')
    if (dismissedKey === reportsKey) {
      setDismissed(true)
    } else {
      setDismissed(false)
    }
  }, [reportsKey, count])

  if (count === 0 || dismissed) {
    return null
  }

  const handleDismiss = () => {
    sessionStorage.setItem('itsm_portal_dismissed_eval_reports', reportsKey)
    setDismissed(true)
  }

  const firstReport = unreviewedReports[0]

  return (
    <div className="fixed bottom-4 right-4 z-50 max-w-sm w-full animate-in fade-in slide-in-from-bottom-5 duration-300">
      <div className="bg-[#17181C] text-amber-100 border border-amber-500/40 rounded-xl p-4 shadow-xl shadow-black/40 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-amber-500/20 text-amber-400">
              <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
            </div>
            <div>
              <span className="text-xs font-bold text-amber-300 uppercase tracking-wider block">
                Avaliação de Atendimento Pendente
              </span>
              <span className="text-[11px] text-zinc-400">
                {count === 1
                  ? `Relatório de ${firstReport.period_label}`
                  : `${count} relatórios mensais aguardando`}
              </span>
            </div>
          </div>

          <button
            onClick={handleDismiss}
            className="text-zinc-400 hover:text-zinc-200 p-1 rounded-md transition-colors"
            title="Dispensar aviso nesta sessão"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <p className="text-xs text-zinc-300 leading-relaxed">
          Acesse o relatório mensal e avalie o atendimento referente aos serviços prestados pela
          nossa equipe no período.
        </p>

        <div className="flex items-center justify-between gap-2 pt-1 border-t border-zinc-800">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleDismiss}
            className="text-[11px] text-zinc-400 hover:text-zinc-200 h-7 px-2"
          >
            Lembrar depois
          </Button>

          <Button
            size="sm"
            onClick={() => {
              onOpenReportTab()
              handleDismiss()
            }}
            className="bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold gap-1.5 h-7 px-3"
          >
            <FileText className="h-3 w-3" />
            Acessar Relatório
            <ArrowRight className="h-3 w-3" />
          </Button>
        </div>
      </div>
    </div>
  )
}
