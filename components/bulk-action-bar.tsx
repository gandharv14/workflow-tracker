"use client";

import { ArrowRightLeftIcon, Trash2Icon, XIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { STEP_LABELS, type Step } from "@/lib/steps";

type BulkActionBarProps = {
  count: number;
  workflowSteps: readonly Step[];
  onMove: (step: Step) => void;
  onDelete: () => void;
  onClear: () => void;
};

export function BulkActionBar({
  count,
  workflowSteps,
  onMove,
  onDelete,
  onClear,
}: BulkActionBarProps) {
  if (count === 0) return null;

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-4 z-40 flex justify-center px-4">
      <div className="pointer-events-auto flex items-center gap-2 rounded-full border bg-popover/95 px-3 py-1.5 text-popover-foreground shadow-lg ring-1 ring-foreground/10 backdrop-blur">
        <span className="text-sm font-medium tabular-nums">
          {count} selected
        </span>
        <span className="h-4 w-px bg-border" aria-hidden />
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button size="sm" variant="secondary">
                <ArrowRightLeftIcon /> Move to
              </Button>
            }
          />
          <DropdownMenuContent align="center" side="top" sideOffset={6}>
            {workflowSteps.map((s) => (
              <DropdownMenuItem key={s} onClick={() => onMove(s)}>
                {STEP_LABELS[s]}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
        <Button size="sm" variant="destructive" onClick={onDelete}>
          <Trash2Icon /> Delete
        </Button>
        <Button
          size="icon-sm"
          variant="ghost"
          onClick={onClear}
          aria-label="Clear selection"
        >
          <XIcon />
        </Button>
      </div>
    </div>
  );
}
