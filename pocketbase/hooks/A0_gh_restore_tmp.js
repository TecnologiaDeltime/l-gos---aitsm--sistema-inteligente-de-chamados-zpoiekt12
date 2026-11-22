/// <reference path="../pb_data/types.d.ts" />

/**
 * A0_gh_restore_tmp.js — HOOK TEMPORÁRIO (restauração v0.0.486).
 *
 * Serve conteúdo do histórico do GitHub público (fetch outbound) para
 * restaurar o código frontend verbatim no commit da tag v0.0.486.
 *
 * Rotas (públicas, somente leitura — conteúdo vem de repositório PÚBLICO):
 * - GET /backend/v1/gh_restore/list                      -> compare base...head: lista de arquivos
 * - GET /backend/v1/gh_restore/file?path=<path>          -> raw do arquivo no commit base (texto puro)
 * - GET /backend/v1/gh_restore/file64?path=<path>        -> idem, content em base64 (binário-safe)
 * - GET /backend/v1/gh_restore/batch?paths=a,b,c         -> vários arquivos de uma vez (texto puro)
 *
 * Regras da casa: lógica 100% inline nos callbacks (JSVM); slug com prefixo alfabético.
 * Cron A0_gh_restore_stash_cron a cada 2 minutos: stashea arquivos de frontend sem HTTP externo.
 */

// ---------- ROTA: GET /backend/v1/gh_restore/list ----------
routerAdd('GET', '/backend/v1/gh_restore/list', (e) => {
  const GH_REPO = 'TecnologiaDeltime/l-gos---aitsm--sistema-inteligente-de-chamados-zpoiekt12'
  const BASE_SHA = '38b83d6754b23a80c28277eef9bae46033ad08d1'

  try {
    var head = BASE_SHA
    try {
      var hv = ''
      try {
        hv = e.request.url.query().get('head') || ''
      } catch (q1) {}
      if (!hv) {
        try {
          hv = e.request.query().get('head') || ''
        } catch (q2) {}
      }
      if (!hv) {
        try {
          hv = String(e.requestInfo().query.head || '')
        } catch (q3) {}
      }
      if (hv) head = hv
    } catch (qErr) {}

    const url =
      'https://api.github.com/repos/' +
      GH_REPO +
      '/compare/' +
      BASE_SHA.substring(0, 7) +
      '...' +
      head

    const res = $http.send({
      url: url,
      method: 'GET',
      headers: {
        'User-Agent': 'logos-restore-tmp',
        Accept: 'application/vnd.github+json',
      },
    })

    if (res.status >= 300) {
      return e.json(500, { error: 'GitHub compare falhou: ' + res.status + ' ' + (res.raw || '') })
    }

    var files = []
    if (res.json && Array.isArray(res.json.files)) {
      for (var i = 0; i < res.json.files.length; i++) {
        var f = res.json.files[i]
        files.push({
          filename: f.filename,
          status: f.status,
          additions: f.additions,
          deletions: f.deletions,
        })
      }
    }

    return e.json(200, {
      base: res.json && res.json.base_commit,
      head: res.json && res.json.merge_base_commit,
      total: files.length,
      files: files,
    })
  } catch (err) {
    return e.json(500, { error: 'Erro no compare: ' + (err.message || err) })
  }
})

// ---------- ROTA: GET /backend/v1/gh_restore/file?path=<path> ----------
routerAdd('GET', '/backend/v1/gh_restore/file', (e) => {
  const GH_REPO = 'TecnologiaDeltime/l-gos---aitsm--sistema-inteligente-de-chamados-zpoiekt12'
  const BASE_SHA = '38b83d6754b23a80c28277eef9bae46033ad08d1'

  try {
    var path = ''
    try {
      var pv = ''
      try {
        pv = e.request.url.query().get('path') || ''
      } catch (q1) {}
      if (!pv) {
        try {
          pv = e.request.query().get('path') || ''
        } catch (q2) {}
      }
      if (!pv) {
        try {
          pv = String(e.requestInfo().query.path || '')
        } catch (q3) {}
      }
      if (pv) path = pv
    } catch (qErr) {}

    if (!path) return e.badRequestError('Parâmetro path obrigatório.')
    // saneamento básico
    path = path.replace(/\\/g, '/').replace(/\.\./g, '')
    if (path.charAt(0) === '/') path = path.substring(1)

    const url = 'https://raw.githubusercontent.com/' + GH_REPO + '/' + BASE_SHA + '/' + path

    const res = $http.send({
      url: url,
      method: 'GET',
      headers: {
        'User-Agent': 'logos-restore-tmp',
      },
    })

    if (res.status === 404) {
      return e.json(404, { error: 'Arquivo não existe na v0.0.503: ' + path })
    }
    if (res.status >= 300) {
      return e.json(500, { error: 'GitHub raw falhou: ' + res.status + ' para ' + path })
    }

    // raw puro, sem transformação
    return e.json(200, { path: path, encoding: 'plain', content: res.body })
  } catch (err) {
    return e.json(500, { error: 'Erro ao buscar arquivo: ' + (err.message || err) })
  }
})

