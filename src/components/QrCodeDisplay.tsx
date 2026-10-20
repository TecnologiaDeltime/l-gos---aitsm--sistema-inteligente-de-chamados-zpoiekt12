import React from 'react'

/**
 * Gerador de QR Code em SVG leve e autônomo (sem dependências externas)
 * Implementação compacta baseada na especificação QR Code Modelo 2
 */

// Tabela de polinômios de log/antilog Galois Field GF(256)
const EXP_TABLE = new Uint8Array(512)
const LOG_TABLE = new Uint8Array(256)

;(function initGF() {
  let x = 1
  for (let i = 0; i < 255; i++) {
    EXP_TABLE[i] = x
    LOG_TABLE[x] = i
    x <<= 1
    if (x & 0x100) x ^= 0x11d
  }
  for (let i = 255; i < 512; i++) {
    EXP_TABLE[i] = EXP_TABLE[i - 255]
  }
})()

function gfMul(x: number, y: number): number {
  if (x === 0 || y === 0) return 0
  return EXP_TABLE[LOG_TABLE[x] + LOG_TABLE[y]]
}

function polyMul(p1: Uint8Array, p2: Uint8Array): Uint8Array {
  const res = new Uint8Array(p1.length + p2.length - 1)
  for (let i = 0; i < p1.length; i++) {
    for (let j = 0; j < p2.length; j++) {
      res[i + j] ^= gfMul(p1[i] as number, p2[j] as number)
    }
  }
  const out = new Uint8Array(res.length)
  out.set(res)
  return out
}

function getGeneratorPoly(degree: number): Uint8Array {
  let poly: Uint8Array = new Uint8Array([1])
  for (let i = 0; i < degree; i++) {
    poly = polyMul(poly, new Uint8Array([1, EXP_TABLE[i] as number]))
  }
  return poly
}

function calculateECC(data: Uint8Array, eccCount: number): Uint8Array {
  const gen = getGeneratorPoly(eccCount)
  const remainder = new Uint8Array(eccCount)
  for (let i = 0; i < data.length; i++) {
    const factor = (data[i] as number) ^ (remainder[0] as number)
    for (let j = 0; j < eccCount - 1; j++) {
      remainder[j] = ((remainder[j + 1] as number) ^ gfMul(gen[j + 1] as number, factor)) as number
    }
    remainder[eccCount - 1] = gfMul(gen[eccCount] as number, factor)
  }
  const out = new Uint8Array(eccCount)
  out.set(remainder)
  return out
}

