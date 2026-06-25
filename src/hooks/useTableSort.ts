import { useState, useMemo, useEffect } from 'react'

export type SortDir = 'asc' | 'desc' | null

function loadSort(key: string): { col: string; dir: SortDir } | null {
  try {
    const raw = localStorage.getItem(`sort:${key}`)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

function saveSort(key: string, col: string, dir: SortDir) {
  try {
    if (dir === null) localStorage.removeItem(`sort:${key}`)
    else localStorage.setItem(`sort:${key}`, JSON.stringify({ col, dir }))
  } catch { /* storage unavailable */ }
}

export function useTableSort<T>(
  data: T[],
  // Define getters at module level (outside the component) to keep reference stable
  getters: Record<string, (item: T) => string | number | boolean | null | undefined>,
  defaultCol: string,
  defaultDir: SortDir,
  storageKey: string,
) {
  const [sortCol, setSortCol] = useState(defaultCol)
  const [sortDir, setSortDir] = useState<SortDir>(defaultDir)

  // Load saved preference after mount to avoid SSR mismatch
  useEffect(() => {
    const saved = loadSort(storageKey)
    if (saved) {
      setSortCol(saved.col)
      setSortDir(saved.dir)
    }
  }, [storageKey])

  function handleSort(col: string) {
    let newDir: SortDir
    if (sortCol === col) {
      if (sortDir === 'asc') newDir = 'desc'
      else if (sortDir === 'desc') newDir = null
      else newDir = 'asc'
    } else {
      newDir = 'asc'
    }
    setSortCol(col)
    setSortDir(newDir)
    saveSort(storageKey, col, newDir)
  }

  const sorted = useMemo(() => {
    if (sortDir === null) return data
    const getter = getters[sortCol]
    if (!getter) return data
    return [...data].sort((a, b) => {
      const av = getter(a) ?? ''
      const bv = getter(b) ?? ''
      let cmp: number
      if (typeof av === 'number' && typeof bv === 'number') {
        cmp = av - bv
      } else if (typeof av === 'boolean' && typeof bv === 'boolean') {
        cmp = Number(av) - Number(bv)
      } else {
        cmp = String(av).localeCompare(String(bv), 'pt-BR', { sensitivity: 'base' })
      }
      return sortDir === 'asc' ? cmp : -cmp
    })
  }, [data, sortCol, sortDir, getters])

  return { sorted, sortCol, sortDir, handleSort }
}
