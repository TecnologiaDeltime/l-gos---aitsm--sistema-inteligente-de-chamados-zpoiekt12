import ProblemList from '@/pages/problems/ProblemList'

export default function ProblemEffectivenessAnalysis() {
  const filter =
    "status = 'Em Análise de Efetividade' || status = 'Análise de Efetividade Pendente'"
  return (
    <ProblemList
      title="Problemas em Análise de Efetividade"
      fixedFilter={filter}
      showCreate={false}
    />
  )
}
