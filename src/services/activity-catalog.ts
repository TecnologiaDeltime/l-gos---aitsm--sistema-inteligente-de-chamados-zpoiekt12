import pb from '@/lib/pocketbase/client'
import { getCategories, CategoryRecord } from '@/services/categories'

export const getActivityCatalog = async () => {
  const all = await getCategories()
  return {
    main: all.filter((c) => !c.parent),
    sub: all.filter((c) => c.parent),
  }
}

export const checkSubcategoryHasTickets = async (subcategoryId: string) => {
  try {
    const result = await pb.collection('tickets').getList(1, 1, {
      filter: `subcategory = "${subcategoryId}" || category = "${subcategoryId}"`,
    })
    return result.totalItems > 0
  } catch {
    return false
  }
}

/**
 * Exclusão segura de atividade ou subatividade:
 * Se existirem chamados vinculados (como subcategory ou category), marca deleted = true e active = false (soft delete)
 * para preservar a integridade referencial dos chamados antigos e o nome da atividade no histórico.
 * Se não houver chamados vinculados e for subatividade sem filhos, realiza a exclusão física.
 */
export const safeDeleteCategory = async (cat: CategoryRecord): Promise<{ soft: boolean }> => {
  const hasTickets = await checkSubcategoryHasTickets(cat.id)

  // Se tem filhos (atividade principal com subatividades ativas), desativa/marca deleted também nos filhos
  if (!cat.parent) {
    const children = await pb.collection('tkt_categories').getFullList<CategoryRecord>({
      filter: `parent = "${cat.id}"`,
    })
    // Se algum filho tem chamados ou o próprio pai tem
    let anyChildHasTickets = hasTickets
    for (const child of children) {
      if (!anyChildHasTickets) {
        const childHas = await checkSubcategoryHasTickets(child.id)
        if (childHas) anyChildHasTickets = true
      }
    }

    if (anyChildHasTickets) {
      // Soft delete no pai e nos filhos
      await pb.collection('tkt_categories').update(cat.id, { deleted: true, active: false })
      for (const child of children) {
        await pb.collection('tkt_categories').update(child.id, { deleted: true, active: false })
      }
      return { soft: true }
    } else {
      // Exclui fisicamente filhos primeiro, depois pai
      for (const child of children) {
        await pb.collection('tkt_categories').delete(child.id)
      }
      await pb.collection('tkt_categories').delete(cat.id)
      return { soft: false }
    }
  }

  // É subatividade
  if (hasTickets) {
    await pb.collection('tkt_categories').update(cat.id, { deleted: true, active: false })
    return { soft: true }
  } else {
    await pb.collection('tkt_categories').delete(cat.id)
    return { soft: false }
  }
}

export {
  getCategories,
  createCategory,
  updateCategory,
  deleteCategory,
} from '@/services/categories'
export type { CategoryRecord } from '@/services/categories'
