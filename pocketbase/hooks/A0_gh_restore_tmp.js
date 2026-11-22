/// <reference path="../pb_data/types.d.ts" />

/**
 * A0_gh_restore_tmp.js — HOOK TEMPORÁRIO (restauração v0.0.486).
 *
 * Serve conteúdo do histórico do GitHub público (fetch outbound) para
 * restaurar o código frontend verbatim no commit da tag v0.0.486.
 *
 * COMMIT DE RESTAURAÇÃO = TAG v0.0.486.
 *
 * Rotas (públicas, somente leitura — conteúdo vem de repositório PÚBLICO):
 * - GET /backend/v1/gh_restore/list                      -> compare base...head: lista de arquivos
 * - GET /backend/v1/gh_restore/file?path=<path>          -> raw do arquivo no commit base (texto puro)
 * - GET /backend/v1/gh_restore/file64?path=<path>        -> idem, content em base64 (binário-safe)
 * - GET /backend/v1/gh_restore/batch?paths=a,b,c         -> vários arquivos de uma vez (texto puro)
 * - GET /backend/v1/gh_restore/stash?path=<path>         -> fatia e grava na collection gh_restore_stash
 *
 * TAG v0.0.486 resolve para o commit 1d67d2f4780812d66b4e388e51a1cf8e2a22e19c.
 *
 * LIÇÃO v0.0.520 (correção do bug "idx: cannot be blank"): gravar campo NUMÉRICO
 * como objeto ({ value: i }) chega em branco no validador do PocketBase. SEMPRE
 * usar número puro: rec.set('idx', i).
 *
 * REGRA: BASE_SHA aponta SEMPRE para a tag v0.0.486 (nunca para 0.0.503):
 *   1d67d2f4780812d66b4e388e51a1cf8e2a22e19c
 *
 * Regras da casa: lógica 100% inline nos callbacks (JSVM); slug com prefixo alfabético.
 * Cron A0_gh_restore_stash_cron a cada 2 minutos: stashea arquivos de frontend sem HTTP externo.
 */

