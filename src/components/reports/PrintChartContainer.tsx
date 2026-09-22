import * as React from 'react'
import { ResponsiveContainer } from 'recharts'
import { cn } from '@/lib/utils'

interface PrintChartContainerProps {
  /** O componente de gráfico (BarChart, LineChart, AreaChart, PieChart, etc.) */
  children: React.ReactElement
  /** Altura do gráfico na visualização de tela em px (padrão: 320) */
  screenHeight?: number
  /** Altura do gráfico na impressão/PDF em px (padrão: 320) */
  printHeight?: number
  /** Largura do gráfico na impressão/PDF em px (padrão: 640 retrato, 940 paisagem) */
  printWidth?: number
  /** Se o container deve ser tratado como paisagem */
  landscape?: boolean
  /** Classes extras aplicadas ao wrapper exterior */
  className?: string
}

/**
 * PrintChartContainer
 *
 * Resolve definitivamente os dois problemas clássicos do Recharts ao gerar PDF via window.print():
 * 1) ResponsiveContainer recalcula largura/altura durante a renderização do Chromium para impressão,
 *    frequentemente avaliando clientWidth/clientHeight como 0 ou NaN. Isso faz com que alguns gráficos
 *    desapareçam totalmente ou tenham seus eixos/LabelList colapsados.
 * 2) Os gráficos renderizados na tela para viewport de 1200px+ são recortados nas margens A4 estreitas.
 *
 * Estratégia de alta fidelidade:
 * - Na tela (print:hidden): usa ResponsiveContainer nativo com width="100%" e height={screenHeight}.
 * - Na impressão (hidden print:block): clona o elemento de gráfico com dimensões exatas de largura e
 *   altura em pixels (targetWidth x targetHeight) SEM ResponsiveContainer intermediário. Isso garante
 *   que o Recharts calcule as escalas SVG, eixos, barras e rótulos (LabelList) com precisão milimétrica,
 *   sem depender de medições assíncronas de DOM na fila de impressão.
 */
export function PrintChartContainer({
  children,
  screenHeight = 320,
  printHeight = 320,
  printWidth,
  landscape = false,
  className,
}: PrintChartContainerProps) {
  // Largura útil alvo para A4 na impressão (margens ABNT 3cm esq/sup e 2cm dir/inf)
  // Retrato: ~160mm de área imprimível ≈ 605px a 640px
  // Paisagem: ~247mm de área imprimível ≈ 930px a 960px
  const targetPrintWidth = printWidth ?? (landscape ? 940 : 640)

  // Clona o gráfico filho para a versão impressa com width e height explícitos
  const chartForPrint = React.useMemo(() => {
    if (!React.isValidElement(children)) return children

    return React.cloneElement(children as React.ReactElement<any>, {
      width: targetPrintWidth,
      height: printHeight,
    })
  }, [children, targetPrintWidth, printHeight])

  return (
    <div
      className={cn(
        'print-chart-outer w-full overflow-hidden transition-all',
        landscape ? 'print-chart-landscape' : 'print-chart-portrait',
        className,
      )}
    >
      {/* 1. Versão de TELA: 100% responsiva */}
      <div
        className="print:hidden w-full"
        style={{ height: screenHeight, minHeight: screenHeight }}
      >
        <ResponsiveContainer width="100%" height="100%">
          {children}
        </ResponsiveContainer>
      </div>

      {/* 2. Versão de IMPRESSÃO: Dimensões fixas sem ResponsiveContainer, 100% à prova de falhas de print */}
      <div
        className="hidden print:flex print:items-center print:justify-center print-chart-inner mx-auto overflow-hidden"
        style={{
          width: targetPrintWidth,
          maxWidth: '100%',
          height: printHeight,
          minHeight: printHeight,
        }}
      >
        {chartForPrint}
      </div>
    </div>
  )
}

export default PrintChartContainer
