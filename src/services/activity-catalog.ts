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
  const result = await pb.collection('tickets').getList(1, 1, {
    filter: `subcategory = "${subcategoryId}"`,
  })
  return result.totalItems > 0
}

export {
  getCategories,
  createCategory,
  updateCategory,
  deleteCategory,
} from '@/services/categories'
export type { CategoryRecord } from '@/services/categories'
