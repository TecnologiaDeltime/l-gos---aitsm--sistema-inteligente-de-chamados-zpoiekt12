import ProblemList from '@/pages/problems/ProblemList'
import { useAuth } from '@/hooks/use-auth'

export default function MyProblems() {
  const { user } = useAuth()
  const filter = user ? `responsible = "${user.id}" || requester = "${user.id}"` : ''
  return <ProblemList title="Meus Problemas" fixedFilter={filter} />
}
