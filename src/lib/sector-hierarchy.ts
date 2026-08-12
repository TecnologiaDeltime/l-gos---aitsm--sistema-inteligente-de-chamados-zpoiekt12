export interface SectorItem {
  id: string
  name: string
  parent?: string
}

export interface SectorNode extends SectorItem {
  children: SectorNode[]
  level: number
}

export function buildSectorTree(sectors: SectorItem[]): SectorNode[] {
  const map = new Map<string, SectorNode>()
  const roots: SectorNode[] = []

  for (const s of sectors) {
    map.set(s.id, { ...s, children: [], level: 0 })
  }

  for (const s of sectors) {
    const node = map.get(s.id)!
    if (s.parent && map.has(s.parent)) {
      map.get(s.parent)!.children.push(node)
    } else {
      roots.push(node)
    }
  }

  const setLevel = (nodes: SectorNode[], level: number) => {
    for (const n of nodes) {
      n.level = level
      setLevel(n.children, level + 1)
    }
  }
  setLevel(roots, 0)

  return roots
}

export function flattenSectorTree(tree: SectorNode[]): SectorNode[] {
  const result: SectorNode[] = []
  const walk = (nodes: SectorNode[]) => {
    for (const n of nodes) {
      result.push(n)
      walk(n.children)
    }
  }
  walk(tree)
  return result
}

export function getSectorIndent(level: number): string {
  return '— '.repeat(level)
}
