import { useState } from 'react'
import { ChevronDown, Circle, Filter, Hash, Plus, Tags, Type, X } from 'lucide-react'
import { Badge } from './ui/badge'
import { Button } from './ui/button'
import { Checkbox } from './ui/checkbox'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from './ui/dropdown-menu'
import { Input } from './ui/input'
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select'
import {
  defaultOperatorByType,
  fieldTypeLabels,
  operatorLabels,
  type FilterField,
  type FilterFieldType,
  type FilterMatch,
  type FilterOperatorId,
  type FilterRule,
} from '../lib/question-filter.ts'
import { cn } from '../lib/utils.ts'

const fieldIcons: Record<FilterFieldType, typeof Filter> = {
  text: Type,
  number: Hash,
  select: Circle,
  multiselect: Tags,
}

type FilterBuilderProps = {
  fields: readonly FilterField[]
  filters: readonly FilterRule[]
  match: FilterMatch
  onAdd: (field: string) => void
  onChange: (id: string, patch: Partial<Omit<FilterRule, 'id'>>) => void
  onRemove: (id: string) => void
  onClear: () => void
  onMatchChange: (match: FilterMatch) => void
}

export function FilterBuilder({
  fields,
  filters,
  match,
  onAdd,
  onChange,
  onRemove,
  onClear,
  onMatchChange,
}: FilterBuilderProps) {
  const [open, setOpen] = useState(false)
  const [adding, setAdding] = useState(false)

  return (
    <Popover
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen)
        if (!nextOpen) setAdding(false)
      }}
    >
      <PopoverTrigger asChild>
        <Button variant="outline" className="h-11 gap-2 text-base">
          <Filter className="size-4" />
          Filter
          {filters.length > 0 && (
            <Badge variant="secondary" className="h-5 min-w-5 rounded-full px-1.5 text-xs tabular-nums">
              {filters.length}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[min(780px,calc(100vw-2rem))] p-0">
        <div className="flex items-center justify-between gap-2 border-b px-3 py-2">
          <p className="text-sm font-semibold">Filters</p>
          {filters.length > 0 && (
            <Button variant="ghost" size="sm" onClick={onClear}>Clear all</Button>
          )}
        </div>

        <div className="space-y-1 px-3 py-3">
          {filters.length === 0 ? (
            <PropertyPicker fields={fields} onPick={onAdd} />
          ) : (
            filters.map((rule, index) => (
              <div key={rule.id}>
                {index > 0 && <MatchToggle match={match} onChange={onMatchChange} />}
                <FilterRuleRow
                  rule={rule}
                  fields={fields}
                  onChange={onChange}
                  onRemove={onRemove}
                />
              </div>
            ))
          )}
        </div>

        {filters.length > 0 && (
          <div className="border-t p-2">
            {adding ? (
              <div className="space-y-1">
                <PropertyPicker
                  fields={fields}
                  onPick={(field) => {
                    onAdd(field)
                    setAdding(false)
                  }}
                />
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full justify-start"
                  onClick={() => setAdding(false)}
                >
                  Cancel
                </Button>
              </div>
            ) : (
              <Button
                variant="ghost"
                size="sm"
                className="w-full justify-start gap-2"
                onClick={() => setAdding(true)}
              >
                <Plus className="size-4" />
                Add filter
              </Button>
            )}
          </div>
        )}
      </PopoverContent>
    </Popover>
  )
}

