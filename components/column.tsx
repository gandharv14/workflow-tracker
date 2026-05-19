"use client";

import { useDroppable } from "@dnd-kit/core";
import { DownloadIcon, MailIcon, PlusIcon } from "lucide-react";

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
  workflowSteps: readonly Step[];
  people: Person[];
  totalCount: number;
  hasActiveSearch: boolean;
  selectedIds: Set<string>;
  onToggleSelect: (id: string) => void;
  onMove: (id: string, step: Step) => void;
  onEdit: (person: Person) => void;
  onDelete: (id: string) => void;
  onAddHere: (step: Step) => void;
  onDownload: (step: Step) => void;
  onToggleSelectAll: (ids: string[], shouldSelect: boolean) => void;
  onEmailSentContracts?: () => void;
  isEmailingSentContracts?: boolean;
};

export function Column({
  step,
  workflowSteps,
  people,
  totalCount,
  hasActiveSearch,
  selectedIds,
  onToggleSelect,
  onMove,
  onEdit,
  onDelete,
  onAddHere,
  onDownload,
  onToggleSelectAll,
  onEmailSentContracts,
  isEmailingSentContracts = false,
}: ColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id: `col-${step}` });
  const color = STEP_COLORS[step];
  const visibleIds = people.map((person) => person.id);
  const hasVisiblePeople = visibleIds.length > 0;
  const allVisibleSelected =
    hasVisiblePeople && visibleIds.every((id) => selectedIds.has(id));
  const selectionAction = allVisibleSelected ? "Unselect All" : "Select All";

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
        <div className="flex shrink-0 items-center gap-1">
          <Button
            variant="ghost"
            size="xs"
            className="text-muted-foreground hover:text-foreground"
            onClick={() => onToggleSelectAll(visibleIds, !allVisibleSelected)}
            disabled={!hasVisiblePeople}
            aria-label={`${selectionAction} in ${STEP_LABELS[step]}`}
          >
            {selectionAction}
          </Button>
          {step === "sent_contracts" && onEmailSentContracts ? (
            <Button
              variant="ghost"
              size="xs"
              className="text-muted-foreground hover:text-foreground"
              onClick={onEmailSentContracts}
              disabled={totalCount === 0 || isEmailingSentContracts}
              aria-label="Email Sent Contracts"
            >
              <MailIcon />
              Email
            </Button>
          ) : null}
          <Button
            variant="ghost"
            size="icon-sm"
            className="text-muted-foreground hover:text-foreground"
            onClick={() => onDownload(step)}
            disabled={totalCount === 0}
            aria-label={`Download ${STEP_LABELS[step]} CSV`}
          >
            <DownloadIcon />
          </Button>
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
              workflowSteps={workflowSteps}
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
