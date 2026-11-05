import logosLogoPng from '@/assets/logo-logos-ambar-em-png-transparente-4-8654a.png'

/**
 * Identidade visual oficial do sistema: Lógos AITSM.
 * O logotipo oficial enviado pelo cliente fica em
 * `src/assets/logo-logos-ambar-em-png-transparente-4-8654a.png` (símbolo "L" estilizado em laranja/âmbar + "Lógos")
 * e o monograma "L" é reproduzido em SVG para superfícies compactas (sidebar, topo e favicon).
 */

export const SYSTEM_NAME = 'Lógos AITSM'
export const SYSTEM_NAME_SHORT = 'Lógos'
export const SYSTEM_FULL_NAME = 'Lógos AITSM — Sistema de Gestão de Chamados'
export { logosLogoPng }

/** Monograma "L" estilizado em gradiente laranja/âmbar (marca Lógos). */
export function LogosMonogram({ className = 'h-8 w-8' }: { className?: string }) {
  return (
    <svg viewBox="0 0 100 100" className={className} role="img" aria-label="Monograma Lógos">
      <defs>
        <linearGradient id="logos-monogram-gradient" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#FBBF24" />
          <stop offset="55%" stopColor="#F59E0B" />
          <stop offset="100%" stopColor="#C2410C" />
        </linearGradient>
      </defs>
      {/* L angular com recorte diagonal, fiel ao monograma oficial */}
      <path
        d="M14 8 L44 8 L44 56 L86 56 L74 92 L14 92 Z M44 8 L44 56 L58 56 L58 30 Z"
        fill="url(#logos-monogram-gradient)"
        fillRule="evenodd"
      />
    </svg>
  )
}

/**
 * Logotipo completo (monograma + "Lógos" + "AITSM") para telas de login,
 * cabeçalhos e superfícies em destaque. Legível nos temas escuro e claro.
 */
export function LogosLogoFull({
  monogramClassName = 'h-10 w-10',
  textClassName = 'text-2xl',
  subtitleClassName = 'text-[10px]',
}: {
  monogramClassName?: string
  textClassName?: string
  subtitleClassName?: string
}) {
  return (
    <div className="flex items-center gap-3">
      <LogosMonogram className={monogramClassName} />
      <div className="leading-none">
        <div
          className={`font-extrabold tracking-tight bg-gradient-to-r from-amber-300 via-amber-400 to-amber-500 bg-clip-text text-transparent ${textClassName}`}
        >
          Lógos
        </div>
        <div
          className={`font-bold tracking-[0.35em] text-amber-500/80 uppercase ${subtitleClassName}`}
        >
          AITSM
        </div>
      </div>
    </div>
  )
}

/**
 * Bloco de marca para telas de autenticação e destaque.
 * Exibe a imagem oficial do logotipo Lógos (símbolo L + texto Lógos em âmbar).
 * Renderiza o logo DIRETAMENTE sem caixa, painel, borda ou fundo atrás dele,
 * com contraste refinado via drop-shadow que mantém excelente legibilidade
 * tanto no tema escuro (Amber Alert) quanto no tema claro (Marrom & Branco).
 */
export function LogosLogoPanel({
  className = 'max-h-16',
  withPanel = false,
}: {
  className?: string
  withPanel?: boolean
}) {
  if (withPanel) {
    return (
      <div className="rounded-xl bg-[#0f1013] border border-amber-500/20 shadow-md px-5 py-3 inline-flex items-center justify-center">
        <img
          src={logosLogoPng}
          alt="Lógos AITSM"
          className={`${className} w-auto object-contain drop-shadow-[0_2px_8px_rgba(245,158,11,0.2)]`}
        />
      </div>
    )
  }

  return (
    <div className="inline-flex items-center justify-center bg-transparent p-0 m-0 border-0 shadow-none">
      <img
        src={logosLogoPng}
        alt="Lógos AITSM"
        className={`${className} w-auto object-contain drop-shadow-[0_2px_6px_rgba(180,83,9,0.35)] dark:drop-shadow-[0_2px_10px_rgba(245,158,11,0.35)]`}
      />
    </div>
  )
}
