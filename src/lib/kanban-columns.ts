const STORAGE_KEY = 'kanban_hidden_columns'

export function getHiddenColumns(): string[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) return JSON.parse(stored)
  } catch {
    /* intentionally ignored */
  }
  return []
}

export function setHiddenColumns(columns: string[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(columns))
}
