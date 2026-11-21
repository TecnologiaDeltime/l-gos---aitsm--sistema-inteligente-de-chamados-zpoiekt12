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
 *    desapareçam totalmente ("PDF em branco") ou tenham seus eixos/LabelList colapsados ("achatados").
 * 2) Os gráficos renderizados na tela para viewport de 1200px+ são recortados nas margens A4 estreitas.
 *
 * Estratégia de alta fidelidade:
 * - Na tela (print:hidden): usa ResponsiveContainer nativo com width="100%" e height={screenHeight}.
 * - Na impressão (hidden print:block): clona o elemento de gráfico com dimensões EXPLÍCITAS de largura
 *   e altura em pixels (targetWidth x targetHeight) SEM ResponsiveContainer intermediário, com escala
 *   px→mm garantida via CSS (pt fixo) no container. Isso garante que o Recharts calcule as escalas SVG,
 *   eixos, barras e rótulos (LabelList) com precisão milimétrica, sem depender de medições assíncronas
 *   de DOM na fila de impressão.
 *
 * Correção do "PDF em branco": a versão de impressão é clonada e RENDERIZADA o tempo todo no DOM
 * (não só durante a fila de impressão), dentro de um wrapper com largura fixa em px e
 * `position:absolute; left:-9999px` na tela. Assim o Recharts já calculou escalas e eixos antes do
 * Chromium serializar a página para impressão — nada depende de ResizeObserver durante o print.
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
      {/* 2. Versão de IMPRESSÃO: pré-renderizada permanentemente no DOM com dimensões fixas.
          Na tela fica fora da área visível (sem custo visual); no print entra no fluxo.
          Duas instâncias do mesmo gráfico (mesma `data`) — nenhuma medição assíncrona ocorre. */}
      <div
        aria-hidden
        className="print-chart-print-stage"
        style={{
          width: targetPrintWidth,
          height: printHeight,
        }}
      >
        {chartForPrint}
      </div>
    </div>
  )
}

export default PrintChartContainer