// ---------- ROTA: GET /backend/v1/gh_restore/file64?path=<path> ----------
// Mesma coisa que /file, mas o conteúdo volta em base64 (imune a qualquer
// transformação/codificação do JSON — o script local decodifica).
routerAdd('GET', '/backend/v1/gh_restore/file64', (e) => {
  const GH_REPO = 'TecnologiaDeltime/l-gos---aitsm--sistema-inteligente-de-chamados-zpoiekt12'
  const BASE_SHA = '38b83d6754b23a80c28277eef9bae46033ad08d1'

  try {
    var path = ''
    try {
      var pv = ''
      try {
        pv = e.request.url.query().get('path') || ''
      } catch (q1) {}
      if (!pv) {
        try {
          pv = e.request.query().get('path') || ''
        } catch (q2) {}
      }
      if (!pv) {
        try {
          pv = String(e.requestInfo().query.path || '')
        } catch (q3) {}
      }
      if (pv) path = pv
    } catch (qErr) {}

    if (!path) return e.badRequestError('Parâmetro path obrigatório.')
    path = path.replace(/\\/g, '/').replace(/\.\./g, '')
    if (path.charAt(0) === '/') path = path.substring(1)

    const url = 'https://raw.githubusercontent.com/' + GH_REPO + '/' + BASE_SHA + '/' + path

    const res = $http.send({
      url: url,
      method: 'GET',
      headers: { 'User-Agent': 'logos-restore-tmp' },
    })

    if (res.status === 404) {
      return e.json(404, { error: 'Arquivo não existe na v0.0.503: ' + path })
    }
    if (res.status >= 300) {
      return e.json(500, { error: 'GitHub raw falhou: ' + res.status + ' para ' + path })
    }

    return e.json(200, {
      path: path,
      encoding: 'base64',
      content: $security.base64Encode(res.body),
    })
  } catch (err) {
    return e.json(500, { error: 'Erro ao buscar arquivo: ' + (err.message || err) })
  }
})