// Capacidade versão 4 Byte Mode ECC L: 78 bytes de dados úteis (suficiente para otpauth:// de ~100-140 chars versão 5 ou 6)
// Para cobrir URLs de até ~150 caracteres com folga usamos versão 6 (41x41 módulos, 108 bytes de capacidade com ECC L)
function encodeQRMatrix(text: string): boolean[][] {
  const size = 41 // Versão 6
  const matrix: (boolean | null)[][] = Array.from({ length: size }, () => Array(size).fill(null))

  // 1. Finder patterns
  function addFinder(r: number, c: number) {
    for (let i = -1; i <= 7; i++) {
      for (let j = -1; j <= 7; j++) {
        const row = r + i
        const col = c + j
        if (row >= 0 && row < size && col >= 0 && col < size) {
          if (
            (i >= 0 && i <= 6 && (j === 0 || j === 6)) ||
            (j >= 0 && j <= 6 && (i === 0 || i === 6)) ||
            (i >= 2 && i <= 4 && j >= 2 && j <= 4)
          ) {
            matrix[row][col] = true
          } else {
            matrix[row][col] = false
          }
        }
      }
    }
  }
  addFinder(0, 0)
  addFinder(0, size - 7)
  addFinder(size - 7, 0)

  // 2. Alignment pattern para versão 6 (centro em 34, 34)
  function addAlignment(r: number, c: number) {
    for (let i = -2; i <= 2; i++) {
      for (let j = -2; j <= 2; j++) {
        if (Math.abs(i) === 2 || Math.abs(j) === 2 || (i === 0 && j === 0)) {
          matrix[r + i][c + j] = true
        } else {
          matrix[r + i][c + j] = false
        }
      }
    }
  }
  addAlignment(34, 34)
  addAlignment(6, 34)
  addAlignment(34, 6)

  // 3. Timing patterns
  for (let i = 8; i < size - 8; i++) {
    if (matrix[6][i] === null) matrix[6][i] = i % 2 === 0
    if (matrix[i][6] === null) matrix[i][6] = i % 2 === 0
  }

  // 4. Dark module
  matrix[size - 8][8] = true

  // 5. Preparar fluxo de bits (Byte Mode)
  // Formato: 0100 (4 bits) + comprimento (8 bits para ver 1-9) + dados UTF-8
  const utf8 = new TextEncoder().encode(text)
  const bitBuffer: number[] = []
  function pushBits(val: number, len: number) {
    for (let i = len - 1; i >= 0; i--) {
      bitBuffer.push((val >> i) & 1)
    }
  }

  // Mode indicator 0100 (Byte mode)
  pushBits(4, 4)
  pushBits(utf8.length, 8)
  for (let i = 0; i < utf8.length; i++) {
    pushBits(utf8[i], 8)
  }

  // Terminator (até 4 zeros)
  const maxDataBits = 108 * 8 // 864 bits para V6-L
  for (let i = 0; i < 4 && bitBuffer.length < maxDataBits; i++) {
    bitBuffer.push(0)
  }
  while (bitBuffer.length % 8 !== 0 && bitBuffer.length < maxDataBits) {
    bitBuffer.push(0)
  }

  // Pad bytes 11101100 (0xEC) e 00010001 (0x11)
  const padBytes = [0xec, 0x11]
  let padIdx = 0
  while (bitBuffer.length < maxDataBits) {
    pushBits(padBytes[padIdx % 2], 8)
    padIdx++
  }

  // Converter bits em bytes
  const dataBytes = new Uint8Array(108)
  for (let i = 0; i < 108; i++) {
    let byteVal = 0
    for (let b = 0; b < 8; b++) {
      byteVal = (byteVal << 1) | (bitBuffer[i * 8 + b] || 0)
    }
    dataBytes[i] = byteVal
  }

  // Calcular ECC (28 bytes de correção para V6-L)
  const ecc = calculateECC(dataBytes, 28)
  const allCodewords = new Uint8Array(dataBytes.length + ecc.length)
  allCodewords.set(dataBytes, 0)
  allCodewords.set(ecc, dataBytes.length)

  // Expandir todas as palavras-código para bits
  const finalBits: number[] = []
  for (let i = 0; i < allCodewords.length; i++) {
    const val = allCodewords[i]
    for (let b = 7; b >= 0; b--) {
      finalBits.push((val >> b) & 1)
    }
  }

  // 6. Preencher dados na matriz (zigue-zague de 2 em 2 colunas, da direita p/ esquerda)
  let bitIdx = 0
  let upward = true
  for (let right = size - 1; right > 0; right -= 2) {
    if (right === 6) right-- // pular coluna de timing vertical

    const cols = [right, right - 1]
    const rowRange = upward
      ? Array.from({ length: size }, (_, i) => size - 1 - i)
      : Array.from({ length: size }, (_, i) => i)

    for (const r of rowRange) {
      for (const c of cols) {
        if (matrix[r][c] === null) {
          const bit = bitIdx < finalBits.length ? finalBits[bitIdx++] : 0
          // Aplicar máscara padrão (r + c) % 2 === 0
          const mask = (r + c) % 2 === 0
          matrix[r][c] = (bit === 1) !== mask
        }
      }
    }
    upward = !upward
  }

  // 7. Informações de formato para Máscara 0 (L: 01, Mask: 000 -> 01000 com BCH = 111011111000100 ^ 101010000010010 = 010001111010110)
  const formatInfo = [
    true,
    false,
    true,
    false,
    true,
    false,
    false,
    false,
    false,
    false,
    true,
    false,
    false,
    true,
    false,
  ]
  // Inserir ao redor dos finders
  const formatPos: [number, number][] = [
    [8, 0],
    [8, 1],
    [8, 2],
    [8, 3],
    [8, 4],
    [8, 5],
    [8, 7],
    [8, 8],
    [7, 8],
    [5, 8],
    [4, 8],
    [3, 8],
    [2, 8],
    [1, 8],
    [0, 8],
  ]
  for (let i = 0; i < 15; i++) {
    const [r, c] = formatPos[i]
    matrix[r][c] = formatInfo[i]
  }
  // Segundo conjunto de format info
  for (let i = 0; i < 7; i++) {
    matrix[size - 1 - i][8] = formatInfo[i]
  }
  for (let i = 0; i < 8; i++) {
    matrix[8][size - 8 + i] = formatInfo[7 + i]
  }

  // Garantir que nenhum seja null
  return matrix.map((row) => row.map((cell) => !!cell))
}

export interface QrCodeProps {
  value: string
  size?: number
  className?: string
}

export const QrCodeDisplay: React.FC<QrCodeProps> = ({ value, size = 200, className = '' }) => {
  const matrix = React.useMemo(() => {
    try {
      return encodeQRMatrix(value)
    } catch (_) {
      return null
    }
  }, [value])

  if (!matrix) {
    return (
      <div
        style={{ width: size, height: size }}
        className={`flex items-center justify-center bg-muted rounded border text-xs text-muted-foreground ${className}`}
      >
        Erro ao gerar QR Code
      </div>
    )
  }

  const moduleCount = matrix.length
  const cellSize = size / moduleCount

  return (
    <div
      className={`inline-block p-2 bg-white rounded-lg shadow-sm border ${className}`}
      style={{ width: size + 16, height: size + 16 }}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} shapeRendering="crispEdges">
        <rect width={size} height={size} fill="#ffffff" />
        {matrix.map((row, r) =>
          row.map((cell, c) => {
            if (!cell) return null
            return (
              <rect
                key={`${r}-${c}`}
                x={c * cellSize}
                y={r * cellSize}
                width={cellSize}
                height={cellSize}
                fill="#000000"
              />
            )
          }),
        )}
      </svg>
    </div>
  )
}
