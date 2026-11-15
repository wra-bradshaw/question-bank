// Framework-owned: eject with `qb reveal framework/components/question-bank.tsx`.
// Generic grid: columns + filters derive from bank.fields (config-defined
// schema). Built-ins: select, id, title, tags, status.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { useVirtualizer } from '@tanstack/react-virtual';
import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type RowSelectionState,
  type SortingFn,
  type SortingState,
} from '@tanstack/react-table';
import { ArrowDown, ArrowUp, ChevronsUpDown, Search } from 'lucide-react';
import { useBank } from '../../core/config.tsx';
import type { BaseQuestion, QuestionStatus, QuestionStatusMap, QuizSession } from '../../core/types.ts';
import { getPairingSlots, isChoiceQuestion, questionKind, questionKindLabels } from '../../core/types.ts';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Checkbox } from './ui/checkbox';
import { Input } from './ui/input';
import { FilterBuilder } from './filter-builder';
import { MarkdownContent } from './markdown-content';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import {
  createFilterFields,
  defaultOperatorByType,
  matchesFilters,
  matchesSearch,
  questionStatusLabels,
} from '../lib/question-filter.ts';
import { useQuestionFilterStore } from '../lib/question-filter-store.ts';
import { cn } from '../lib/utils.ts';
import { getQuestionStatuses } from '../lib/question-status-storage.ts';
import { createQuiz, listQuizzes, setQuizQuestions } from '../lib/quiz-storage.ts';

type DragSelection = {
  value: boolean;
  startIndex: number;
  currentIndex: number;
  originalSelection: RowSelectionState;
  pointerId: number;
  startX: number;
  startY: number;
  clientX: number;
  clientY: number;
  moved: boolean;
};

// Number-aware, case-insensitive text sort: "Q2" before "Q10".
const naturalCollator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });
const naturalSort: SortingFn<BaseQuestion> = (rowA, rowB, columnId) =>
  naturalCollator.compare(String(rowA.getValue(columnId) ?? ''), String(rowB.getValue(columnId) ?? ''));

const previewCloseDelay = 180;
const previewOpenDelay = 400;
const questionStatusDot: Record<QuestionStatus, string> = {
  unanswered: 'bg-muted-foreground/40',
  revisit: 'bg-warning',
  complete: 'bg-success',
};

const optionLetter = (index: number): string => String.fromCharCode(65 + index);

/** Short structural summary for the Type badge tooltip, e.g. "5 items · 11 options". */
function kindDetail(question: BaseQuestion): string | undefined {
  switch (questionKind(question)) {
    case 'single':
    case 'multiple':
      return `${question.options?.length ?? 0} options`;
    case 'matching':
      return `${question.items?.length ?? 0} items · ${question.options?.length ?? 0} options`;
    case 'dropdown':
      return `${question.blanks?.length ?? 0} blanks`;
    case 'numerical':
      return question.numeric?.unit ? `Numeric answer (${question.numeric.unit})` : 'Numeric answer';
    default:
      return undefined;
  }
}

