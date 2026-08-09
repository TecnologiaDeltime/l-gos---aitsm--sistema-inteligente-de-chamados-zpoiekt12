import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/hooks/use-auth'
import { useRealtime } from '@/hooks/use-realtime'
import {
  loadDashboardData,
  loadFilterOptions,
  DashboardFilterState,
  DEFAULT_FILTERS,
  DashboardData,
  FilterOptions,
} from '@/services/dashboard'

export function useDashboardData() {
  const { user } = useAuth()
  const [filters, setFilters] = useState<DashboardFilterState>(DEFAULT_FILTERS)
  const [data, setData] = useState<DashboardData | null>(null)
  const [options, setOptions] = useState<FilterOptions | null>(null)
  const [loading, setLoading] = useState(true)
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date())

  const loadData = useCallback(async () => {
    try {
      const result = await loadDashboardData(filters)
      setData(result)
      setLastUpdate(new Date())
    } catch {
      /* silently handled */
    } finally {
      setLoading(false)
    }
  }, [filters])

  useEffect(() => {
    loadFilterOptions()
      .then(setOptions)
      .catch(() => {})
  }, [])

  useEffect(() => {
    if (
      user &&
      (user.role === 'cliente_solicitante' || user.role === 'cliente_gestor') &&
      user.company
    ) {
      setFilters((prev) => ({ ...prev, companyId: user.company! }))
    }
  }, [user])

  useEffect(() => {
    setLoading(true)
    loadData()
  }, [loadData])

  useRealtime('tickets', () => {
    loadData()
  })
  useRealtime('technical_visits', () => {
    loadData()
  })
  useRealtime('contract_periods', () => {
    loadData()
  })

  const updateFilter = useCallback((key: keyof DashboardFilterState, value: string) => {
    setFilters((prev) => ({ ...prev, [key]: value }))
  }, [])

  const clearFilters = useCallback(() => {
    if (
      user &&
      (user.role === 'cliente_solicitante' || user.role === 'cliente_gestor') &&
      user.company
    ) {
      setFilters({ ...DEFAULT_FILTERS, companyId: user.company })
    } else {
      setFilters(DEFAULT_FILTERS)
    }
  }, [user])

  return { data, options, filters, loading, lastUpdate, updateFilter, clearFilters }
}
