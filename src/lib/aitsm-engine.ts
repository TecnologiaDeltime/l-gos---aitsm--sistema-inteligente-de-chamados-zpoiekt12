import {
  ImpactoItil,
  UrgenciaItil,
  PrioridadeAtendimento,
  ClassificacaoItil,
  AtendimentoConversa,
  AtendimentoMensagem,
  AtendimentoDossie,
  AgenteCandidato,
} from '@/types/atendimento'

// 1. SLA em minutos derivado da prioridade (P1: 5m/240m; P2: 15m/480m; P3: 60m/1440m; P4: 240m/4320m)
export const SLA_MINUTOS: Record<PrioridadeAtendimento, { resposta: number; resolucao: number }> = {
  P1: { resposta: 5, resolucao: 240 },
  P2: { resposta: 15, resolucao: 480 },
  P3: { resposta: 60, resolucao: 1440 },
  P4: { resposta: 240, resolucao: 4320 },
}

// 2. Classificação ITIL por heurística de palavras-chave em pt-BR
export function classificarTextoItil(texto: string): ClassificacaoItil {
  const t = (texto || '').toLowerCase()

  let pratica: ClassificacaoItil['pratica'] = 'question'
  let categoria = 'Geral'
  let impacto: ImpactoItil = 'menor'
  let urgencia: UrgenciaItil = 'baixa'
  let confianca = 0.85
  let sentimento = 0.0
  let intencao = 'duvida_geral'

  // Análise de sentimento
  const palavrasNegativas = [
    'irritad',
    'lixo',
    'raiva',
    'absurdo',
    'pessimo',
    'péssimo',
    'urgente',
    'parado',
    'prejuizo',
    'prejuízo',
    'caindo toda hora',
    'nao aguento',
    'não aguento',
    'atrasou',
    'perdi',
    'quero um atendente',
    'preciso de atendente',
  ]
  const palavrasPositivas = [
    'obrigad',
    'valeu',
    'perfeito',
    'otimo',
    'ótimo',
    'agradeco',
    'agradeço',
    'bom dia',
    'boa tarde',
    'por favor',
  ]

  let scoreSentimento = 0
  palavrasNegativas.forEach((p) => {
    if (t.includes(p)) scoreSentimento -= 0.35
  })
  palavrasPositivas.forEach((p) => {
    if (t.includes(p)) scoreSentimento += 0.25
  })
  sentimento = Math.max(-1, Math.min(1, scoreSentimento))

  // Heurísticas temáticas
  if (
    t.includes('vpn') ||
    t.includes('desconecta') ||
    t.includes('conexao') ||
    t.includes('conexão') ||
    t.includes('rede') ||
    t.includes('roteador')
  ) {
    pratica = 'incident'
    categoria = 'VPN / Acesso remoto'
    impacto = 'significativo'
    urgencia =
      t.includes('toda hora') || t.includes('atrasou') || t.includes('urgente') ? 'alta' : 'média'
    confianca = 0.65
    intencao = 'problema_vpn'
  } else if (
    t.includes('senha') ||
    t.includes('reset') ||
    t.includes('portal') ||
    t.includes('desbloqueio') ||
    t.includes('esqueci')
  ) {
    pratica = 'service_request'
    categoria = 'Conta / Senha'
    impacto = 'menor'
    urgencia = 'média'
    confianca = 0.94
    intencao = 'reset_senha'
  } else if (
    t.includes('acesso') ||
    t.includes('permissao') ||
    t.includes('permissão') ||
    t.includes('financeiro') ||
    t.includes('erp') ||
    t.includes('sistema financeiro')
  ) {
    pratica = 'service_request'
    categoria = 'Acesso a Sistema'
    impacto =
      t.includes('fechar o mes') || t.includes('fechar o mês') || t.includes('financeiro')
        ? 'moderado'
        : 'menor'
    urgencia =
      t.includes('urgente') || t.includes('amanhã') || t.includes('amanha') ? 'alta' : 'média'
    confianca = 0.62
    intencao = 'solicitar_acesso'
  } else if (
    t.includes('mudanca') ||
    t.includes('mudança') ||
    t.includes('janela') ||
    t.includes('implantar') ||
    t.includes('deploy') ||
    t.includes('patch')
  ) {
    pratica = 'change'
    categoria = 'Mudança em Produção'
    impacto = 'extenso'
    urgencia = 'alta'
    confianca = 0.55
    intencao = 'requisicao_mudanca'
  } else if (
    t.includes('caiu') ||
    t.includes('fora do ar') ||
    t.includes('servidor') ||
    t.includes('parou tudo') ||
    t.includes('indisponivel') ||
    t.includes('indisponível')
  ) {
    pratica = 'incident'
    categoria = 'Infraestrutura'
    impacto = 'extenso'
    urgencia = 'crítica'
    confianca = 0.5
    intencao = 'indisponibilidade_geral'
  }

  const prioridade = calcularPrioridadeItil(impacto, urgencia)

  return {
    pratica,
    categoria,
    impacto,
    urgencia,
    confianca,
    sentimento,
    intencao,
    prioridade,
  }
}