function QuestionPreviewPopover({ question }: { question: BaseQuestion }) {
  const pairingSlots = getPairingSlots(question);
  return (
    <Popover>
      <PopoverTrigger
        openOnHover
        delay={previewOpenDelay}
        closeDelay={previewCloseDelay}
        aria-label={`Preview question: ${question.title}`}
        onClick={(event) => event.stopPropagation()}
        className="block max-w-full rounded-sm text-left text-sm font-medium text-foreground decoration-muted-foreground/50 underline-offset-4 hover:underline focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
      >
        {question.title}
      </PopoverTrigger>
      <PopoverContent
        side="right"
        align="start"
        sideOffset={8}
        collisionPadding={12}
        aria-label={`Preview: ${question.title}`}
        className="max-h-[min(70dvh,calc(100dvh-1.5rem))] w-[min(640px,calc(100vw-2rem))] gap-0 overflow-y-auto p-4"
      >
        <MarkdownContent content={question.prompt} />
        {isChoiceQuestion(question) && (
          <ol className="mt-3 grid gap-1.5">
            {(question.options ?? []).map((option, index) => (
              <li key={option.id} className="flex items-start gap-2.5 text-sm">
                <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border text-[11px] font-medium text-muted-foreground tabular-nums">
                  {optionLetter(index)}
                </span>
                <MarkdownContent content={option.text} className="min-w-0 flex-1 text-sm leading-6" />
              </li>
            ))}
          </ol>
        )}
        {pairingSlots.length > 0 && (
          <ol className="mt-3 list-decimal space-y-1 pl-6 text-sm marker:text-muted-foreground">
            {pairingSlots.map((slot, index) => (
              <li key={slot.id}>
                <MarkdownContent inline content={slot.label?.trim() ? slot.label : `Blank ${index + 1}`} />
                <span className="text-muted-foreground"> → ___</span>
              </li>
            ))}
          </ol>
        )}
      </PopoverContent>
    </Popover>
  );
}

function formatCellValue(value: unknown): string {
  if (value === null || value === undefined || value === '') return '—';
  if (Array.isArray(value)) return value.join(', ');
  return String(value);
}

