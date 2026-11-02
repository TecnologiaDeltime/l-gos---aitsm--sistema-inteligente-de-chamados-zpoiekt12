import { useLocation, Link } from 'react-router-dom'
import { useEffect } from 'react'
import { LogosLogoPanel, SYSTEM_NAME } from '@/components/brand/LogosLogo'
import { Button } from '@/components/ui/button'
import { ArrowLeft } from 'lucide-react'

const NotFound = () => {
  const location = useLocation()

  useEffect(() => {
    console.warn('404: Rota não encontrada:', location.pathname)
  }, [location.pathname])

  return (
    <div className="min-h-screen flex items-center justify-center bg-background text-foreground px-4 py-8">
      <div className="text-center max-w-md w-full space-y-6">
        <div className="flex justify-center">
          <LogosLogoPanel className="max-h-14" />
        </div>
        <div className="space-y-2">
          <h1 className="text-6xl font-extrabold text-primary font-mono">404</h1>
          <h2 className="text-xl font-bold">Página não encontrada</h2>
          <p className="text-sm text-muted-foreground">
            A página que você tentou acessar não existe ou foi movida no {SYSTEM_NAME}.
          </p>
        </div>
        <div>
          <Button asChild className="gap-2">
            <Link to="/">
              <ArrowLeft className="h-4 w-4" />
              Voltar ao Início
            </Link>
          </Button>
        </div>
      </div>
    </div>
  )
}

export default NotFound
