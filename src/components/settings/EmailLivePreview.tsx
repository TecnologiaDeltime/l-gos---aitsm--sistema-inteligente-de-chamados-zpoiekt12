import React, { useMemo } from 'react'
import {
  EmailAlertSetting,
  EMAIL_ALERT_SAMPLE_DATA,
  interpolateSampleText,
} from '@/services/email-alert-settings'

interface EmailLivePreviewProps {
  setting: EmailAlertSetting
}

export const EmailLivePreview: React.FC<EmailLivePreviewProps> = ({ setting }) => {
  const sampleData = useMemo(() => {
    return (
      EMAIL_ALERT_SAMPLE_DATA[setting.alert_key] || {
        chamado_numero: 'CH-2026-99999',
        titulo: 'Título de Exemplo do Chamado',
        descricao: 'Descrição resumida da solicitação registrada no sistema.',
        cliente: 'Usuário Solicitante',
        link: 'https://app.logositsm.com.br',
      }
    )
  }, [setting.alert_key])

  const subject = useMemo(() => {
    return interpolateSampleText(setting.subject_template || '', sampleData)
  }, [setting.subject_template, sampleData])

  const bodyHtml = useMemo(() => {
    return interpolateSampleText(setting.body_template || '', sampleData)
  }, [setting.body_template, sampleData])

  const buttonLabel = useMemo(() => {
    return interpolateSampleText(setting.button_label || 'Acessar', sampleData)
  }, [setting.button_label, sampleData])

  const buttonUrl = useMemo(() => {
    return interpolateSampleText(setting.button_url_template || '', sampleData)
  }, [setting.button_url_template, sampleData])

  const primaryColor = setting.primary_color || '#D97706'
  const layout = setting.template_layout || 'modern'

  return (
    <div className="w-full flex flex-col rounded-xl border border-border/80 bg-background overflow-hidden shadow-sm">
      {/* Header simulador de cliente de e-mail */}
      <div className="bg-muted/70 px-4 py-2.5 border-b border-border text-xs flex flex-col gap-1">
        <div className="flex items-center gap-2 text-muted-foreground">
          <span className="font-semibold text-foreground">De:</span>
          <span>{setting.header_title || 'Lógos AITSM'} &lt;noreply@logositsm.com.br&gt;</span>
        </div>
        <div className="flex items-center gap-2 text-muted-foreground truncate">
          <span className="font-semibold text-foreground">Assunto:</span>
          <span className="text-foreground font-medium truncate">{subject || '(Sem assunto)'}</span>
        </div>
      </div>

      {/* Renderização conforme Layout */}
      <div className="p-4 sm:p-6 bg-slate-100/70 dark:bg-slate-950/40 flex justify-center items-start min-h-[380px] overflow-auto">
        {layout === 'minimal' && (
          <div className="w-full max-w-[560px] bg-white text-slate-900 border border-slate-200 rounded-lg overflow-hidden shadow-sm text-sm">
            <div className="px-6 py-4 border-b-2" style={{ borderBottomColor: primaryColor }}>
              <div className="text-lg font-bold tracking-tight text-slate-900">
                {setting.header_title || 'Lógos AITSM'}
              </div>
              {setting.header_subtitle && (
                <div className="text-xs text-slate-500 mt-0.5">{setting.header_subtitle}</div>
              )}
            </div>
            <div
              className="p-6 leading-relaxed text-slate-700 whitespace-pre-line text-[14px]"
              dangerouslySetInnerHTML={{ __html: bodyHtml }}
            />
            {setting.show_button && buttonUrl && (
              <div className="px-6 pb-6">
                <a
                  href="#preview"
                  onClick={(e) => e.preventDefault()}
                  className="inline-block px-5 py-2.5 rounded text-white font-medium text-xs no-underline shadow-sm"
                  style={{ backgroundColor: primaryColor }}
                >
                  {buttonLabel}
                </a>
              </div>
            )}
            <div className="px-6 py-3 bg-slate-50 border-t border-slate-100 text-[11px] text-slate-400 text-center">
              {setting.footer_text || 'Lógos AITSM • Central de Serviços Inteligente'}
            </div>
          </div>
        )}

        {layout === 'corporate' && (
          <div className="w-full max-w-[580px] bg-white text-slate-900 rounded-xl overflow-hidden shadow-md border border-slate-300 text-sm">
            <div
              className="px-6 py-5 bg-[#17181C] text-left border-b-4"
              style={{ borderBottomColor: primaryColor }}
            >
              <div className="text-base font-extrabold uppercase tracking-wider text-[#FCD34D]">
                {setting.header_title || 'LÓGOS AITSM'}
              </div>
              {setting.header_subtitle && (
                <div className="text-xs text-slate-400 mt-1">{setting.header_subtitle}</div>
              )}
            </div>
            <div
              className="p-7 leading-relaxed text-slate-800 text-[14px]"
              dangerouslySetInnerHTML={{ __html: bodyHtml }}
            />
            {setting.show_button && buttonUrl && (
              <div className="px-7 pb-6">
                <a
                  href="#preview"
                  onClick={(e) => e.preventDefault()}
                  className="inline-block px-6 py-2.5 rounded-md text-white font-semibold text-xs no-underline shadow"
                  style={{ backgroundColor: primaryColor }}
                >
                  {buttonLabel}
                </a>
              </div>
            )}
            <div className="px-6 py-4 bg-[#0f172a] text-slate-400 text-[11px] text-center border-t border-slate-800">
              <strong className="text-slate-200">{setting.header_title || 'Lógos AITSM'}</strong> —
              Sistema Corporativo de TI
              <br />
              <span className="text-slate-500">{setting.footer_text}</span>
            </div>
          </div>
        )}

        {layout === 'modern' && (
          <div className="w-full max-w-[580px] bg-white text-slate-900 rounded-xl overflow-hidden shadow-lg border border-slate-200 text-sm">
            {/* Header Lógos AITSM Oficial */}
            <div
              className="px-6 py-5 text-left border-b-4 relative"
              style={{
                background: 'linear-gradient(135deg, #17181C 0%, #22252a 100%)',
                borderBottomColor: primaryColor,
              }}
            >
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-lg font-black tracking-tight text-[#FCD34D] flex items-center gap-2">
                    <span
                      className="inline-block w-2.5 h-2.5 rounded-full"
                      style={{ backgroundColor: primaryColor }}
                    />
                    {setting.header_title || 'Lógos AITSM'}
                  </div>
                  {setting.header_subtitle && (
                    <div className="text-xs text-slate-300 mt-1 font-normal">
                      {setting.header_subtitle}
                    </div>
                  )}
                </div>
                <div className="hidden sm:block text-[10px] tracking-widest uppercase px-2 py-0.5 rounded font-mono bg-white/10 text-amber-300 border border-amber-300/20">
                  Notificação Oficial
                </div>
              </div>
            </div>

            {/* Corpo */}
            <div
              className="p-6 sm:p-7 leading-relaxed text-slate-700 text-[14px]"
              dangerouslySetInnerHTML={{ __html: bodyHtml }}
            />

            {/* Botão de Ação */}
            {setting.show_button && buttonUrl && (
              <div className="px-6 sm:px-7 pb-6">
                <a
                  href="#preview"
                  onClick={(e) => e.preventDefault()}
                  className="inline-flex items-center justify-center px-6 py-2.5 rounded-lg text-white font-semibold text-xs no-underline transition-opacity shadow-sm hover:opacity-95"
                  style={{ backgroundColor: primaryColor }}
                >
                  {buttonLabel}
                </a>
              </div>
            )}

            {/* Rodapé */}
            <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 text-[11px] text-slate-500 text-center leading-normal">
              {setting.footer_text || 'Lógos AITSM • Sistema Inteligente de Chamados'}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