export function QuestionBank() {
  const bank = useBank();
  const navigate = useNavigate();
  const search = useQuestionFilterStore((state) => state.search);
  const filters = useQuestionFilterStore((state) => state.filters);
  const filterMatch = useQuestionFilterStore((state) => state.filterMatch);
  const setSearch = useQuestionFilterStore((state) => state.setSearch);
  const addFilter = useQuestionFilterStore((state) => state.addFilter);
  const updateFilter = useQuestionFilterStore((state) => state.updateFilter);
  const removeFilter = useQuestionFilterStore((state) => state.removeFilter);
  const clearFilters = useQuestionFilterStore((state) => state.clearFilters);
  const setFilterMatch = useQuestionFilterStore((state) => state.setFilterMatch);
  const [questionStatusMap, setQuestionStatusMap] = useState<QuestionStatusMap>({});
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const [sorting, setSorting] = useState<SortingState>(
    (bank.defaultSorting ?? [{ id: 'id' }]).map((s) => ({ id: s.id, desc: s.desc ?? false })),
  );
  const [creatingQuiz, setCreatingQuiz] = useState(false);
  const [addToQuizOpen, setAddToQuizOpen] = useState(false);
  const [existingQuizzes, setExistingQuizzes] = useState<QuizSession[] | null>(null);
  const [addingToQuizId, setAddingToQuizId] = useState<string | null>(null);
  const [addToQuizError, setAddToQuizError] = useState(false);
  const tableContainerRef = useRef<HTMLDivElement>(null);
  const rowSelectionRef = useRef(rowSelection);
  rowSelectionRef.current = rowSelection;
  const dragSelection = useRef<DragSelection | null>(null);
  const pendingCheckboxChange = useRef<{ rowId: string; value: boolean } | null>(null);
  const suppressRowClick = useRef<string | null>(null);

  const filterFields = useMemo(
    () => createFilterFields(bank.questions, bank.fields, bank.hideTagsColumn ?? false),
    [bank],
  );

  // Size the ID column to the data: fits typical ids on one line, caps
  // monsters (they wrap via break-all). Mono averages ~7.3px/char at
  // text-xs, plus px-3 padding each side.
  const idWidth = useMemo(() => {
    const longest = bank.questions.reduce((n, q) => Math.max(n, q.id.length), 0);
    return Math.min(280, Math.max(96, Math.ceil(longest * 7.3 + 24)));
  }, [bank.questions]);

  const handleAddFilter = (field: string) => {
    const type = filterFields.find((f) => f.id === field)?.type ?? 'text';
    addFilter(field, defaultOperatorByType[type]);
  };

  useEffect(() => {
    void useQuestionFilterStore.persist.rehydrate();
  }, []);

  useEffect(() => {
    let active = true;
    getQuestionStatuses(bank).then((statuses) => {
      if (active) setQuestionStatusMap(statuses);
    });
    return () => {
      active = false;
    };
  }, [bank]);

  const filteredQuestions = useMemo(
    () =>
      bank.questions.filter(
        (question) =>
          matchesFilters(filters, filterMatch, filterFields, bank.fields, question, questionStatusMap[question.id] ?? 'unanswered') &&
          matchesSearch(question, search, bank.fields),
      ),
    [bank, filters, filterMatch, filterFields, questionStatusMap, search],
  );

  const columns = useMemo<ColumnDef<BaseQuestion>[]>(() => {
    const customs: ColumnDef<BaseQuestion>[] = bank.fields
      .filter((def) => def.column !== false)
      .map((def) => {
        const header = def.column && typeof def.column === 'object' && def.column.header ? def.column.header : def.label;
        const width = def.column && typeof def.column === 'object' && def.column.width ? def.column.width : undefined;
        const sortable = def.column && typeof def.column === 'object' && def.column.sortable === false ? false : true;
        return {
          id: def.id,
          accessorFn: (row) => {
            const raw = def.getValue(row);
            return Array.isArray(raw) ? raw.join(', ') : (raw ?? '');
          },
          header,
          cell: ({ row }) => {
            const raw = def.getValue(row.original);
            if (def.type === 'multiselect' && Array.isArray(raw)) {
              return (
                <div className="flex flex-wrap gap-1">
                  {(raw as readonly string[]).map((tag) => (
                    <Badge key={String(tag)} variant="secondary" className="h-auto rounded-md font-normal break-words whitespace-normal">
                      {String(tag)}
                    </Badge>
                  ))}
                </div>
              );
            }
            return <span className="text-sm break-words whitespace-normal text-muted-foreground">{formatCellValue(raw)}</span>;
          },
          enableSorting: sortable,
          ...(def.type === 'number' ? {} : { sortingFn: naturalSort }),
          size: width,
        } satisfies ColumnDef<BaseQuestion>;
      });

    return [
      {
        id: 'select',
        header: ({ table }) => (
          <Checkbox
            aria-label="Select all matching questions"
            checked={table.getIsAllPageRowsSelected()}
            indeterminate={!table.getIsAllPageRowsSelected() && table.getIsSomePageRowsSelected()}
            onCheckedChange={(checked) => table.toggleAllPageRowsSelected(checked)}
          />
        ),
        cell: ({ row }) => (
          <Checkbox
            aria-label={`Select ${row.original.title}`}
            checked={row.getIsSelected()}
            onPointerDown={(event) => {
              if (event.button !== 0) return;
              const startIndex = Number(event.currentTarget.closest<HTMLElement>('[data-virtual-index]')?.dataset.virtualIndex);
              if (!Number.isInteger(startIndex)) return;
              suppressRowClick.current = null;
              const value = !row.getIsSelected();
              pendingCheckboxChange.current = { rowId: row.id, value };
              dragSelection.current = {
                value,
                startIndex,
                currentIndex: startIndex,
                originalSelection: { ...rowSelectionRef.current },
                pointerId: event.pointerId,
                startX: event.clientX,
                startY: event.clientY,
                clientX: event.clientX,
                clientY: event.clientY,
                moved: false,
              };
              setRowSelection((current) => (current[row.id] === value ? current : { ...current, [row.id]: value }));
            }}
            onCheckedChange={(checked) => {
              const pendingChange = pendingCheckboxChange.current;
              if (pendingChange?.rowId === row.id) pendingCheckboxChange.current = null;
              const value = pendingChange?.rowId === row.id ? pendingChange.value : checked === true;
              setRowSelection((current) => (current[row.id] === value ? current : { ...current, [row.id]: value }));
            }}
          />
        ),
        enableSorting: false,
        size: 48,
      },
      {
        accessorKey: 'id',
        header: 'ID',
        cell: ({ row }) => (
          <span className="font-mono text-xs break-all whitespace-normal text-muted-foreground">{row.original.id}</span>
        ),
        sortingFn: naturalSort,
        size: idWidth,
      },
      {
        // Sole absorbent column: no fixed size, so it takes up slack on wide
        // screens instead of leaving dead space. Table min-width (below)
        // always reserves 300px for it, so it can never collapse — and text
        // wraps, so it can never paint over neighbours either.
        accessorKey: 'title',
        header: 'Question',
        cell: ({ row }) => <QuestionPreviewPopover question={row.original} />,
        sortingFn: naturalSort,
      },
      // Absorbent like title: no fixed size, takes up slack on wide screens.
      // minTableWidth (below) always reserves 200px for it, so it can
      // never collapse to zero the way it did when the fixed columns
      // already summed past the old 1200px floor.
      // Hidden entirely when the bank sets hideTagsColumn (tags that merely
      // duplicate dedicated fields).
      ...(bank.hideTagsColumn
        ? []
        : [
            {
              id: 'tags',
              accessorFn: (row) => row.tags.join(', '),
              header: 'Tags',
              sortingFn: naturalSort,
              cell: ({ row }) => (
                <div className="flex min-w-0 flex-wrap gap-1">
                  {row.original.tags.map((tag) => (
                    <Badge key={tag} variant="secondary" className="h-auto min-w-0 rounded-md font-normal break-words whitespace-normal">
                      {tag}
                    </Badge>
                  ))}
                </div>
              ),
            } satisfies ColumnDef<BaseQuestion>,
          ]),
      {
        id: 'kind',
        accessorFn: (row) => questionKind(row),
        header: 'Type',
        cell: ({ row }) => {
          const kind = questionKind(row.original);
          return (
            <Badge variant="outline" className="font-normal text-muted-foreground" title={kindDetail(row.original)}>
              {questionKindLabels[kind]}
            </Badge>
          );
        },
        size: 132,
      },
      ...customs,
      {
        id: 'status',
        accessorFn: (row) => questionStatusMap[row.id] ?? 'unanswered',
        header: 'Status',
        cell: ({ row }) => {
          const status = questionStatusMap[row.original.id] ?? 'unanswered';
          return (
            <span className="inline-flex items-center gap-2 text-sm text-muted-foreground">
              <span aria-hidden="true" className={cn('size-1.5 shrink-0 rounded-full', questionStatusDot[status])} />
              {questionStatusLabels[status]}
            </span>
          );
        },
        size: 108,
      },
    ];
  }, [bank.fields, bank.hideTagsColumn, idWidth, questionStatusMap]);

  // Floor the table width at the sum of fixed columns plus 300px for the
  // absorbent title and 200px for the absorbent tags, so neither can ever
  // collapse to zero (which squeezed content over neighbouring columns).
  const minTableWidth = useMemo(() => {
    let total = 0;
    for (const column of columns) {
      // ColumnDef inputs use accessorKey instead of id for the id/title columns.
      const key = column.id ?? (column as { accessorKey?: string }).accessorKey;
      if (key === 'title') total += 300;
      else if (key === 'tags') total += 200;
      else total += column.size ?? 150;
    }
    return Math.max(1200, total);
  }, [columns]);

  const table = useReactTable({
    data: filteredQuestions,
    columns,
    state: { globalFilter: search, rowSelection, sorting },
    onRowSelectionChange: setRowSelection,
    onSortingChange: setSorting,
    globalFilterFn: (row, _columnId, filterValue) => matchesSearch(row.original, String(filterValue ?? ''), bank.fields),
    getRowId: (row) => row.id,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });
  const tableRows = table.getRowModel().rows;
  const rowVirtualizer = useVirtualizer({
    count: tableRows.length,
    getScrollElement: () => tableContainerRef.current,
    estimateSize: () => 56,
    getItemKey: (index) => tableRows[index]?.id ?? index,
    overscan: 8,
  });
  const virtualRows = rowVirtualizer.getVirtualItems();
  const topPadding = virtualRows[0]?.start ?? 0;
  const bottomPadding =
    virtualRows.length > 0 ? Math.max(rowVirtualizer.getTotalSize() - virtualRows[virtualRows.length - 1]!.end, 0) : 0;

  const updateDragRange = useCallback(
    (index: number) => {
      const activeDrag = dragSelection.current;
      if (!activeDrag || index < 0 || index >= tableRows.length || activeDrag.currentIndex === index) return;
      const previousStart = Math.min(activeDrag.startIndex, activeDrag.currentIndex);
      const previousEnd = Math.max(activeDrag.startIndex, activeDrag.currentIndex);
      const nextStart = Math.min(activeDrag.startIndex, index);
      const nextEnd = Math.max(activeDrag.startIndex, index);
      const affectedStart = Math.min(previousStart, nextStart);
      const affectedEnd = Math.max(previousEnd, nextEnd);
      activeDrag.currentIndex = index;
      activeDrag.moved = true;
      setRowSelection((current) => {
        const next = { ...current };
        let changed = false;
        for (let rowIndex = affectedStart; rowIndex <= affectedEnd; rowIndex += 1) {
          const row = tableRows[rowIndex];
          if (!row) continue;
          const selected = rowIndex >= nextStart && rowIndex <= nextEnd ? activeDrag.value : activeDrag.originalSelection[row.id] === true;
          if ((current[row.id] === true) === selected) continue;
          if (selected) next[row.id] = true;
          else delete next[row.id];
          changed = true;
        }
        return changed ? next : current;
      });
    },
    [tableRows],
  );

  useEffect(() => {
    let animationFrame = 0;
    const autoScroll = () => {
      animationFrame = 0;
      const activeDrag = dragSelection.current;
      const container = tableContainerRef.current;
      if (!activeDrag?.moved || !container) return;
      const rect = container.getBoundingClientRect();
      const viewportTop = rect.top + container.clientTop;
      const viewportBottom = viewportTop + container.clientHeight;
      const edgeSize = Math.min(56, container.clientHeight / 3);
      let scrollDelta = 0;
      if (activeDrag.clientY < viewportTop + edgeSize) {
        const distanceIntoEdge = Math.min(1, (viewportTop + edgeSize - activeDrag.clientY) / edgeSize);
        scrollDelta = -Math.ceil(2 + 14 * distanceIntoEdge ** 2);
      } else if (activeDrag.clientY > viewportBottom - edgeSize) {
        const distanceIntoEdge = Math.min(1, (activeDrag.clientY - (viewportBottom - edgeSize)) / edgeSize);
        scrollDelta = Math.ceil(2 + 14 * distanceIntoEdge ** 2);
      }
      if (scrollDelta !== 0) {
        const previousScrollTop = container.scrollTop;
        container.scrollTop += scrollDelta;
        if (container.scrollTop !== previousScrollTop && animationFrame === 0) {
          animationFrame = window.requestAnimationFrame(autoScroll);
        }
      }
      let targetRow = document.elementFromPoint(activeDrag.clientX, activeDrag.clientY)?.closest<HTMLElement>('[data-virtual-index]');
      if (!targetRow) {
        const visibleRows = [...container.querySelectorAll<HTMLElement>('[data-virtual-index]')].filter((row) => {
          const rowRect = row.getBoundingClientRect();
          return rowRect.bottom > viewportTop && rowRect.top < viewportBottom;
        });
        if (activeDrag.clientY < viewportTop + edgeSize) targetRow = visibleRows[0];
        else if (activeDrag.clientY > viewportBottom - edgeSize) targetRow = visibleRows[visibleRows.length - 1];
      }
      const targetIndex = Number(targetRow?.dataset.virtualIndex);
      if (Number.isInteger(targetIndex)) updateDragRange(targetIndex);
    };
    const trackPointer = (event: PointerEvent) => {
      const activeDrag = dragSelection.current;
      if (!activeDrag || activeDrag.pointerId !== event.pointerId) return;
      activeDrag.clientX = event.clientX;
      activeDrag.clientY = event.clientY;
      if (!activeDrag.moved && Math.hypot(event.clientX - activeDrag.startX, event.clientY - activeDrag.startY) >= 5) {
        activeDrag.moved = true;
      }
      if (activeDrag.moved && animationFrame === 0) {
        animationFrame = window.requestAnimationFrame(autoScroll);
      }
    };
    const stopDragSelection = (event: PointerEvent) => {
      const activeDrag = dragSelection.current;
      if (!activeDrag || activeDrag.pointerId !== event.pointerId) return;
      const target = event.target instanceof Element ? event.target : null;
      const targetCheckbox = target?.closest<HTMLElement>('[role="checkbox"]');
      const targetRow = target?.closest<HTMLElement>('[data-question-row]');
      if (event.type === 'pointerup' && targetRow && !targetCheckbox) {
        suppressRowClick.current = targetRow.dataset.questionRow ?? null;
      }
      const pendingChange = pendingCheckboxChange.current;
      const checkboxRow = targetCheckbox?.closest<HTMLElement>('[data-question-row]');
      if (event.type !== 'pointerup' || checkboxRow?.dataset.questionRow !== pendingChange?.rowId) {
        pendingCheckboxChange.current = null;
      } else if (pendingChange) {
        window.setTimeout(() => {
          if (pendingCheckboxChange.current === pendingChange) pendingCheckboxChange.current = null;
        }, 0);
      }
      dragSelection.current = null;
      if (animationFrame !== 0) window.cancelAnimationFrame(animationFrame);
      animationFrame = 0;
    };
    window.addEventListener('pointermove', trackPointer);
    window.addEventListener('pointerup', stopDragSelection);
    window.addEventListener('pointercancel', stopDragSelection);
    return () => {
      window.removeEventListener('pointermove', trackPointer);
      window.removeEventListener('pointerup', stopDragSelection);
      window.removeEventListener('pointercancel', stopDragSelection);
      if (animationFrame !== 0) window.cancelAnimationFrame(animationFrame);
    };
  }, [updateDragRange]);

  useEffect(() => {
    tableContainerRef.current?.scrollTo({ top: 0 });
  }, [filteredQuestions, search, sorting]);

  const selectedIds = Object.keys(rowSelection).filter((id) => rowSelection[id]);

  // Selected questions in the table's current sort order; any selected rows
  // hidden by the current filters follow in bank order.
  const selectedInTableOrder = (exclude: ReadonlySet<string> = new Set()) => {
    const visible = tableRows.map((row) => row.original);
    const visibleIds = new Set(visible.map((question) => question.id));
    return [...visible, ...bank.questions.filter((question) => !visibleIds.has(question.id))].filter(
      (question) => rowSelection[question.id] && !exclude.has(question.id),
    );
  };

  const makeQuiz = async () => {
    const chosenQuestions = selectedInTableOrder();
    if (chosenQuestions.length === 0) return;
    setCreatingQuiz(true);
    const title = `${chosenQuestions.length}-question practice set`;
    try {
      const quiz = await createQuiz(bank, title, chosenQuestions.map((question) => question.id));
      await navigate({ to: '/quiz/$quizId', params: { quizId: quiz.id } });
    } finally {
      setCreatingQuiz(false);
    }
  };

  const openAddToQuiz = (open: boolean) => {
    setAddToQuizOpen(open);
    if (!open) return;
    setExistingQuizzes(null);
    setAddToQuizError(false);
    listQuizzes(bank).then(setExistingQuizzes, () => setExistingQuizzes([]));
  };

  const addToQuiz = async (quiz: QuizSession) => {
    const existing = new Set(quiz.questionIds);
    const additions = selectedInTableOrder(existing);
    setAddingToQuizId(quiz.id);
    setAddToQuizError(false);
    try {
      if (additions.length > 0) {
        await setQuizQuestions(bank, quiz, [...quiz.questionIds, ...additions.map((question) => question.id)]);
      }
      setAddToQuizOpen(false);
      await navigate({ to: '/quiz/$quizId', params: { quizId: quiz.id } });
    } catch {
      setAddToQuizError(true);
    } finally {
      setAddingToQuizId(null);
    }
  };

  const resultCount = tableRows.length;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex flex-wrap items-center gap-2 border-b px-6 py-3">
        <label className="relative w-full max-w-sm min-w-60 flex-1 sm:flex-none">
          <Search aria-hidden="true" className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search"
            aria-label="Search questions"
            className="pl-8"
          />
        </label>
        <FilterBuilder
          fields={filterFields}
          filters={filters}
          match={filterMatch}
          onAdd={handleAddFilter}
          onChange={updateFilter}
          onRemove={removeFilter}
          onClear={clearFilters}
          onMatchChange={setFilterMatch}
        />
        {filters.length > 0 && (
          <Button variant="ghost" onClick={clearFilters}>
            Clear filters
          </Button>
        )}
        <p className="ml-auto text-xs text-muted-foreground tabular-nums" aria-live="polite">
          {resultCount} {resultCount === 1 ? 'question' : 'questions'}
        </p>
      </div>

      <Table
        containerRef={tableContainerRef}
        containerClassName="min-h-0 flex-1 overflow-auto"
        className="table-fixed"
        style={{ minWidth: minTableWidth }}
      >
        <TableHeader>
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow key={headerGroup.id} className="hover:bg-transparent">
              {headerGroup.headers.map((header) => {
                const sorted = header.column.getIsSorted();
                const SortIcon = sorted === 'asc' ? ArrowUp : sorted === 'desc' ? ArrowDown : ChevronsUpDown;
                return (
                  <TableHead
                    key={header.id}
                    // Title and tags are the absorbent columns (no width → take up
                    // slack on wide screens). minTableWidth floors them.
                    style={header.column.id === 'tags' || header.column.id === 'title' ? undefined : { width: header.getSize() }}
                    aria-sort={sorted === 'asc' ? 'ascending' : sorted === 'desc' ? 'descending' : undefined}
                    className="sticky top-0 z-10 h-9 bg-background px-3 text-xs font-medium text-muted-foreground shadow-[inset_0_-1px_0_var(--border)] first:pl-6 last:pr-6"
                  >
                    {header.isPlaceholder ? null : header.column.getCanSort() ? (
                      <button
                        type="button"
                        className="-mx-1.5 inline-flex items-center gap-1 rounded-md px-1.5 py-1 hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
                        onClick={header.column.getToggleSortingHandler()}
                      >
                        {flexRender(header.column.columnDef.header, header.getContext())}
                        <SortIcon aria-hidden="true" className={cn('size-3.5', !sorted && 'opacity-40')} />
                      </button>
                    ) : (
                      flexRender(header.column.columnDef.header, header.getContext())
                    )}
                  </TableHead>
                );
              })}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {tableRows.length > 0 ? (
            <>
              {topPadding > 0 && (
                <TableRow aria-hidden="true" className="border-0 hover:bg-transparent">
                  <TableCell colSpan={columns.length} className="p-0" style={{ height: topPadding }} />
                </TableRow>
              )}
              {virtualRows.map((virtualRow) => {
                const row = tableRows[virtualRow.index];
                if (!row) return null;
                return (
                  <TableRow
                    key={row.id}
                    ref={rowVirtualizer.measureElement}
                    data-index={virtualRow.index}
                    data-virtual-index={virtualRow.index}
                    data-question-row={row.id}
                    data-state={row.getIsSelected() ? 'selected' : undefined}
                    className="cursor-pointer select-none"
                    onPointerEnter={() => updateDragRange(virtualRow.index)}
                    onClick={() => {
                      if (suppressRowClick.current === row.id) {
                        suppressRowClick.current = null;
                        return;
                      }
                      if (!dragSelection.current) row.toggleSelected();
                    }}
                  >
                    {row.getVisibleCells().map((cell) => (
                      <TableCell
                        key={cell.id}
                        className={cn(
                          'px-3 py-2.5 align-middle first:pl-6 last:pr-6',
                          cell.column.id === 'title' && 'break-words whitespace-normal',
                        )}
                        onClick={cell.column.id === 'select' ? (event) => event.stopPropagation() : undefined}
                      >
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </TableCell>
                    ))}
                  </TableRow>
                );
              })}
              {bottomPadding > 0 && (
                <TableRow aria-hidden="true" className="border-0 hover:bg-transparent">
                  <TableCell colSpan={columns.length} className="p-0" style={{ height: bottomPadding }} />
                </TableRow>
              )}
            </>
          ) : (
            <TableRow className="hover:bg-transparent">
              <TableCell colSpan={columns.length} className="h-48 text-center whitespace-normal">
                <p className="text-sm text-muted-foreground">No matching questions</p>
                <Button
                  variant="outline"
                  className="mt-4"
                  onClick={() => {
                    clearFilters();
                    setSearch('');
                  }}
                >
                  Clear search and filters
                </Button>
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>

      {selectedIds.length > 0 && (
        <div className="fixed bottom-6 left-1/2 z-30 flex w-[min(560px,calc(100vw-2rem))] -translate-x-1/2 items-center gap-2 rounded-xl border bg-popover p-2 pl-4 text-popover-foreground shadow-lg animate-in fade-in-0 slide-in-from-bottom-2">
          <span className="text-sm font-medium tabular-nums">{selectedIds.length} selected</span>
          <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={() => setRowSelection({})}>
            Clear
          </Button>
          <div className="ml-auto flex gap-2">
            <Popover open={addToQuizOpen} onOpenChange={openAddToQuiz}>
              <PopoverTrigger render={<Button variant="outline" />}>Add to quiz</PopoverTrigger>
              <PopoverContent side="top" align="end" sideOffset={8} className="w-80 gap-0 p-1">
                {existingQuizzes === null ? (
                  <p className="px-3 py-4 text-center text-sm text-muted-foreground">Loading…</p>
                ) : existingQuizzes.length === 0 ? (
                  <p className="px-3 py-4 text-center text-sm text-muted-foreground">No quizzes yet</p>
                ) : (
                  <ul className="max-h-72 overflow-y-auto">
                    {existingQuizzes.map((quiz) => {
                      const newCount = selectedIds.filter((id) => !quiz.questionIds.includes(id)).length;
                      return (
                        <li key={quiz.id}>
                          <button
                            type="button"
                            disabled={addingToQuizId !== null}
                            onClick={() => addToQuiz(quiz)}
                            className="flex w-full flex-col items-start gap-0.5 rounded-md px-2.5 py-2 text-left hover:bg-accent focus-visible:bg-accent focus-visible:outline-none disabled:opacity-50"
                          >
                            <span className="text-sm font-medium">{quiz.title}</span>
                            <span className="text-xs text-muted-foreground tabular-nums">
                              {addingToQuizId === quiz.id
                                ? 'Adding…'
                                : `${quiz.questionIds.length} ${quiz.questionIds.length === 1 ? 'question' : 'questions'} · ${
                                    newCount === 0 ? 'all already included' : `+${newCount} new`
                                  }`}
                            </span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
                {addToQuizError && (
                  <p role="alert" className="px-2.5 py-2 text-sm text-destructive">
                    Could not add to that quiz.
                  </p>
                )}
              </PopoverContent>
            </Popover>
            <Button onClick={makeQuiz} disabled={creatingQuiz}>
              {creatingQuiz ? 'Making quiz…' : 'Make quiz'}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