// ---------- ROTA: GET /backend/v1/gh_restore/list ----------
routerAdd('GET', '/backend/v1/gh_restore/list', (e) => {
  const GH_REPO = 'TecnologiaDeltime/l-gos---aitsm--sistema-inteligente-de-chamados-zpoiekt12'
  const BASE_SHA = '1d67d2f4780812d66b4e388e51a1cf8e2a22e19c' // tag v0.0.486

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
  const BASE_SHA = '1d67d2f4780812d66b4e388e51a1cf8e2a22e19c' // tag v0.0.486

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
      return e.json(404, { error: 'Arquivo não existe na v0.0.486: ' + path })
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
  const BASE_SHA = '1d67d2f4780812d66b4e388e51a1cf8e2a22e19c' // tag v0.0.486

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
      return e.json(404, { error: 'Arquivo não existe na v0.0.486: ' + path })
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
// Busca o arquivo no commit base (tag v0.0.486) e o divide em fatias de ~12KB (agora 4KB)
// gravadas na collection temporária gh_restore_stash (idx 0..n-1) para leitura
// posterior via db_query. Idempotente: limpa fatias antigas do mesmo path.
routerAdd('GET', '/backend/v1/gh_restore/stash', (e) => {
  const GH_REPO = 'TecnologiaDeltime/l-gos---aitsm--sistema-inteligente-de-chamados-zpoiekt12'
  const BASE_SHA = '1d67d2f4780812d66b4e388e51a1cf8e2a22e19c' // tag v0.0.486
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
      return e.json(404, { error: 'Arquivo não existe na v0.0.486: ' + path })
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
      rec.set('idx', i) // número PURO — { value: i } chega em branco no validador
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
// Dispara a mesma lógica do stash sem depender de requisição HTTP externa.
// Grava fatias dos arquivos de frontend da v0.0.486 na collection
// gh_restore_stash. Removido junto com o hook após a restauração.
cronAdd('A0_gh_restore_stash_cron', '*/2 * * * *', () => {
  const GH_REPO = 'TecnologiaDeltime/l-gos---aitsm--sistema-inteligente-de-chamados-zpoiekt12'
  const CHUNK = 4000

  // A tag v0.0.486 NÃO existe no GitHub (lista de tags vazia, ref 404 —
  // o SHA 1d67d2f era inválido). Resolve o SHA procurando o commit cuja
  // mensagem contém "v0.0.486" e guarda em path='v0.0.486' (idempotente).
  var BASE_SHA = ''
  try {
    var shaRecs = $app.findRecordsByFilter('gh_restore_stash', "path = 'v0.0.486'", 'idx', 1, 0)
    if (shaRecs.length > 0) BASE_SHA = shaRecs[0].getString('content')
  } catch (sErr) {}
  if (!BASE_SHA) {
    for (var pg = 1; pg <= 3 && !BASE_SHA; pg++) {
      try {
        const cres = $http.send({
          url: 'https://api.github.com/repos/' + GH_REPO + '/commits?per_page=100&page=' + pg,
          method: 'GET',
          headers: {
            'User-Agent': 'logos-restore-tmp',
            Accept: 'application/vnd.github+json',
          },
        })
        if (cres.status >= 300) {
          console.log('gh_restore cron: commits api falhou ' + cres.status + ' pg=' + pg)
          break
        }
        var carr = cres.json && cres.json.length ? cres.json : []
        if (!carr.length) break
        for (var ci = 0; ci < carr.length; ci++) {
          var cmsg = carr[ci].commit && carr[ci].commit.message ? carr[ci].commit.message : ''
          if (cmsg.indexOf('v0.0.486') >= 0) {
            BASE_SHA = carr[ci].sha
            break
          }
        }
      } catch (cErr) {
        break
      }
    }
    if (BASE_SHA) {
      try {
        const col = $app.findCollectionByNameOrId('gh_restore_stash')
        var shaRec = new Record(col)
        shaRec.set('path', 'v0.0.486')
        shaRec.set('idx', 0)
        shaRec.set('total', 1)
        shaRec.set('content', BASE_SHA)
        $app.save(shaRec)
        console.log('gh_restore cron: SHA v0.0.486 resolvido = ' + BASE_SHA)
      } catch (svErr) {}
    } else {
      console.log('gh_restore cron: SHA v0.0.486 NÃO encontrado nos commits')
      return
    }
  }

  // Lista de divergências base...main, guardada em path='__compare__'
  try {
    var hasCmp = $app.findRecordsByFilter('gh_restore_stash', "path = '__compare__'", 'idx', 1, 0)
    if (hasCmp.length === 0) {
      const cmpRes = $http.send({
        url: 'https://api.github.com/repos/' + GH_REPO + '/compare/' + BASE_SHA + '...main',
        method: 'GET',
        headers: {
          'User-Agent': 'logos-restore-tmp',
          Accept: 'application/vnd.github+json',
        },
      })
      if (cmpRes.status < 300 && cmpRes.json && Array.isArray(cmpRes.json.files)) {
        var lines = []
        for (var fi = 0; fi < cmpRes.json.files.length; fi++) {
          var cf = cmpRes.json.files[fi]
          lines.push(cf.status + ' ' + cf.filename)
        }
        var cmpBody = lines.join('\n')
        const col2 = $app.findCollectionByNameOrId('gh_restore_stash')
        var cmpTotal = Math.ceil(cmpBody.length / CHUNK)
        for (var ck = 0; ck < cmpTotal; ck++) {
          var cmpRec = new Record(col2)
          cmpRec.set('path', '__compare__')
          cmpRec.set('idx', ck)
          cmpRec.set('total', cmpTotal)
          cmpRec.set('content', cmpBody.substring(ck * CHUNK, (ck + 1) * CHUNK))
          $app.save(cmpRec)
        }
        console.log('gh_restore cron: compare gravado, arquivos=' + lines.length)
      } else {
        console.log('gh_restore cron: compare falhou ' + cmpRes.status)
      }
    }
  } catch (cmpErr) {
    console.log('gh_restore cron erro compare: ' + (cmpErr.message || cmpErr))
  }
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
      // v0.0.486: sempre refaz o stash (a cada ciclo atualiza as fatias)

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
        // pula os registros de controle (SHA e compare)
        var rec = new Record(col)
        rec.set('path', PATH)
        rec.set('idx', i) // número PURO — { value: i } chega em branco no validador
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
  const BASE_SHA = '1d67d2f4780812d66b4e388e51a1cf8e2a22e19c' // tag v0.0.486

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
