"use client";

import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import {
  ArrowRightLeftIcon,
  GripVerticalIcon,
  MoreVerticalIcon,
  PencilIcon,
  Trash2Icon,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { STEP_LABELS, STEP_ORDER, type Step } from "@/lib/steps";
import type { Person } from "@/lib/types";

type PersonCardProps = {
  person: Person;
  selected: boolean;
  onToggleSelect: (id: string) => void;
  onMove: (id: string, step: Step) => void;
  onEdit: (person: Person) => void;
  onDelete: (id: string) => void;
};

export function PersonCard({
  person,
  selected,
  onToggleSelect,
  onMove,
  onEdit,
  onDelete,
}: PersonCardProps) {
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({
      id: person.id,
      data: { step: person.step },
    });

  const style: React.CSSProperties = {
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0.5 : undefined,
  };

  const initials = (person.name ?? person.email)
    .split(/[@\s._-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase() ?? "")
    .join("");

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "group relative flex items-start gap-2 rounded-lg border bg-card px-2.5 py-2 text-card-foreground shadow-sm transition-shadow",
        "hover:shadow-md",
        selected && "ring-2 ring-primary border-primary",
      )}
    >
      <button
        type="button"
        aria-label="Drag handle"
        className={cn(
          "mt-1 flex h-6 w-4 shrink-0 cursor-grab items-center justify-center rounded text-muted-foreground/60 hover:text-foreground",
          "active:cursor-grabbing touch-none",
        )}
        {...attributes}
        {...listeners}
      >
        <GripVerticalIcon className="size-3.5" />
      </button>

      <div className="mt-0.5">
        <Checkbox
          checked={selected}
          onCheckedChange={() => onToggleSelect(person.id)}
          aria-label={`Select ${person.email}`}
        />
      </div>

      <div className="flex min-w-0 flex-1 items-start gap-2">
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted text-[10px] font-medium uppercase text-muted-foreground">
          {initials || "?"}
        </div>
        <div className="min-w-0 flex-1">
          {person.name ? (
            <div className="truncate text-sm font-medium leading-tight">
              {person.name}
            </div>
          ) : null}
          <div
            className={cn(
              "truncate text-xs text-muted-foreground",
              !person.name && "text-sm font-medium text-foreground",
            )}
            title={person.email}
          >
            {person.email}
          </div>
          {person.role ? (
            <div className="mt-1 inline-flex max-w-full rounded-full bg-secondary px-1.5 py-0.5 text-[10px] font-medium text-secondary-foreground">
              <span className="truncate">{person.role}</span>
            </div>
          ) : null}
        </div>
      </div>

      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              className={cn(
                "shrink-0 text-muted-foreground/70 hover:bg-accent hover:text-foreground",
                "opacity-0 group-hover:opacity-100 data-[popup-open]:opacity-100 focus:opacity-100",
              )}
              aria-label={`Open menu for ${person.email}`}
              onPointerDown={(event) => event.stopPropagation()}
              onClick={(event) => event.stopPropagation()}
            >
              <MoreVerticalIcon className="size-4" />
            </Button>
          }
        />
        <DropdownMenuContent align="end" className="w-44">
          <DropdownMenuLabel className="text-xs text-muted-foreground">
            {person.email}
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => onEdit(person)}>
            <PencilIcon className="size-4" /> Edit
          </DropdownMenuItem>
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>
              <ArrowRightLeftIcon className="size-4" /> Move to
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent>
              {STEP_ORDER.map((s) => (
                <DropdownMenuItem
                  key={s}
                  disabled={s === person.step}
                  onClick={() => onMove(person.id, s)}
                >
                  {STEP_LABELS[s]}
                </DropdownMenuItem>
              ))}
            </DropdownMenuSubContent>
          </DropdownMenuSub>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            variant="destructive"
            onClick={() => onDelete(person.id)}
          >
            <Trash2Icon className="size-4" /> Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
