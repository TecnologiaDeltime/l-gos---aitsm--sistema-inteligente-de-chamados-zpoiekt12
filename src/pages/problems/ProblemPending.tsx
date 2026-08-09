import ProblemList from '@/pages/problems/ProblemList'

export default function ProblemPending() {
  return (
    <ProblemList
      title="Problemas Pendentes"
      fixedFilter="status = 'Análise de Efetividade Pendente'"
      showCreate={false}
    />
  )
}
