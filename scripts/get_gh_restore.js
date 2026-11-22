/**
 * get_gh_restore.js — utilitário LOCAL (só para o restauro v0.0.503), removido após o restauro.
 * Baixa via hook temporário do backend os arquivos do commit 1479b15 (v0.0.503) e grava verbatim.
 * Uso: node --env-file=.env scripts/get_gh_restore.js <path> [path...]
 */
import fs from 'node:fs'
import path from 'node:path'

const BASE = (process.env.VITE_POCKETBASE_URL || '').replace(/\/$/, '')
if (!BASE) {
  console.error(
    'VITE_POCKETBASE_URL não definida (use: node --env-file=.env scripts/get_gh_restore.js ...)',
  )
  process.exit(1)
}

const paths = process.argv.slice(2)
if (!paths.length) {
  console.error('Nenhum path informado.')
  process.exit(1)
}

for (const p of paths) {
  const url = `${BASE}/backend/v1/gh_restore/file64?path=${encodeURIComponent(p)}`
  try {
    const res = await fetch(url)
    const json = await res.json()
    if (!res.ok || json.error) {
      console.error(`FALHOU ${p}: HTTP ${res.status} ${json.error || ''}`)
      continue
    }
    const content = Buffer.from(json.content, 'base64').toString('utf8')
    const abs = path.join(process.cwd(), p)
    fs.mkdirSync(path.dirname(abs), { recursive: true })
    fs.writeFileSync(abs, content, 'utf8')
    console.log(`OK ${p} (${Buffer.byteLength(content, 'utf8')} bytes)`)
  } catch (err) {
    console.error(`FALHOU ${p}: ${err.message || err}`)
  }
}
console.log('Concluído.')
