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
  type SortingState,
} from '@tanstack/react-table';
import { Search } from 'lucide-react';
import { useBank } from '../../core/config.tsx';
import type { BaseQuestion, QuestionKind, QuestionStatus, QuestionStatusMap, QuizSession } from '../../core/types.ts';
import { isChoiceQuestion, questionKind, questionKindLabels } from '../../core/types.ts';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Checkbox } from './ui/checkbox';
import { Input } from './ui/input';
import { FilterBuilder } from './filter-builder';
import { MarkdownContent } from './markdown-content';
import { Popover, PopoverAnchor, PopoverContent, PopoverTrigger } from './ui/popover';
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

const previewCloseDelay = 180;
const previewOpenDelay = 400;
const questionStatusStyles: Record<QuestionStatus, string> = {
  unanswered: 'border-gray-300 bg-gray-50 text-gray-700',
  revisit: 'border-amber-300 bg-amber-50 text-amber-900',
  complete: 'border-green-300 bg-green-50 text-green-800',
};

const questionKindStyles: Record<QuestionKind, string> = {
  written: 'border-gray-300 bg-gray-50 text-gray-700',
  single: 'border-sky-300 bg-sky-50 text-sky-900',
  multiple: 'border-violet-300 bg-violet-50 text-violet-900',
};

const optionLetter = (index: number): string => String.fromCharCode(65 + index);

