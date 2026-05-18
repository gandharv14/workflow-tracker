"use client";

import { useDroppable } from "@dnd-kit/core";
import { PlusIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { PersonCard } from "@/components/person-card";
import {
  STEP_COLORS,
  STEP_DESCRIPTIONS,
  STEP_LABELS,
  type Step,
} from "@/lib/steps";
import type { Person } from "@/lib/types";

type ColumnProps = {
  step: Step;
  people: Person[];
  totalCount: number;
  hasActiveSearch: boolean;
  selectedIds: Set<string>;
  onToggleSelect: (id: string) => void;
  onMove: (id: string, step: Step) => void;
  onEdit: (person: Person) => void;
  onDelete: (id: string) => void;
  onAddHere: (step: Step) => void;
};

export function Column({
  step,
  people,
  totalCount,
  hasActiveSearch,
  selectedIds,
  onToggleSelect,
  onMove,
  onEdit,
  onDelete,
  onAddHere,
}: ColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id: `col-${step}` });
  const color = STEP_COLORS[step];

  return (
    <div
      className={cn(
        "flex w-full min-w-[260px] max-w-sm flex-col rounded-xl ring-1 ring-inset",
        color.bg,
        color.ring,
      )}
    >
      <div className="flex items-start justify-between gap-2 px-3 pt-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className={cn("size-2 rounded-full", color.dot)} />
            <h2 className={cn("text-sm font-semibold tracking-tight", color.text)}>
              {STEP_LABELS[step]}
            </h2>
            <span className="rounded-full bg-background/80 px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
              {hasActiveSearch
                ? `${people.length}/${totalCount}`
                : totalCount}
            </span>
          </div>
          <p className="mt-0.5 line-clamp-1 text-[11px] text-muted-foreground">
            {STEP_DESCRIPTIONS[step]}
          </p>
        </div>
        <Button
          variant="ghost"
          size="icon-sm"
          className="text-muted-foreground hover:text-foreground"
          onClick={() => onAddHere(step)}
          aria-label={`Add to ${STEP_LABELS[step]}`}
        >
          <PlusIcon />
        </Button>
      </div>

      <div
        ref={setNodeRef}
        className={cn(
          "mt-2 flex flex-1 flex-col gap-2 rounded-b-xl px-2 pb-3 transition-colors",
          isOver && "bg-foreground/5",
        )}
      >
        {people.length === 0 ? (
          <div className="flex flex-1 items-center justify-center rounded-md border border-dashed border-foreground/10 px-3 py-6 text-center text-xs text-muted-foreground">
            {hasActiveSearch && totalCount > 0
              ? "No matches in this column"
              : "Drop someone here or click + to add"}
          </div>
        ) : (
          people.map((person) => (
            <PersonCard
              key={person.id}
              person={person}
              selected={selectedIds.has(person.id)}
              onToggleSelect={onToggleSelect}
              onMove={onMove}
              onEdit={onEdit}
              onDelete={onDelete}
            />
          ))
        )}
      </div>
    </div>
  );
}
