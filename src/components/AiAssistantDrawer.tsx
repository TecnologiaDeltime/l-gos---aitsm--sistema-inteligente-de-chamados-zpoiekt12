import { useState } from 'react'
import { Bot, Send, X, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import pb from '@/lib/pocketbase/client'

export function AiAssistantDrawer() {
  const [open, setOpen] = useState(false)
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const [conversationId, setConversationId] = useState<string | null>(null)
  const [messages, setMessages] = useState<Array<{ role: 'user' | 'assistant'; text: string }>>([
    {
      role: 'assistant',
      text: 'Olá! Sou o Assistente Técnico ServiceOne. Como posso te ajudar hoje com procedimentos de TI ou chamados?',
    },
  ])

  const handleSend = async () => {
    if (!message.trim() || loading) return
    const userMsg = message
    setMessage('')
    setMessages((prev) => [...prev, { role: 'user', text: userMsg }])
    setLoading(true)

    try {
      const res = await pb.send('/backend/v1/ask-assistente', {
        method: 'POST',
        body: JSON.stringify({ message: userMsg, conversation_id: conversationId }),
        headers: { 'Content-Type': 'application/json' },
      })
      if (res.conversation_id) setConversationId(res.conversation_id)
      setMessages((prev) => [...prev, { role: 'assistant', text: res.content }])
    } catch (err: any) {
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', text: 'Desculpe, ocorreu um erro ao consultar o assistente.' },
      ])
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <Button
        onClick={() => setOpen(true)}
        className="fixed bottom-6 right-6 z-40 rounded-full bg-primary p-3 shadow-lg hover:bg-primary/90 text-primary-foreground"
        size="icon"
      >
        <Sparkles className="h-6 w-6" />
      </Button>

      {open && (
        <div className="fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col bg-white shadow-2xl border-l dark:bg-slate-900">
          <div className="flex items-center justify-between border-b p-4">
            <div className="flex items-center gap-2">
              <Bot className="h-5 w-5 text-primary" />
              <h3 className="font-semibold text-slate-900 dark:text-slate-100">
                Assistente Técnico ServiceOne
              </h3>
            </div>
            <Button variant="ghost" size="icon" onClick={() => setOpen(false)}>
              <X className="h-5 w-5" />
            </Button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.map((m, idx) => (
              <div
                key={idx}
                className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[85%] rounded-lg p-3 text-sm ${
                    m.role === 'user'
                      ? 'bg-primary text-primary-foreground font-medium'
                      : 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-200'
                  }`}
                >
                  {m.text}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="rounded-lg bg-slate-100 p-3 text-xs text-slate-500 dark:bg-slate-800">
                  Pensando e consultando base de TI...
                </div>
              </div>
            )}
          </div>

          <div className="border-t p-3 flex gap-2">
            <Input
              placeholder="Digite sua dúvida de TI..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            />
            <Button onClick={handleSend} disabled={loading} size="icon">
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </>
  )
}