function PropertyPicker({
  fields,
  onPick,
}: {
  fields: readonly FilterField[]
  onPick: (field: string) => void
}) {
  return (
    <div>
      <p className="px-2 pb-1 pt-1 text-xs font-medium text-muted-foreground">Filter by</p>
      <div className="grid gap-0.5">
        {fields.map((field) => {
          const Icon = fieldIcons[field.type]
          return (
            <button
              key={field.id}
              type="button"
              onClick={() => onPick(field.id)}
              className="flex items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors hover:bg-accent"
            >
              <Icon className="size-4 shrink-0 text-muted-foreground" />
              <span className="flex-1 truncate">{field.label}</span>
              <span className="text-xs text-muted-foreground">{fieldTypeLabels[field.type]}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

function MatchToggle({
  match,
  onChange,
}: {
  match: FilterMatch
  onChange: (match: FilterMatch) => void
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={`Match ${match === 'and' ? 'all' : 'any'} filters`}
          className="my-1 ml-2 inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
          {match === 'and' ? 'And' : 'Or'}
          <ChevronDown className="size-3" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-72">
        <DropdownMenuRadioGroup
          value={match}
          onValueChange={(value) => onChange(value as FilterMatch)}
        >
          <DropdownMenuRadioItem value="and">
            And
            <span className="text-muted-foreground">— all filters must match</span>
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="or">
            Or
            <span className="text-muted-foreground">— at least one must match</span>
          </DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function FilterRuleRow({
  rule,
  fields,
  onChange,
  onRemove,
}: {
  rule: FilterRule
  fields: readonly FilterField[]
  onChange: (id: string, patch: Partial<Omit<FilterRule, 'id'>>) => void
  onRemove: (id: string) => void
}) {
  const field = fields.find((candidate) => candidate.id === rule.field) ?? fields[0]
  if (!field) return null

  const needsValue = rule.operator !== 'isEmpty' && rule.operator !== 'isNotEmpty'

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-muted/30 p-2">
      <Select
        value={rule.field}
        onValueChange={(value) => {
          const nextField = fields.find((candidate) => candidate.id === value)
          if (!nextField) return
          onChange(rule.id, {
            field: nextField.id,
            operator: defaultOperatorByType[nextField.type],
            value: [],
          })
        }}
      >
        <SelectTrigger size="sm" aria-label="Filter field" className="w-[132px]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {fields.map((candidate) => (
            <SelectItem key={candidate.id} value={candidate.id}>{candidate.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={rule.operator}
        onValueChange={(value) =>
          onChange(rule.id, {
            operator: value as FilterOperatorId,
            value: value === 'between' ? [] : rule.value,
          })
        }
      >
        <SelectTrigger size="sm" aria-label="Filter operator" className="w-[172px]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {field.operators.map((operator) => (
            <SelectItem key={operator} value={operator}>{operatorLabels[operator]}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      <div className="min-w-[140px] flex-1">
        {needsValue ? (
          <FilterValueEditor
            field={field}
            rule={rule}
            onChange={(value) => onChange(rule.id, { value })}
          />
        ) : (
          <span className="px-2 text-sm text-muted-foreground">—</span>
        )}
      </div>

      <Button
        variant="ghost"
        size="icon-sm"
        aria-label="Remove filter"
        onClick={() => onRemove(rule.id)}
      >
        <X className="size-4" />
      </Button>
    </div>
  )
}

function FilterValueEditor({
  field,
  rule,
  onChange,
}: {
  field: FilterField
  rule: FilterRule
  onChange: (value: string[]) => void
}) {
  if (field.type === 'number') {
    if (rule.operator === 'between') {
      return (
        <div className="flex items-center gap-2">
          <Input
            type="number"
            inputMode="decimal"
            aria-label="Minimum value"
            placeholder="Min"
            className="h-8"
            value={rule.value[0] ?? ''}
            onChange={(event) => onChange([event.target.value, rule.value[1] ?? ''])}
          />
          <span className="text-xs text-muted-foreground">and</span>
          <Input
            type="number"
            inputMode="decimal"
            aria-label="Maximum value"
            placeholder="Max"
            className="h-8"
            value={rule.value[1] ?? ''}
            onChange={(event) => onChange([rule.value[0] ?? '', event.target.value])}
          />
        </div>
      )
    }

    return (
      <Input
        type="number"
        inputMode="decimal"
        aria-label={`${field.label} value`}
        placeholder={field.placeholder ?? 'Value'}
        className="h-8"
        value={rule.value[0] ?? ''}
        onChange={(event) => onChange([event.target.value])}
      />
    )
  }

  if (field.type === 'text') {
    return (
      <Input
        aria-label={`${field.label} value`}
        placeholder={field.placeholder ?? 'Type a value…'}
        className="h-8"
        value={rule.value[0] ?? ''}
        onChange={(event) => onChange([event.target.value])}
      />
    )
  }

  return <ValuePicker field={field} selected={rule.value} onChange={onChange} />
}

function ValuePicker({
  field,
  selected,
  onChange,
}: {
  field: FilterField
  selected: readonly string[]
  onChange: (value: string[]) => void
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')

  const options = field.options ?? []
  const showSearch = options.length > 8
  const normalizedQuery = query.trim().toLowerCase()
  const visibleOptions = normalizedQuery
    ? options.filter((option) => option.label.toLowerCase().includes(normalizedQuery))
    : options
  const selectedSet = new Set(selected)

  const label = selected.length === 0
    ? 'Select values…'
    : selected.length === 1
      ? options.find((option) => option.value === selected[0])?.label ?? selected[0]!
      : `${selected.length} selected`

  const toggle = (value: string) => {
    onChange(
      selectedSet.has(value)
        ? selected.filter((item) => item !== value)
        : [...selected, value],
    )
  }

  return (
    <Popover
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen)
        if (!nextOpen) setQuery('')
      }}
    >
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={cn(
            'h-8 w-full justify-between font-normal',
            selected.length === 0 && 'text-muted-foreground',
          )}
        >
          <span className="truncate">{label}</span>
          <ChevronDown className="size-4 shrink-0 opacity-60" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-64 p-0">
        {showSearch && (
          <div className="border-b p-2">
            <Input
              autoFocus
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search values…"
              aria-label={`Search ${field.label} values`}
              className="h-8"
            />
          </div>
        )}
        <div className="max-h-64 overflow-y-auto p-1">
          {visibleOptions.length === 0 ? (
            <p className="px-2 py-6 text-center text-sm text-muted-foreground">No matching values</p>
          ) : (
            visibleOptions.map((option) => {
              const checked = selectedSet.has(option.value)
              return (
                <div
                  key={option.value}
                  className="flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent"
                  onClick={() => toggle(option.value)}
                >
                  <Checkbox
                    checked={checked}
                    aria-label={option.label}
                    onClick={(event) => event.stopPropagation()}
                    onCheckedChange={() => toggle(option.value)}
                  />
                  <span className="truncate">{option.label}</span>
                </div>
              )
            })
          )}
        </div>
        {selected.length > 0 && (
          <div className="border-t p-1">
            <Button
              variant="ghost"
              size="sm"
              className="w-full justify-start"
              onClick={() => onChange([])}
            >
              Clear selection
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  )
}
