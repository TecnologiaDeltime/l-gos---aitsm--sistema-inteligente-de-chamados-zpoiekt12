import ProblemList from '@/pages/problems/ProblemList'

export default function ProblemClosed() {
  return (
    <ProblemList
      title="Problemas Encerrados"
      fixedFilter="status = 'Encerrado'"
      showCreate={false}
    />
  )
}
