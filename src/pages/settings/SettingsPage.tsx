import { useAuth } from '@/hooks/use-auth'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

export default function SettingsPage() {
  const { user } = useAuth()

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Perfil do Usuário</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1">
            <label className="text-xs font-semibold">Nome</label>
            <Input defaultValue={user?.name || ''} readOnly />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-semibold">E-mail</label>
            <Input defaultValue={user?.email || ''} readOnly />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-semibold">Perfil / Função</label>
            <Input defaultValue={user?.role || 'admin'} readOnly />
          </div>
          <Button variant="outline" size="sm">
            Alterar Senha
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
