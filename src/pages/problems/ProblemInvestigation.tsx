import ProblemList from '@/pages/problems/ProblemList'

export default function ProblemInvestigation() {
  return (
    <ProblemList
      title="Problemas em Investigação"
      fixedFilter="status = 'Em Investigação'"
      showCreate={false}
    />
  )
}