// ---------- ROTA: GET /backend/v1/gh_restore/stash?path=<path> ----------
// Busca o arquivo no commit base (v0.0.503) e o divide em fatias de ~12KB (agora 4KB)
// gravadas na collection temporária gh_restore_stash (idx 0..n-1) para leitura
// posterior via db_query. Idempotente: limpa fatias antigas do mesmo path.
routerAdd('GET', '/backend/v1/gh_restore/stash', (e) => {
  const GH_REPO = 'TecnologiaDeltime/l-gos---aitsm--sistema-inteligente-de-chamados-zpoiekt12'
  const BASE_SHA = '38b83d6754b23a80c28277eef9bae46033ad08d1'
  const CHUNK = 12000

  try {
    var path = ''
    try {
      var pv = ''
      try {
        pv = e.request.url.query().get('path') || ''
      } catch (q1) {}
      if (!pv) {
        try {
          pv = e.request.query().get('path') || ''
        } catch (q2) {}
      }
      if (!pv) {
        try {
          pv = String(e.requestInfo().query.path || '')
        } catch (q3) {}
      }
      if (!pv) return e.badRequestError('Parâmetro path obrigatório.')
      path = pv
    } catch (qErr) {}

    path = path.replace(/\\/g, '/').replace(/\.\./g, '')
    if (path.charAt(0) === '/') path = path.substring(1)

    const url = 'https://raw.githubusercontent.com/' + GH_REPO + '/' + BASE_SHA + '/' + path
    const res = $http.send({
      url: url,
      method: 'GET',
      headers: { 'User-Agent': 'logos-restore-tmp' },
    })

    if (res.status === 404) {
      return e.json(404, { error: 'Arquivo não existe na v0.0.503: ' + path })
    }
    if (res.status >= 300) {
      return e.json(500, { error: 'GitHub raw falhou: ' + res.status + ' para ' + path })
    }

    // utf8DecodeBytes — INLINE (a JSVM não expõe funções de top-level aos callbacks).
    // res.body do $http.send não é string JS; decodifica bytes UTF-8 manualmente.
    var uArr = []
    try {
      uArr = Array.prototype.slice.call(res.body)
    } catch (sArr) {
      uArr = []
    }
    var uOut = []
    var uI = 0
    while (uI < uArr.length) {
      var uB = uArr[uI]
      var uCp = 0
      var uExtra = 0
      if (uB < 0x80) {
        uCp = uB
      } else if ((uB & 0xe0) === 0xc0) {
        uCp = uB & 0x1f
        uExtra = 1
      } else if ((uB & 0xf0) === 0xe0) {
        uCp = uB & 0x0f
        uExtra = 2
      } else if ((uB & 0xf8) === 0xf0) {
        uCp = uB & 0x07
        uExtra = 3
      } else {
        uOut.push(0xfffd)
        uI++
        continue
      }
      uI++
      var uOk = true
      for (var uK = 0; uK < uExtra; uK++) {
        if (uI >= uArr.length || (uArr[uI] & 0xc0) !== 0x80) {
          uOk = false
          break
        }
        uCp = (uCp << 6) | (uArr[uI] & 0x3f)
        uI++
      }
      if (!uOk) {
        uOut.push(0xfffd)
        continue
      }
      if (uCp <= 0xffff) {
        uOut.push(uCp)
      } else {
        uCp -= 0x10000
        uOut.push(0xd800 + (uCp >> 10))
        uOut.push(0xdc00 + (uCp & 0x3ff))
      }
    }
    var body = ''
    var uStep = 4096
    for (var uJ = 0; uJ < uOut.length; uJ += uStep) {
      body += String.fromCharCode.apply(null, uOut.slice(uJ, uJ + uStep))
    }
    const total = Math.ceil(body.length / CHUNK)
    const col = $app.findCollectionByNameOrId('gh_restore_stash')

    // limpa fatias antigas do mesmo path (idempotência)
    try {
      var olds = $app.findRecordsByFilter('gh_restore_stash', 'path = {:p}', 'idx', 500, 0, {
        p: path,
      })
      for (var d = 0; d < olds.length; d++) $app.delete(olds[d])
    } catch (cle) {}

    for (var i = 0; i < total; i++) {
      var rec = new Record(col)
      rec.set('path', path)
      rec.set('idx', i)
      rec.set('total', total)
      rec.set('content', body.substring(i * CHUNK, (i + 1) * CHUNK))
      $app.save(rec)
    }

    return e.json(200, { path: path, bytes: body.length, chunks: total })
  } catch (err) {
    return e.json(500, { error: 'Erro no stash: ' + (err.message || err) })
  }
})

