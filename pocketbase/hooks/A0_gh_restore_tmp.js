/// <reference path="../pb_data/types.d.ts" />

/**
 * A0_gh_restore_tmp.js — HOOK TEMPORÁRIO (restauração v0.0.503).
 *
 * Serve conteúdo do histórico do GitHub público (fetch outbound) para
 * restaurar o código frontend verbatim no commit 1479b1538a8ef6dc88a981e926fc5a4941a5b550 (v0.0.503).
 *
 * Rotas (públicas, somente leitura — conteúdo vem de repositório PÚBLICO):
 * - GET /backend/v1/gh_restore/list                      -> compare 503...HEAD: lista de arquivos (filename, status)
 * - GET /backend/v1/gh_restore/file?path=<path>          -> raw do arquivo no commit base (texto puro, sem transformação)
 *
 * Regras da casa: lógica 100% inline nos callbacks (JSVM); slug com prefixo alfabético.
 */

// ---------- ROTA: GET /backend/v1/gh_restore/list ----------
routerAdd('GET', '/backend/v1/gh_restore/list', (e) => {
  const GH_REPO = 'TecnologiaDeltime/l-gos---aitsm--sistema-inteligente-de-chamados-zpoiekt12'
  const BASE_SHA = '1479b1538a8ef6dc88a981e926fc5a4941a5b550'

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
  const BASE_SHA = '1479b1538a8ef6dc88a981e926fc5a4941a5b550'

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
    return e.json(200, { path: path, content: res.body })
  } catch (err) {
    return e.json(500, { error: 'Erro ao buscar arquivo: ' + (err.message || err) })
  }
})
