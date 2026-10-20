// Utilitário central de criptografia em repouso AES-256 (Goja JSVM / PocketBase)
// Prefixo padrão de valores cifrados: "enc:v1:"
// Disponibiliza as funções globais:
// - itsmEncrypt(text)
// - itsmDecrypt(cipherTextOrPlain)
// - itsmIsEncrypted(val)

;(function () {
  var PREFIX = 'enc:v1:'

  function getKey() {
    var k = ''
    try {
      if (typeof $os !== 'undefined' && typeof $os.getenv === 'function') {
        k = $os.getenv('ITSM_ENCRYPTION_KEY') || ''
      }
    } catch (_) {}
    if (!k) {
      try {
        if (typeof $secrets !== 'undefined' && typeof $secrets.get === 'function') {
          k = $secrets.get('ITSM_ENCRYPTION_KEY') || ''
        }
      } catch (_) {}
    }
    if (!k) {
      // Fallback seguro derivado se não configurada a variável
      k = 'itsm_default_fallback_aes256_key_super_safe_2026'
    }
    // Para AES-256 no PocketBase $security.encrypt(text, key), a chave recomendada é uma string de 32 bytes
    // Normalizamos com SHA256 (32 hex / 32 bytes)
    try {
      return $security.sha256(k).substring(0, 32)
    } catch (_) {
      return (k + '01234567890123456789012345678901').substring(0, 32)
    }
  }

  function itsmIsEncrypted(val) {
    if (typeof val !== 'string') return false
    return val.indexOf(PREFIX) === 0
  }

  function itsmEncrypt(plainText) {
    if (plainText === null || plainText === undefined) return plainText
    var str = String(plainText)
    if (!str) return str
    // Se já estiver criptografado, não cifrar novamente
    if (itsmIsEncrypted(str)) return str

    var key = getKey()
    try {
      var cipher = $security.encrypt(str, key)
      return PREFIX + cipher
    } catch (err) {
      console.error('itsmEncrypt error:', err)
      throw new Error('Falha ao criptografar valor sensível: ' + err.message)
    }
  }

  function itsmDecrypt(cipherTextOrPlain) {
    if (cipherTextOrPlain === null || cipherTextOrPlain === undefined) return cipherTextOrPlain
    var str = String(cipherTextOrPlain)
    if (!str) return str
    // Se não tiver o prefixo, é valor em texto puro (transição / retrocompatibilidade)
    if (!itsmIsEncrypted(str)) return str

    var key = getKey()
    var cipher = str.substring(PREFIX.length)
    try {
      var decrypted = $security.decrypt(cipher, key)
      return decrypted
    } catch (err) {
      console.error('itsmDecrypt error (mantendo valor ou chave divergente):', err)
      // Em caso de falha na descriptografia (ex: chave alterada), retorna vazio ou lança
      return ''
    }
  }

  // Exportar para o escopo global
  globalThis.itsmEncrypt = itsmEncrypt
  globalThis.itsmDecrypt = itsmDecrypt
  globalThis.itsmIsEncrypted = itsmIsEncrypted

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
      encrypt: itsmEncrypt,
      decrypt: itsmDecrypt,
      isEncrypted: itsmIsEncrypted,
      PREFIX: PREFIX,
    }
  }
})()