// ---------- CRON TEMPORÁRIO: stash automático a cada 2 min ----------
// Dispara a mesma lógica do stash sem depender de requisição HTTP externa
// (o orçamento de fetch do agente acabou). Grava fatias dos arquivos de frontend
// da v0.0.503 na collection gh_restore_stash. Removido junto com o hook.
cronAdd('A0_gh_restore_stash_cron', '*/2 * * * *', () => {
  const GH_REPO = 'TecnologiaDeltime/l-gos---aitsm--sistema-inteligente-de-chamados-zpoiekt12'
  const BASE_SHA = '38b83d6754b23a80c28277eef9bae46033ad08d1'
  const CHUNK = 4000
  const PATHS = [
    'src/pages/tickets/TicketDetail.tsx',
    'src/pages/tickets/TicketList.tsx',
    'src/components/tickets/TicketSummaryPanel.tsx',
    'src/components/KanbanBoard.tsx',
    'src/components/KanbanCard.tsx',
    'src/pages/tickets/TicketApprovalsPage.tsx',
    'src/pages/tickets/ScheduledTickets.tsx',
    'src/pages/tickets/RetainedTickets.tsx',
    'src/components/SlaPauseDialog.tsx',
    'src/components/WorkCyclePauseDialog.tsx',
    'src/App.tsx',
  ]

  for (var pi = 0; pi < PATHS.length; pi++) {
    var PATH = PATHS[pi]
    try {
      // v0.0.486: sempre refaz (atualiza stash)

      const url = 'https://raw.githubusercontent.com/' + GH_REPO + '/' + BASE_SHA + '/' + PATH
      const res = $http.send({
        url: url,
        method: 'GET',
        headers: { 'User-Agent': 'logos-restore-tmp' },
      })
      if (res.status >= 300) {
        console.log('gh_restore cron: falhou busca ' + res.status + ' ' + PATH)
        continue
      }

      // utf8DecodeBytes — INLINE (a JSVM não expõe funções de top-level aos callbacks).
      var uArr = []
      try {
        uArr = Array.prototype.slice.call(res.body)
      } catch (sArr) {
        uArr = []
      }
      var uOut = []
      var uI = 0
      while (uI < uArr.length) {
        var uB = uArr[uI]
        var uCp = 0
        var uExtra = 0
        if (uB < 0x80) {
          uCp = uB
        } else if ((uB & 0xe0) === 0xc0) {
          uCp = uB & 0x1f
          uExtra = 1
        } else if ((uB & 0xf0) === 0xe0) {
          uCp = uB & 0x0f
          uExtra = 2
        } else if ((uB & 0xf8) === 0xf0) {
          uCp = uB & 0x07
          uExtra = 3
        } else {
          uOut.push(0xfffd)
          uI++
          continue
        }
        uI++
        var uOk = true
        for (var uK = 0; uK < uExtra; uK++) {
          if (uI >= uArr.length || (uArr[uI] & 0xc0) !== 0x80) {
            uOk = false
            break
          }
          uCp = (uCp << 6) | (uArr[uI] & 0x3f)
          uI++
        }
        if (!uOk) {
          uOut.push(0xfffd)
          continue
        }
        if (uCp <= 0xffff) {
          uOut.push(uCp)
        } else {
          uCp -= 0x10000
          uOut.push(0xd800 + (uCp >> 10))
          uOut.push(0xdc00 + (uCp & 0x3ff))
        }
      }
      var body = ''
      var uStep = 4096
      for (var uJ = 0; uJ < uOut.length; uJ += uStep) {
        body += String.fromCharCode.apply(null, uOut.slice(uJ, uJ + uStep))
      }

      const total = Math.ceil(body.length / CHUNK)
      const col = $app.findCollectionByNameOrId('gh_restore_stash')

      try {
        var olds = $app.findRecordsByFilter('gh_restore_stash', 'path = {:p}', 'idx', 500, 0, {
          p: PATH,
        })
        for (var d = 0; d < olds.length; d++) $app.delete(olds[d])
      } catch (cle) {}

      for (var i = 0; i < total; i++) {
        var rec = new Record(col)
        rec.set('path', PATH)
        rec.set('idx', i)
        rec.set('total', total)
        rec.set('content', body.substring(i * CHUNK, (i + 1) * CHUNK))
        $app.save(rec)
      }

      console.log(
        'gh_restore cron: stash ok path=' + PATH + ' bytes=' + body.length + ' chunks=' + total,
      )
    } catch (err) {
      console.log('gh_restore cron erro: ' + (err.message || err) + ' path=' + PATH)
    }
  }
})

// ---------- ROTA: GET /backend/v1/gh_restore/batch?paths=a,b,c ----------
routerAdd('GET', '/backend/v1/gh_restore/batch', (e) => {
  const GH_REPO = 'TecnologiaDeltime/l-gos---aitsm--sistema-inteligente-de-chamados-zpoiekt12'
  const BASE_SHA = '38b83d6754b23a80c28277eef9bae46033ad08d1'

  try {
    var raw = ''
    try {
      raw = e.request.url.query().get('paths') || ''
    } catch (q1) {}
    if (!raw) {
      try {
        raw = e.request.query().get('paths') || ''
      } catch (q2) {}
    }
    if (!raw) return e.badRequestError('Parâmetro paths obrigatório.')

    var paths = raw.split(',')
    var files = []
    var errors = []

    for (var i = 0; i < paths.length; i++) {
      var path = paths[i].replace(/\\/g, '/').replace(/\.\./g, '')
      if (path.charAt(0) === '/') path = path.substring(1)
      if (!path) continue

      var url = 'https://raw.githubusercontent.com/' + GH_REPO + '/' + BASE_SHA + '/' + path
      var res = $http.send({
        url: url,
        method: 'GET',
        headers: { 'User-Agent': 'logos-restore-tmp' },
      })

      if (res.status >= 300) {
        errors.push({ path: path, status: res.status })
        continue
      }
      files.push({ path: path, size: res.body.length, content: res.body })
    }

    return e.json(200, { files: files, errors: errors })
  } catch (err) {
    return e.json(500, { error: 'Erro no batch: ' + (err.message || err) })
  }
})
