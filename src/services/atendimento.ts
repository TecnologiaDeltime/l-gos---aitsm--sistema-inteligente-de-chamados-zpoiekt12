import pb from '@/lib/pocketbase/client'
import {
  AtendimentoConversa,
  AtendimentoMensagem,
  AtendimentoDossie,
  AgenteCandidato,
  CanalAtendimento,
} from '@/types/atendimento'
import {
  classificarTextoItil,
  calcularRoteamentoAgente,
  gerarDossieHandoff,
  SLA_MINUTOS,
} from '@/lib/aitsm-engine'

// 1. Listar conversas com filtros opcionais
export async function getConversasAtendimento(options?: {
  canal?: string
  estado?: string
  prioridade?: string
  search?: string
}): Promise<AtendimentoConversa[]> {
  const filters: string[] = []

  if (options?.canal && options.canal !== 'todos') {
    filters.push(`canal = "${options.canal}"`)
  }
  if (options?.estado && options.estado !== 'todos') {
    filters.push(`estado = "${options.estado}"`)
  }
  if (options?.prioridade && options.prioridade !== 'todos') {
    filters.push(`prioridade = "${options.prioridade}"`)
  }
  if (options?.search?.trim()) {
    const q = options.search.trim().replace(/"/g, '\\"')
    filters.push(
      `(contato_nome ~ "${q}" || contato_handle ~ "${q}" || ultima_mensagem_texto ~ "${q}" || categoria ~ "${q}")`,
    )
  }

  const filter = filters.length > 0 ? filters.join(' && ') : undefined

  return await pb.collection('atendimento_conversas').getFullList<AtendimentoConversa>({
    filter,
    sort: '-ultima_atividade_at,-created',
    expand: 'operador_atribuido,chamado_vinculado',
  })
}

// 2. Obter uma conversa específica com expands
export async function getConversaAtendimento(id: string): Promise<AtendimentoConversa> {
  return await pb.collection('atendimento_conversas').getOne<AtendimentoConversa>(id, {
    expand: 'operador_atribuido,chamado_vinculado',
  })
}

// 3. Obter mensagens da conversa
export async function getMensagensAtendimento(conversaId: string): Promise<AtendimentoMensagem[]> {
  return await pb.collection('atendimento_mensagens').getFullList<AtendimentoMensagem>({
    filter: `conversa = "${conversaId}"`,
    sort: 'created',
    expand: 'operador',
  })
}

// 4. Obter dossiê mais recente da conversa
export async function getDossieAtendimento(conversaId: string): Promise<AtendimentoDossie | null> {
  try {
    const records = await pb.collection('atendimento_dossies').getFullList<AtendimentoDossie>({
      filter: `conversa = "${conversaId}"`,
      sort: '-created',
      limit: 1,
      expand: 'agente_sugerido,aceito_por',
    })
    return records.length > 0 ? records[0] : null
  } catch (err) {
    console.warn('Erro ao buscar dossiê de handoff:', err)
    return null
  }
}

// 5. Enviar mensagem do operador e persistir no banco
export async function enviarMensagemOperador(
  conversaId: string,
  texto: string,
  operadorId?: string,
  operadorNome?: string,
): Promise<AtendimentoMensagem> {
  const agoraIso = new Date().toISOString()

  // Cria a mensagem do operador
  const msg = await pb.collection('atendimento_mensagens').create<AtendimentoMensagem>({
    conversa: conversaId,
    direcao: 'saida',
    autor_tipo: 'operador',
    autor_nome: operadorNome || 'Operador',
    operador: operadorId || undefined,
    texto,
  })

  // Atualiza a conversa: marca resposta do SLA se pendente, última atividade e estado
  const conversa = await pb
    .collection('atendimento_conversas')
    .getOne<AtendimentoConversa>(conversaId)
  const patch: Partial<AtendimentoConversa> = {
    ultima_mensagem_texto: texto,
    ultima_atividade_at: agoraIso,
  }

  if (!conversa.sla_resposta_at) {
    patch.sla_resposta_at = agoraIso
  }

  if (conversa.estado === 'NOVA' || conversa.estado === 'HANDOFF_PENDENTE') {
    patch.estado = 'HUMANO_ATIVO'
    if (operadorId && !conversa.operador_atribuido) {
      patch.operador_atribuido = operadorId
    }
  }

  await pb.collection('atendimento_conversas').update(conversaId, patch)

  return msg
}

// 6. Simular/Criar mensagem do usuário (com classificação ITIL em tempo real e recálculo de SLA)
export async function criarMensagemEntrada(
  conversaId: string,
  texto: string,
  contatoNome?: string,
): Promise<AtendimentoMensagem> {
  const agora = new Date()
  const agoraIso = agora.toISOString()

  // Classifica ITIL o texto da mensagem
  const classif = classificarTextoItil(texto)
  const slaMin = SLA_MINUTOS[classif.prioridade]

  const msg = await pb.collection('atendimento_mensagens').create<AtendimentoMensagem>({
    conversa: conversaId,
    direcao: 'entrada',
    autor_tipo: 'usuario',
    autor_nome: contatoNome || 'Usuário',
    texto,
    classificacao: classif,
  })

  // Atualiza conversa com a classificação nova e recalculando prioridade / SLA
  const conversa = await pb
    .collection('atendimento_conversas')
    .getOne<AtendimentoConversa>(conversaId)
  const patch: Partial<AtendimentoConversa> = {
    ultima_mensagem_texto: texto,
    ultima_atividade_at: agoraIso,
    pratica: classif.pratica,
    categoria: classif.categoria,
    impacto: classif.impacto,
    urgencia: classif.urgencia,
    prioridade: classif.prioridade,
    sentimento: classif.sentimento,
    confianca_bot: classif.confianca,
    sla_resposta_deadline: new Date(agora.getTime() + slaMin.resposta * 60000).toISOString(),
    sla_resolucao_deadline: new Date(agora.getTime() + slaMin.resolucao * 60000).toISOString(),
  }

  // Se usuário pede atendente ou sentimento crítico, muda para HANDOFF_PENDENTE se não estiver resolvido
  if (
    classif.sentimento <= -0.6 ||
    texto.toLowerCase().includes('atendente') ||
    texto.toLowerCase().includes('humano')
  ) {
    if (conversa.estado !== 'RESOLVIDA') {
      patch.estado = 'HANDOFF_PENDENTE'
      patch.motivo_handoff = classif.sentimento <= -0.6 ? 'sentimento_negativo' : 'pedido_humano'
    }
  }

  await pb.collection('atendimento_conversas').update(conversaId, patch)

  return msg
}

// 7. Criar nova conversa operacional (WhatsApp, Webchat ou E-mail)
export async function criarNovaConversa(data: {
  canal: CanalAtendimento
  contato_nome: string
  contato_handle?: string
  mensagem_inicial: string
  contato_vip?: boolean
}): Promise<AtendimentoConversa> {
  const agora = new Date()
  const agoraIso = agora.toISOString()

  const classif = classificarTextoItil(data.mensagem_inicial)
  const slaMin = SLA_MINUTOS[classif.prioridade]

  const conversa = await pb.collection('atendimento_conversas').create<AtendimentoConversa>({
    canal: data.canal,
    estado: 'NOVA',
    prioridade: classif.prioridade,
    pratica: classif.pratica,
    categoria: classif.categoria,
    impacto: classif.impacto,
    urgencia: classif.urgencia,
    contato_nome: data.contato_nome,
    contato_handle: data.contato_handle || '',
    contato_vip: !!data.contato_vip,
    contato_locale: 'pt-BR',
    sentimento: classif.sentimento,
    confianca_bot: classif.confianca,
    sla_resposta_deadline: new Date(agora.getTime() + slaMin.resposta * 60000).toISOString(),
    sla_resolucao_deadline: new Date(agora.getTime() + slaMin.resolucao * 60000).toISOString(),
    ultima_mensagem_texto: data.mensagem_inicial,
    ultima_atividade_at: agoraIso,
  })

  await pb.collection('atendimento_mensagens').create({
    conversa: conversa.id,
    direcao: 'entrada',
    autor_tipo: 'usuario',
    autor_nome: data.contato_nome,
    texto: data.mensagem_inicial,
    classificacao: classif,
  })

  return conversa
}

// 8. Buscar operadores reais do sistema para o cálculo de roteamento
export async function getCandidatosAgentes(): Promise<AgenteCandidato[]> {
  try {
    const users = await pb.collection('users').getFullList<{
      id: string
      name?: string
      email?: string
      role?: string
      active?: boolean
    }>({
      filter: 'active = true',
      sort: 'name',
    })

    const agora = Date.now()

    return users.map((u, idx) => {
      const skills = ['geral']
      const nameLower = (u.name || u.email || '').toLowerCase()
      if (idx === 0 || nameLower.includes('admin') || nameLower.includes('luiz')) {
        skills.push('vpn', 'rede', 'senior', 'acessos')
      } else if (idx % 2 === 0) {
        skills.push('acessos', 'erp')
      } else {
        skills.push('vpn', 'infra')
      }

      return {
        id: u.id,
        nome: u.name || u.email || 'Operador',
        email: u.email || '',
        skills,
        idiomas: ['pt-BR'],
        cargaAtual: idx % 3,
        capacidadeMax: 5,
        turnoTerminaEm: new Date(agora + (180 - idx * 25) * 60000).toISOString(),
        online: true,
      }
    })
  } catch (err) {
    console.warn('Erro ao carregar agentes reais:', err)
    return []
  }
}

// 9. Aceitar atendimento: gera dossiê de handoff factual, atribui operador e muda estado para HUMANO_ATIVO
export async function aceitarAtendimento(
  conversaId: string,
  operadorId?: string,
  operadorNome?: string,
): Promise<{ conversa: AtendimentoConversa; dossie: AtendimentoDossie }> {
  const agoraIso = new Date().toISOString()
  const conversa = await pb
    .collection('atendimento_conversas')
    .getOne<AtendimentoConversa>(conversaId)
  const mensagens = await getMensagensAtendimento(conversaId)
  const agentes = await getCandidatosAgentes()

  const roteamento = calcularRoteamentoAgente(conversa, agentes)
  const dossiePayload = gerarDossieHandoff(
    conversa,
    mensagens,
    roteamento.agente,
    roteamento,
    operadorNome || 'Operador',
  )

  const dossie = await pb.collection('atendimento_dossies').create<AtendimentoDossie>({
    ...dossiePayload,
    aceito_por: operadorId || undefined,
    aceito_at: agoraIso,
  })

  const patch: Partial<AtendimentoConversa> = {
    estado: 'HUMANO_ATIVO',
    operador_atribuido: operadorId || conversa.operador_atribuido,
    motivo_handoff: conversa.motivo_handoff || 'aceite_operador',
    ultima_atividade_at: agoraIso,
  }
  if (!conversa.sla_resposta_at) {
    patch.sla_resposta_at = agoraIso
  }

  const updatedConversa = await pb
    .collection('atendimento_conversas')
    .update<AtendimentoConversa>(conversaId, patch, {
      expand: 'operador_atribuido,chamado_vinculado',
    })

  // Mensagem de continuidade do sistema (sem jargão)
  await pb.collection('atendimento_mensagens').create({
    conversa: conversaId,
    direcao: 'saida',
    autor_tipo: 'sistema',
    autor_nome: 'Sistema',
    texto: `Atendimento assumido por ${operadorNome || 'operador'}. Continuidade iniciada com dossiê estruturado.`,
  })

  return { conversa: updatedConversa, dossie }
}

// 10. Vincular a chamado existente ou criar novo chamado a partir da conversa
export async function vincularChamado(
  conversaId: string,
  ticketId: string,
): Promise<AtendimentoConversa> {
  return await pb
    .collection('atendimento_conversas')
    .update<AtendimentoConversa>(
      conversaId,
      { chamado_vinculado: ticketId },
      { expand: 'operador_atribuido,chamado_vinculado' },
    )
}

// 11. Resolver conversa
export async function resolverConversa(conversaId: string): Promise<AtendimentoConversa> {
  const agoraIso = new Date().toISOString()
  return await pb.collection('atendimento_conversas').update<AtendimentoConversa>(
    conversaId,
    {
      estado: 'RESOLVIDA',
      sla_resolucao_at: agoraIso,
      ultima_atividade_at: agoraIso,
    },
    { expand: 'operador_atribuido,chamado_vinculado' },
  )
}
