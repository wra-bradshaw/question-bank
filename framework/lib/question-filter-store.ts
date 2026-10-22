// Persisted filter UI state, namespaced per bank.
// Framework-owned: eject with `qb reveal framework/lib/question-filter-store.ts`.

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import {
  defaultOperatorByType,
  filterFieldType,
  type FilterField,
  type FilterMatch,
  type FilterOperatorId,
  type FilterRule,
} from './question-filter.ts';

type QuestionFilterValues = {
  search: string;
  filters: FilterRule[];
  filterMatch: FilterMatch;
};

type QuestionFilterActions = {
  setSearch: (search: string) => void;
  addFilter: (field: string, operator?: FilterOperatorId) => void;
  updateFilter: (id: string, patch: Partial<Omit<FilterRule, 'id'>>) => void;
  removeFilter: (id: string) => void;
  clearFilters: () => void;
  setFilterMatch: (match: FilterMatch) => void;
};

type QuestionFilterStore = QuestionFilterValues & QuestionFilterActions;

let filterIdCounter = 0;

const createFilterId = () => {
  const uuid = globalThis.crypto?.randomUUID?.();
  if (uuid) return uuid;
  filterIdCounter += 1;
  return `filter-${Date.now()}-${filterIdCounter}`;
};

/**
 * The store is created per bank namespace so two banks in one origin don't
 * share filter state. Call once per app (e.g. in your BankProvider setup).
 */
export function createQuestionFilterStore(namespace: string, fields: readonly FilterField[]) {
  return create<QuestionFilterStore>()(
    persist(
      (set) => ({
        search: '',
        filters: [],
        filterMatch: 'and',
        setSearch: (search) => set({ search }),
        addFilter: (field, operator) =>
          set((state) => ({
            filters: [
              ...state.filters,
              {
                id: createFilterId(),
                field,
                operator: operator ?? defaultOperatorByType[filterFieldType(fields, field)],
                value: [],
              },
            ],
          })),
        updateFilter: (id, patch) =>
          set((state) => ({
            filters: state.filters.map((rule) => (rule.id === id ? { ...rule, ...patch } : rule)),
          })),
        removeFilter: (id) =>
          set((state) => ({
            filters: state.filters.filter((rule) => rule.id !== id),
          })),
        clearFilters: () => set({ filters: [] }),
        setFilterMatch: (filterMatch) => set({ filterMatch }),
      }),
      {
        name: `${namespace}-question-bank-filters`,
        version: 2,
        skipHydration: true,
        partialize: ({ search, filters, filterMatch }) => ({ search, filters, filterMatch }),
      },
    ),
  );
}

/** Default singleton for single-bank apps. Create via `createQuestionFilterStore` for multi-bank. */
export const useQuestionFilterStore = create<QuestionFilterStore>()(
  persist(
    (set) => ({
      search: '',
      filters: [],
      filterMatch: 'and' as FilterMatch,
      setSearch: (search: string) => set({ search }),
      addFilter: (field: string, operator?: FilterOperatorId) =>
        set((state) => ({
          filters: [...state.filters, { id: createFilterId(), field, operator: operator ?? 'contains', value: [] }],
        })),
      updateFilter: (id: string, patch: Partial<Omit<FilterRule, 'id'>>) =>
        set((state) => ({
          filters: state.filters.map((rule) => (rule.id === id ? { ...rule, ...patch } : rule)),
        })),
      removeFilter: (id: string) =>
        set((state) => ({
          filters: state.filters.filter((rule) => rule.id !== id),
        })),
      clearFilters: () => set({ filters: [] }),
      setFilterMatch: (filterMatch: FilterMatch) => set({ filterMatch }),
    }),
    {
      name: 'question-bank-filters',
      version: 2,
      skipHydration: true,
      partialize: ({ search, filters, filterMatch }) => ({ search, filters, filterMatch }),
    },
  ),
);
