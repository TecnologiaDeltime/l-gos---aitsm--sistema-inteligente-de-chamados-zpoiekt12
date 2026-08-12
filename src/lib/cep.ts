export interface CepData {
  logradouro: string
  bairro: string
  localidade: string
  uf: string
}

export async function fetchCep(cep: string): Promise<CepData | null> {
  const cleanCep = cep.replace(/\D/g, '')
  if (cleanCep.length !== 8) return null
  try {
    const res = await fetch(`https://viacep.com.br/ws/${cleanCep}/json/`)
    const data = await res.json()
    if (data.erro) return null
    return data as CepData
  } catch {
    return null
  }
}