function QuestionPreviewPopover({ question }: { question: BaseQuestion }) {
  const [open, setOpen] = useState(false);
  const openTimeout = useRef<number | null>(null);
  const closeTimeout = useRef<number | null>(null);
  const openedByPointer = useRef(false);

  const clearOpenTimeout = () => {
    if (openTimeout.current !== null) {
      window.clearTimeout(openTimeout.current);
      openTimeout.current = null;
    }
  };
  const clearCloseTimeout = () => {
    if (closeTimeout.current !== null) {
      window.clearTimeout(closeTimeout.current);
      closeTimeout.current = null;
    }
  };
  const openPreview = () => {
    clearOpenTimeout();
    clearCloseTimeout();
    setOpen(true);
  };
  const scheduleOpen = () => {
    clearOpenTimeout();
    clearCloseTimeout();
    openTimeout.current = window.setTimeout(() => {
      setOpen(true);
      openTimeout.current = null;
    }, previewOpenDelay);
  };
  const scheduleClose = () => {
    clearOpenTimeout();
    clearCloseTimeout();
    closeTimeout.current = window.setTimeout(() => {
      setOpen(false);
      openedByPointer.current = false;
      closeTimeout.current = null;
    }, previewCloseDelay);
  };

  useEffect(
    () => () => {
      if (openTimeout.current !== null) window.clearTimeout(openTimeout.current);
      if (closeTimeout.current !== null) window.clearTimeout(closeTimeout.current);
    },
    [],
  );

  return (
    <Popover
      open={open}
      onOpenChange={(nextOpen) => {
        if (nextOpen) {
          openPreview();
        } else {
          clearOpenTimeout();
          clearCloseTimeout();
          setOpen(false);
          openedByPointer.current = false;
        }
      }}
    >
      <PopoverAnchor asChild>
        <button
          type="button"
          aria-haspopup="dialog"
          aria-expanded={open}
          aria-label={`Preview question: ${question.title}`}
          className="block max-w-full rounded-sm text-left text-base font-semibold leading-6 text-foreground hover:underline hover:decoration-dotted hover:underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          onPointerEnter={() => {
            openedByPointer.current = true;
            scheduleOpen();
          }}
          onPointerLeave={scheduleClose}
          onFocus={() => {
            if (!openedByPointer.current) scheduleOpen();
          }}
          onBlur={scheduleClose}
          onClick={(event) => {
            event.stopPropagation();
            scheduleOpen();
          }}
        >
          {question.title}
        </button>
      </PopoverAnchor>
      <PopoverContent
        side="right"
        align="start"
        sideOffset={8}
        collisionPadding={12}
        aria-label={`Preview: ${question.title}`}
        className="max-h-[min(70dvh,calc(100dvh-1.5rem))] w-[min(680px,calc(100vw-2rem))] max-w-[calc(100vw-1.5rem)] overflow-y-auto p-0"
        onOpenAutoFocus={(event) => {
          if (openedByPointer.current) event.preventDefault();
        }}
        onPointerEnter={openPreview}
        onPointerLeave={scheduleClose}
        onFocusCapture={openPreview}
        onBlurCapture={scheduleClose}
      >
        <div className="px-4 py-3">
          <MarkdownContent content={question.prompt} />
          {isChoiceQuestion(question) && (
            <ol className="mt-3 space-y-1.5">
              {(question.options ?? []).map((option, index) => (
                <li key={option.id} className="flex items-start gap-2 text-sm text-gray-800">
                  <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border border-gray-300 bg-gray-50 text-[11px] font-bold text-gray-600">
                    {optionLetter(index)}
                  </span>
                  <MarkdownContent content={option.text} className="min-w-0 flex-1 text-sm leading-6" />
                </li>
              ))}
            </ol>
          )}
        </div>
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
  // monsters (they wrap via break-all). Mono averages ~8.4px/char at
  // text-sm, plus px-4 padding. e.g. econ ≈168, info hits the 320 cap.
  const idWidth = useMemo(() => {
    const longest = bank.questions.reduce((n, q) => Math.max(n, q.id.length), 0);
    return Math.min(320, Math.max(120, Math.ceil(longest * 8.4 + 32)));
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
    getQuestionStatuses(bank.namespace).then((statuses) => {
      if (active) setQuestionStatusMap(statuses);
    });
    return () => {
      active = false;
    };
  }, [bank.namespace]);

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
                    <Badge key={String(tag)} variant="secondary">
                      {String(tag)}
                    </Badge>
                  ))}
                </div>
              );
            }
            return <span className="whitespace-normal break-words text-sm text-foreground">{formatCellValue(raw)}</span>;
          },
          enableSorting: sortable,
          size: width,
        } satisfies ColumnDef<BaseQuestion>;
      });

    return [
      {
        id: 'select',
        header: ({ table }) => (
          <Checkbox
            aria-label="Select all matching questions"
            checked={table.getIsAllPageRowsSelected() ? true : table.getIsSomePageRowsSelected() ? 'indeterminate' : false}
            onCheckedChange={(checked) => table.toggleAllPageRowsSelected(checked === true)}
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
        size: 44,
      },
      {
        accessorKey: 'id',
        header: 'ID',
        cell: ({ row }) => (
          <span className="whitespace-normal break-all font-mono text-sm text-muted-foreground">{row.original.id}</span>
        ),
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
              cell: ({ row }) => (
                <div className="flex min-w-0 flex-wrap gap-1">
                  {row.original.tags.map((tag) => (
                    <Badge key={tag} variant="secondary" className="min-w-0 whitespace-normal break-words">
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
          const count = row.original.options?.length ?? 0;
          return (
            <Badge variant="outline" className={questionKindStyles[kind]} title={count > 0 ? `${count} options` : undefined}>
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
            <Badge variant="outline" className={questionStatusStyles[status]}>
              {questionStatusLabels[status]}
            </Badge>
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

  const makeQuiz = async () => {
    const chosenQuestions = bank.questions.filter((question) => rowSelection[question.id]);
    if (chosenQuestions.length === 0) return;
    setCreatingQuiz(true);
    const title = `${chosenQuestions.length}-question practice set`;
    try {
      const quiz = await createQuiz(bank.namespace, title, chosenQuestions.map((question) => question.id));
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
    listQuizzes(bank.namespace).then(setExistingQuizzes, () => setExistingQuizzes([]));
  };

  const addToQuiz = async (quiz: QuizSession) => {
    const existing = new Set(quiz.questionIds);
    const additions = bank.questions.filter((question) => rowSelection[question.id] && !existing.has(question.id));
    setAddingToQuizId(quiz.id);
    setAddToQuizError(false);
    try {
      if (additions.length > 0) {
        await setQuizQuestions(bank.namespace, quiz, [...quiz.questionIds, ...additions.map((question) => question.id)]);
      }
      setAddToQuizOpen(false);
      await navigate({ to: '/quiz/$quizId', params: { quizId: quiz.id } });
    } catch {
      setAddToQuizError(true);
    } finally {
      setAddingToQuizId(null);
    }
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="border-b bg-background px-4 py-3">
        <div className="flex flex-wrap items-center gap-3">
          <label className="relative min-w-[240px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search questions, topics, exams..."
              aria-label="Search questions"
              className="h-11 pl-10 text-base"
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
            <Button variant="ghost" className="h-11 text-base" onClick={clearFilters}>
              Clear filters
            </Button>
          )}
        </div>
      </div>

      <Table containerRef={tableContainerRef} containerClassName="min-h-0 flex-1 overflow-auto" className="table-fixed" style={{ minWidth: minTableWidth }}>
        <TableHeader>
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow key={headerGroup.id}>
              {headerGroup.headers.map((header) => (
                <TableHead
                  key={header.id}
                  // Title and tags are the absorbent columns (no width → take up
                  // slack on wide screens). minTableWidth below floors them.
                  style={header.column.id === 'tags' || header.column.id === 'title' ? undefined : { width: header.getSize() }}
                  className="sticky top-0 z-10 h-12 border-b bg-muted px-4 text-sm font-semibold text-foreground"
                >
                  {header.isPlaceholder ? null : header.column.getCanSort() ? (
                    <button className="font-semibold hover:underline" onClick={header.column.getToggleSortingHandler()}>
                      {flexRender(header.column.columnDef.header, header.getContext())}
                    </button>
                  ) : (
                    flexRender(header.column.columnDef.header, header.getContext())
                  )}
                </TableHead>
              ))}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {tableRows.length > 0 ? (
            <>
              {topPadding > 0 && (
                <TableRow aria-hidden="true" className="border-0">
                  <TableCell colSpan={columns.length} className="border-0 p-0" style={{ height: topPadding }} />
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
                    className="group cursor-pointer"
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
                          'border-b px-4 py-2 align-middle',
                          cell.column.id === 'title' && 'whitespace-normal break-words',
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
                <TableRow aria-hidden="true" className="border-0">
                  <TableCell colSpan={columns.length} className="border-0 p-0" style={{ height: bottomPadding }} />
                </TableRow>
              )}
            </>
          ) : (
            <TableRow>
              <TableCell colSpan={columns.length} className="h-40 text-center">
                <p className="text-lg font-semibold">No matching questions</p>
                <p className="mt-1 text-base text-muted-foreground">Try another search or clear your filters.</p>
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
        <div className="fixed bottom-5 right-1/2 z-30 flex w-[min(600px,calc(100vw-32px))] translate-x-1/2 items-center gap-3 rounded-xl border bg-background p-3 pl-4 shadow-lg">
          <span className="text-base font-semibold">
            {selectedIds.length} {selectedIds.length === 1 ? 'question' : 'questions'} selected
          </span>
          <Button variant="ghost" className="text-base" onClick={() => setRowSelection({})}>
            Clear
          </Button>
          <div className="ml-auto flex gap-2">
            <Popover open={addToQuizOpen} onOpenChange={openAddToQuiz}>
              <PopoverTrigger asChild>
                <Button variant="outline" className="text-base">
                  Add to quiz
                </Button>
              </PopoverTrigger>
              <PopoverContent side="top" align="end" className="w-80 p-1">
                {existingQuizzes === null ? (
                  <p className="m-0 px-3 py-4 text-center text-sm text-muted-foreground">Loading quizzes...</p>
                ) : existingQuizzes.length === 0 ? (
                  <p className="m-0 px-3 py-4 text-center text-sm text-muted-foreground">No quizzes yet. Use "Make quiz" instead.</p>
                ) : (
                  <ul className="m-0 max-h-72 list-none overflow-y-auto p-0">
                    {existingQuizzes.map((quiz) => {
                      const newCount = selectedIds.filter((id) => !quiz.questionIds.includes(id)).length;
                      return (
                        <li key={quiz.id}>
                          <button
                            type="button"
                            disabled={addingToQuizId !== null}
                            onClick={() => addToQuiz(quiz)}
                            className="flex w-full flex-col items-start rounded-sm px-3 py-2 text-left hover:bg-muted focus-visible:bg-muted focus-visible:outline-none disabled:opacity-50"
                          >
                            <span className="text-sm font-medium">{quiz.title}</span>
                            <span className="text-xs text-muted-foreground">
                              {addingToQuizId === quiz.id
                                ? 'Adding...'
                                : `${quiz.questionIds.length} ${quiz.questionIds.length === 1 ? 'question' : 'questions'} • ${
                                    newCount === 0 ? 'all selected already included' : `+${newCount} new`
                                  }`}
                            </span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
                {addToQuizError && (
                  <p role="alert" className="m-0 px-3 py-2 text-sm text-red-700">
                    Could not add to that quiz. Please try again.
                  </p>
                )}
              </PopoverContent>
            </Popover>
            <Button className="text-base" onClick={makeQuiz} disabled={creatingQuiz}>
              {creatingQuiz ? 'Making quiz...' : 'Make quiz'}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