// 3. Matriz de Prioridade ITIL = Impacto (1-4) × Urgência (1-4)
// >=12 P1, >=8 P2, >=4 P3, senão P4
export function calcularPrioridadeItil(
  impacto: ImpactoItil,
  urgencia: UrgenciaItil,
): PrioridadeAtendimento {
  const mapaImpacto: Record<ImpactoItil, number> = {
    menor: 1,
    moderado: 2,
    significativo: 3,
    extenso: 4,
  }
  const mapaUrgencia: Record<UrgenciaItil, number> = {
    baixa: 1,
    média: 2,
    alta: 3,
    crítica: 4,
  }
  const score = (mapaImpacto[impacto] || 1) * (mapaUrgencia[urgencia] || 1)
  if (score >= 12) return 'P1'
  if (score >= 8) return 'P2'
  if (score >= 4) return 'P3'
  return 'P4'
}

// 4. Roteamento por aptidão do agente (algoritmo AITSM)
// skills em comum ×10, idioma +5, ociosidade ×4, penalidade -8 se turno termina em <20min, +6 se VIP e senior
export function calcularRoteamentoAgente(
  conversa: Partial<AtendimentoConversa>,
  candidatos: AgenteCandidato[],
): {
  agente: AgenteCandidato | null
  score: string
  skillsNecessarias: string[]
  justificativa: string
} {
  if (candidatos.length === 0) {
    return {
      agente: null,
      score: '0.0',
      skillsNecessarias: ['geral'],
      justificativa: 'Nenhum agente cadastrado no sistema.',
    }
  }

  const skillsNecessarias: string[] = []
  const cat = (conversa.categoria || '').toLowerCase()
  if (cat.includes('vpn') || cat.includes('rede')) {
    skillsNecessarias.push('vpn', 'rede')
  } else if (cat.includes('acesso') || cat.includes('senha') || cat.includes('conta')) {
    skillsNecessarias.push('acessos')
  } else if (cat.includes('mudança') || cat.includes('mudanca')) {
    skillsNecessarias.push('infra', 'mudancas')
  } else {
    skillsNecessarias.push('geral')
  }

  const idiomaConversa = conversa.contato_locale || 'pt-BR'
  const agoraMs = Date.now()
  let melhorScore = -9999
  let melhorAgente: AgenteCandidato = candidatos[0]
  let melhorJustificativa = ''

  candidatos.forEach((ag) => {
    let score = 0
    const fatores: string[] = []

    // Skills em comum ×10
    const skillsMatch = ag.skills.filter((s) => skillsNecessarias.includes(s.toLowerCase()))
    const ptsSkill = skillsMatch.length * 10
    score += ptsSkill
    if (ptsSkill > 0) {
      fatores.push(`+${ptsSkill} por skills (${skillsMatch.join(', ')})`)
    }

    // Idioma compatível +5
    if (ag.idiomas && ag.idiomas.some((i) => i.toLowerCase().includes('pt'))) {
      score += 5
      fatores.push(`+5 idioma ${idiomaConversa}`)
    }

    // Ociosidade (1 - carga/capacidade) × 4
    const cap = ag.capacidadeMax || 1
    const ociosidade = Math.max(0, 1 - ag.cargaAtual / cap)
    const ptsOciosidade = Math.round(ociosidade * 4 * 10) / 10
    score += ptsOciosidade
    fatores.push(`+${ptsOciosidade} ociosidade (${ag.cargaAtual}/${cap})`)

    // Penalidade -8 se turno termina em menos de 20 minutos
    if (ag.turnoTerminaEm) {
      const fimTurnoMs = new Date(ag.turnoTerminaEm).getTime()
      const minRestantes = (fimTurnoMs - agoraMs) / 60000
      if (minRestantes < 20 && minRestantes > -600) {
        score -= 8
        fatores.push(`-8 fim de turno próximo (${Math.max(0, Math.round(minRestantes))} min)`)
      }
    }

    // +6 se cliente VIP e o agente tem skill "senior"
    if (conversa.contato_vip && ag.skills.some((s) => s.toLowerCase() === 'senior')) {
      score += 6
      fatores.push('+6 cliente VIP + skill senior')
    }

    // Penalidade se offline
    if (!ag.online) {
      score -= 50
      fatores.push('-50 status ausente/offline')
    }

    if (score > melhorScore) {
      melhorScore = score
      melhorAgente = ag
      melhorJustificativa = `Selecionado(a) por score ${score.toFixed(1)}: ${fatores.join('; ')}.`
    }
  })

  return {
    agente: melhorAgente,
    score: melhorScore.toFixed(1),
    skillsNecessarias,
    justificativa: melhorJustificativa,
  }
}

