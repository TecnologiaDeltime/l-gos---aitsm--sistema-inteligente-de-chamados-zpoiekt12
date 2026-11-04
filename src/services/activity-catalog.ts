import pb from '@/lib/pocketbase/client'
import { getCategories, CategoryRecord } from '@/services/categories'

export const getActivityCatalog = async () => {
  const all = await getCategories()
  return {
    main: all.filter((c) => !c.parent),
    sub: all.filter((c) => c.parent),
  }
}

export const countTicketsForActivity = async (activityId: string): Promise<number> => {
  try {
    const result = await pb.collection('tickets').getList(1, 1, {
      filter: `subcategory = "${activityId}" || category = "${activityId}"`,
    })
    return result.totalItems
  } catch {
    return 0
  }
}

export const checkSubcategoryHasTickets = async (subcategoryId: string): Promise<boolean> => {
  const count = await countTicketsForActivity(subcategoryId)
  return count > 0
}

export interface DeleteActivitySafelyResult {
  mode: 'soft' | 'hard'
  ticketsCount: number
}

/**
 * Exclusão segura de atividade ou subatividade:
 * Se existirem chamados vinculados (como subcategory ou category), marca deleted = true e active = false (soft delete)
 * para preservar a integridade referencial dos chamados antigos e o nome da atividade no histórico.
 * Se não houver chamados vinculados, realiza a exclusão física.
 */
export const deleteActivitySafely = async (
  activityIdOrCategory: string | CategoryRecord,
): Promise<DeleteActivitySafelyResult> => {
  const cat: CategoryRecord =
    typeof activityIdOrCategory === 'string'
      ? await pb.collection('tkt_categories').getOne<CategoryRecord>(activityIdOrCategory)
      : activityIdOrCategory

  let totalTickets = await countTicketsForActivity(cat.id)

  // Se for categoria principal (sem parent), verifica filhos também
  if (!cat.parent) {
    const children = await pb.collection('tkt_categories').getFullList<CategoryRecord>({
      filter: `parent = "${cat.id}"`,
    })

    for (const child of children) {
      const childCount = await countTicketsForActivity(child.id)
      totalTickets += childCount
    }

    if (totalTickets > 0) {
      // Soft delete no pai e nos filhos para preservar integridade
      await pb.collection('tkt_categories').update(cat.id, { deleted: true, active: false })
      for (const child of children) {
        await pb.collection('tkt_categories').update(child.id, { deleted: true, active: false })
      }
      return { mode: 'soft', ticketsCount: totalTickets }
    } else {
      // Exclui fisicamente filhos primeiro, depois pai
      for (const child of children) {
        await pb.collection('tkt_categories').delete(child.id)
      }
      await pb.collection('tkt_categories').delete(cat.id)
      return { mode: 'hard', ticketsCount: 0 }
    }
  }

  // É subatividade
  if (totalTickets > 0) {
    await pb.collection('tkt_categories').update(cat.id, { deleted: true, active: false })
    return { mode: 'soft', ticketsCount: totalTickets }
  } else {
    await pb.collection('tkt_categories').delete(cat.id)
    return { mode: 'hard', ticketsCount: 0 }
  }
}

// Alias de retrocompatibilidade caso alguém importe safeDeleteCategory
export const safeDeleteCategory = async (cat: CategoryRecord): Promise<{ soft: boolean }> => {
  const res = await deleteActivitySafely(cat)
  return { soft: res.mode === 'soft' }
}

export {
  getCategories,
  createCategory,
  updateCategory,
  deleteCategory,
} from '@/services/categories'
export type { CategoryRecord } from '@/services/categories'