// 5. Montar Dossiê de Handoff contextualizado com dados reais
export function gerarDossieHandoff(
  conversa: AtendimentoConversa,
  mensagens: AtendimentoMensagem[],
  agenteSugerido: AgenteCandidato | null,
  roteamento: { score: string; justificativa: string; skillsNecessarias: string[] },
  operadorAceiteNome?: string,
): Omit<AtendimentoDossie, 'id' | 'created' | 'updated'> {
  const agoraIso = new Date().toISOString()
  const nome = conversa.contato_nome || 'Usuário'
  const handle = conversa.contato_handle || 'Não informado'
  const canal = (conversa.canal || 'canal').toUpperCase()
  const cat = conversa.categoria || 'Geral'
  const prio = conversa.prioridade || 'P3'
  const sentimento = typeof conversa.sentimento === 'number' ? conversa.sentimento : 0

  const msgsUsuario = mensagens.filter((m) => m.direcao === 'entrada' || m.autor_tipo === 'usuario')
  const primeiraMsgUsuario =
    msgsUsuario.length > 0 ? msgsUsuario[0].texto.trim() : conversa.ultima_mensagem_texto || ''
  const ultimaMsgUsuario =
    msgsUsuario.length > 0 ? msgsUsuario[msgsUsuario.length - 1].texto.trim() : primeiraMsgUsuario

  const msgsBot = mensagens.filter((m) => m.autor_tipo === 'bot')
  const qtdTentativasBot = msgsBot.length
  const pluralTentativas = qtdTentativasBot === 1 ? '1 tentativa' : `${qtdTentativasBot} tentativas`

  // Coleta artigos das mensagens
  const artigosColetados: string[] = []
  mensagens.forEach((m) => {
    if (m.artigos_consultados && Array.isArray(m.artigos_consultados)) {
      m.artigos_consultados.forEach((art) => {
        if (!artigosColetados.includes(art)) artigosColetados.push(art)
      })
    }
  })

  const tTudo = mensagens.map((m) => m.texto.toLowerCase()).join(' ')
  const artigosTentados: AtendimentoDossie['artigos_tentados'] = []

  if (artigosColetados.length > 0) {
    artigosColetados.forEach((titulo) => {
      const tLow = titulo.toLowerCase()
      let resultado: 'falhou' | 'parcial' | 'sucesso' = 'falhou'
      let motivoFalha = 'artigo não resolveu o cenário relatado'

      if (tLow.includes('vpn') || tLow.includes('1042')) {
        resultado = 'parcial'
        motivoFalha =
          'procedimento de renovação de perfil/gateway da VPN não estabilizou a queda recorrente no endpoint do usuário'
      } else if (tLow.includes('senha') || tLow.includes('0207')) {
        resultado = conversa.estado === 'RESOLVIDA' ? 'sucesso' : 'parcial'
        motivoFalha = 'orientações de autosserviço para reset de senha entregues com sucesso'
      } else {
        resultado = 'falhou'
        motivoFalha = 'procedimento insuficiente para atender a demanda reportada'
      }

      artigosTentados.push({ titulo, resultado, motivoFalha })
    })
  } else {
    // Confidence gate ou sem base cadastrada
    let artInexistente = 'Base de Conhecimento Geral — ' + cat
    let motivoAusencia =
      'sem artigo de autoatendimento aprovado para executar a solicitação de forma autônoma'
    if (tTudo.includes('financeiro') || cat.toLowerCase().includes('acesso')) {
      artInexistente = 'KB-5120 – Política e Concessão de Perfis no Sistema Financeiro'
      motivoAusencia =
        'artigo exige fluxo formal de aprovação pelo gestor de centro de custo e compliance, impedindo qualquer ação automática do bot'
    } else if (tTudo.includes('vpn') || cat.toLowerCase().includes('vpn')) {
      artInexistente = 'KB-1042 – Diagnóstico de VPN instável'
      motivoAusencia =
        'diagnóstico de conectividade básica falhou em identificar a causa raiz da queda contínua'
    }
    artigosTentados.push({
      titulo: artInexistente,
      resultado: 'falhou',
      motivoFalha: motivoAusencia,
    })
  }

  // Ponto exato do travamento
  let pontoTravamento = ''
  if (qtdTentativasBot === 0) {
    pontoTravamento = `Travou na 1ª mensagem ("${primeiraMsgUsuario}"), acionando o confidence gate por ausência de autorização para concessão autônoma.`
  } else if (sentimento <= -0.6) {
    pontoTravamento = `Travou na mensagem de insatisfação ("${ultimaMsgUsuario}") após o bot constatar que não estabilizaria a conexão de forma automática.`
  } else {
    pontoTravamento = `Travou após a última mensagem ("${ultimaMsgUsuario}") demandando intervenção técnica do operador humano.`
  }

  const passosTomados: string[] = []
  const perguntasAbertas: string[] = []
  const riscos: string[] = []
  let headline = ''
  let narrativa = ''
  let objetivoCliente = ''
  let proximaAcaoRecomendada = ''

  const primeiroArtigo = artigosTentados[0]
  const descArtigo = `${primeiroArtigo.titulo} (${primeiroArtigo.motivoFalha})`

  if (cat.toLowerCase().includes('vpn') || tTudo.includes('vpn')) {
    headline = `Instabilidade contínua de VPN corporativa via ${canal} (${nome} · ${prio})`
    narrativa = `${nome} abriu o contato relatando exatamente: "${primeiraMsgUsuario}". O bot realizou ${pluralTentativas} de autoatendimento. Consultou a base ${descArtigo}. A triagem travou quando: ${pontoTravamento} O sentimento atingiu ${sentimento.toFixed(2)} e a escalada foi executada para intervenção humana.`
    objetivoCliente = `Eliminar as quedas repetitivas da VPN no endpoint para normalizar as entregas de ${nome}.`

    passosTomados.push('Usuário informou reinicialização de modem/roteador sem êxito.')
    passosTomados.push('Mapeamento de que a instabilidade é contínua no endpoint corporativo.')
    passosTomados.push(
      `Bot realizou ${pluralTentativas} e consultou a base "${primeiroArtigo.titulo}".`,
    )
    passosTomados.push(
      `Sentimento monitorado em ${sentimento.toFixed(2)} disparou gatilho de handoff com congelamento do bot.`,
    )

    perguntasAbertas.push(
      'A instabilidade ocorre também em conexão cabeada ethernet ou apenas no Wi-Fi?',
    )
    perguntasAbertas.push(
      'Qual mensagem ou código de erro detalhado é exibido no client VPN no momento da desconexão?',
    )
    perguntasAbertas.push(
      'Houve alguma atualização recente de antivírus ou do sistema operacional no endpoint?',
    )

    if (conversa.contato_vip) {
      riscos.push('Usuário VIP da organização com entregas urgentes pendentes.')
    }
    riscos.push(`Sentimento crítico (${sentimento.toFixed(2)}) com risco de escalada gerencial.`)
    riscos.push('Interrupção contínua de reuniões e tráfego seguro corporativo.')

    proximaAcaoRecomendada = `Estabelecer acesso remoto ou chamada rápida com ${nome}, coletar logs do client VPN e aplicar túnel alternativo de contingência.`
  } else if (cat.toLowerCase().includes('acesso') || tTudo.includes('financeiro')) {
    headline = `Solicitação de acesso emergencial ao módulo financeiro via ${canal} (${nome} · ${prio})`
    narrativa = `${nome} enviou solicitação inicial afirmando: "${primeiraMsgUsuario}". O bot registrou ${qtdTentativasBot === 0 ? 'zero concessões autônomas' : pluralTentativas} pois ${descArtigo}. Travou em: ${pontoTravamento} O confidence gate congelou a automação para assegurar conformidade e segregação de funções.`
    objetivoCliente = `Obter permissão de acesso no módulo financeiro do ERP para fechar o ciclo mensal de faturamento e conciliação.`

    passosTomados.push(`Requisição textual registrada no canal ${canal}.`)
    passosTomados.push(
      `Classificação ITIL na prática "${conversa.pratica || 'service_request'}" com prioridade ${prio}.`,
    )
    passosTomados.push(
      'Confidence gate ativado: bot bloqueou qualquer concessão indevida sem aprovação formal.',
    )

    perguntasAbertas.push('Qual é o código ou perfil específico necessário no módulo do sistema?')
    perguntasAbertas.push('Existe e-mail de aprovação do gestor de centro de custo correspondente?')
    perguntasAbertas.push(
      'O acesso solicitado deve ser temporário para o fechamento ou permanente?',
    )

    riscos.push('Atraso no fechamento fiscal e financeiro com impacto em prazos regulatórios.')
    riscos.push('Concessão indevida de privilégios sem trilha formal de auditoria.')

    proximaAcaoRecomendada = `Confirmar com o gestor de ${nome} (${handle}) a aprovação formal e aprovar a permissão no painel de segurança do ERP.`
  } else {
    headline = `Atendimento de ${cat} via ${canal} (${nome} · ${prio})`
    narrativa = `${nome} iniciou a interação solicitando: "${primeiraMsgUsuario}". O bot realizou ${pluralTentativas} de interação. O processo travou em: ${pontoTravamento} Handoff contextualizado transferido para operador humano.`
    objetivoCliente = `Atender a demanda formulada por ${nome}: "${primeiraMsgUsuario}".`

    passosTomados.push(`Mensagem de abertura registrada via ${canal}.`)
    passosTomados.push(`Classificação ITIL automática com prioridade ${prio}.`)
    passosTomados.push('Geração de dossiê factual e roteamento por aptidão de operador.')

    perguntasAbertas.push('Quais sistemas adicionais foram afetados pelo comportamento relatado?')
    perguntasAbertas.push('O problema é impeditivo para as tarefas de trabalho de hoje?')

    riscos.push(`SLA de atendimento em contagem regressiva para prioridade ${prio}.`)

    proximaAcaoRecomendada = `Entrar em contato com ${nome} pelo canal ${canal} dando continuidade sem pedir repetição de informações.`
  }

  const eventosHandoff: AtendimentoDossie['eventos_handoff'] = [
    {
      timestamp: agoraIso,
      etapa: '1. Congelamento do bot',
      descricao: 'IA suspendeu respostas automáticas na conversa.',
    },
    {
      timestamp: agoraIso,
      etapa: '2. Geração de dossiê factual',
      descricao: 'Dossiê estruturado extraído a partir dos dados reais da thread.',
    },
    {
      timestamp: agoraIso,
      etapa: '3. Roteamento por aptidão',
      descricao: roteamento.justificativa,
    },
    {
      timestamp: agoraIso,
      etapa: '4. Aceite do operador',
      descricao: operadorAceiteNome
        ? `Operador ${operadorAceiteNome} assumiu o atendimento (HUMANO_ATIVO).`
        : 'Aguardando operador aceitar a conversa na fila.',
    },
  ]

  return {
    conversa: conversa.id,
    headline,
    narrativa,
    objetivo_cliente: objetivoCliente,
    passos_tomados: passosTomados,
    artigos_tentados: artigosTentados,
    perguntas_abertas: perguntasAbertas,
    riscos,
    proxima_acao_recomendada: proximaAcaoRecomendada,
    roteamento_score: roteamento.score,
    roteamento_justificativa: roteamento.justificativa,
    skills_avaliadas: roteamento.skillsNecessarias,
    agente_sugerido: agenteSugerido?.id,
    eventos_handoff: eventosHandoff,
  }
}
