"use client";

import * as React from "react";
import {
  DndContext,
  DragOverlay,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { PlusIcon } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { AddPersonDialog } from "@/components/add-person-dialog";
import { EditPersonDialog } from "@/components/edit-person-dialog";
import { BulkActionBar } from "@/components/bulk-action-bar";
import { Column } from "@/components/column";
import { PersonCard } from "@/components/person-card";
import { SearchBar } from "@/components/search-bar";
import {
  bulkRequest,
  createPerson,
  deletePersonRequest,
  patchPerson,
} from "@/lib/api";
import { STEP_LABELS, STEP_ORDER, type Step } from "@/lib/steps";
import type { Person } from "@/lib/types";

type BoardProps = {
  initialPeople: Person[];
};

export function Board({ initialPeople }: BoardProps) {
  const [people, setPeople] = React.useState<Person[]>(initialPeople);
  const [query, setQuery] = React.useState("");
  const [selectedIds, setSelectedIds] = React.useState<Set<string>>(
    () => new Set(),
  );
  const [addOpen, setAddOpen] = React.useState(false);
  const [addInitialStep, setAddInitialStep] = React.useState<Step>("eval");
  const [editing, setEditing] = React.useState<Person | null>(null);
  const [activeId, setActiveId] = React.useState<string | null>(null);

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 4 } }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 120, tolerance: 6 },
    }),
  );

  const peopleById = React.useMemo(() => {
    const map = new Map<string, Person>();
    for (const p of people) map.set(p.id, p);
    return map;
  }, [people]);

  const trimmedQuery = query.trim().toLowerCase();
  const filteredPeople = React.useMemo(() => {
    if (!trimmedQuery) return people;
    return people.filter((p) => {
      const haystack = `${p.email} ${p.name ?? ""}`.toLowerCase();
      return haystack.includes(trimmedQuery);
    });
  }, [people, trimmedQuery]);

  const peopleByStep = React.useMemo(() => {
    const groups: Record<Step, Person[]> = {
      eval: [],
      interview: [],
      background_check: [],
      gmail_creation: [],
      sent_contracts: [],
      in_production: [],
    };
    for (const p of filteredPeople) groups[p.step].push(p);
    for (const s of STEP_ORDER) {
      groups[s].sort(
        (a, b) =>
          new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
      );
    }
    return groups;
  }, [filteredPeople]);

  const totalsByStep = React.useMemo(() => {
    const totals: Record<Step, number> = {
      eval: 0,
      interview: 0,
      background_check: 0,
      gmail_creation: 0,
      sent_contracts: 0,
      in_production: 0,
    };
    for (const p of people) totals[p.step] += 1;
    return totals;
  }, [people]);

  const toggleSelect = React.useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const clearSelection = React.useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  const moveOne = React.useCallback(
    async (id: string, step: Step) => {
      const previous = peopleById.get(id);
      if (!previous || previous.step === step) return;
      const optimistic: Person = {
        ...previous,
        step,
        updatedAt: new Date().toISOString(),
      };
      setPeople((prev) => prev.map((p) => (p.id === id ? optimistic : p)));
      try {
        const updated = await patchPerson(id, { step });
        setPeople((prev) => prev.map((p) => (p.id === id ? updated : p)));
        toast.success(`Moved to ${STEP_LABELS[step]}`);
      } catch (err) {
        setPeople((prev) => prev.map((p) => (p.id === id ? previous : p)));
        toast.error(err instanceof Error ? err.message : "Failed to move");
      }
    },
    [peopleById],
  );

  const handleAdd = React.useCallback(
    async (data: { email: string; name?: string; step: Step }) => {
      const created = await createPerson(data);
      setPeople((prev) => [...prev, created]);
      toast.success(`Added ${created.email}`);
    },
    [],
  );

  const handleEditSubmit = React.useCallback(
    async (id: string, patch: { email: string; name: string | null }) => {
      const updated = await patchPerson(id, patch);
      setPeople((prev) => prev.map((p) => (p.id === id ? updated : p)));
      toast.success("Updated");
    },
    [],
  );

  const handleDelete = React.useCallback(
    async (id: string) => {
      const previous = peopleById.get(id);
      if (!previous) return;
      setPeople((prev) => prev.filter((p) => p.id !== id));
      setSelectedIds((prev) => {
        if (!prev.has(id)) return prev;
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      try {
        await deletePersonRequest(id);
        toast.success(`Removed ${previous.email}`);
      } catch (err) {
        setPeople((prev) => [...prev, previous]);
        toast.error(err instanceof Error ? err.message : "Failed to delete");
      }
    },
    [peopleById],
  );

  const handleBulkMove = React.useCallback(
    async (step: Step) => {
      const ids = Array.from(selectedIds);
      if (ids.length === 0) return;
      const snapshot = people;
      const now = new Date().toISOString();
      const optimistic = people.map((p) =>
        selectedIds.has(p.id) && p.step !== step
          ? { ...p, step, updatedAt: now }
          : p,
      );
      setPeople(optimistic);
      try {
        await bulkRequest({ action: "move", ids, step });
        toast.success(`Moved ${ids.length} to ${STEP_LABELS[step]}`);
        clearSelection();
      } catch (err) {
        setPeople(snapshot);
        toast.error(err instanceof Error ? err.message : "Bulk move failed");
      }
    },
    [people, selectedIds, clearSelection],
  );

  const handleBulkDelete = React.useCallback(async () => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    const snapshot = people;
    setPeople((prev) => prev.filter((p) => !selectedIds.has(p.id)));
    try {
      const result = await bulkRequest({ action: "delete", ids });
      toast.success(`Removed ${result.deleted ?? ids.length} people`);
      clearSelection();
    } catch (err) {
      setPeople(snapshot);
      toast.error(err instanceof Error ? err.message : "Bulk delete failed");
    }
  }, [people, selectedIds, clearSelection]);

  const onDragStart = (event: DragStartEvent) => {
    setActiveId(String(event.active.id));
  };

  const onDragEnd = (event: DragEndEvent) => {
    setActiveId(null);
    const { active, over } = event;
    if (!over) return;
    const overId = String(over.id);
    if (!overId.startsWith("col-")) return;
    const step = overId.slice("col-".length) as Step;
    if (!STEP_ORDER.includes(step)) return;
    void moveOne(String(active.id), step);
  };

  const activePerson = activeId ? peopleById.get(activeId) ?? null : null;
  const hasActiveSearch = trimmedQuery.length > 0;
  const totalAll = people.length;
  const visibleAll = filteredPeople.length;

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-30 border-b bg-background/95 backdrop-blur">
        <div className="mx-auto flex w-full max-w-[1400px] flex-wrap items-center gap-3 px-4 py-3 sm:px-6">
          <div className="mr-2 flex flex-col">
            <h1 className="text-base font-semibold tracking-tight">
              Workflow Tracker
            </h1>
            <p className="text-[11px] text-muted-foreground">
              {totalAll} {totalAll === 1 ? "person" : "people"} across{" "}
              {STEP_ORDER.length} stages
            </p>
          </div>
          <SearchBar
            value={query}
            onChange={setQuery}
            resultCount={visibleAll}
            totalCount={totalAll}
          />
          <div className="ml-auto flex items-center gap-2">
            {selectedIds.size > 0 ? (
              <Button
                variant="ghost"
                size="sm"
                onClick={clearSelection}
              >
                Clear ({selectedIds.size})
              </Button>
            ) : null}
            <Button
              onClick={() => {
                setAddInitialStep("eval");
                setAddOpen(true);
              }}
            >
              <PlusIcon /> Add person
            </Button>
          </div>
        </div>
      </header>

      <main className="flex-1 px-4 py-4 sm:px-6">
        <DndContext
          sensors={sensors}
          onDragStart={onDragStart}
          onDragEnd={onDragEnd}
        >
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
            {STEP_ORDER.map((step) => (
              <Column
                key={step}
                step={step}
                people={peopleByStep[step]}
                totalCount={totalsByStep[step]}
                hasActiveSearch={hasActiveSearch}
                selectedIds={selectedIds}
                onToggleSelect={toggleSelect}
                onMove={moveOne}
                onEdit={setEditing}
                onDelete={handleDelete}
                onAddHere={(s) => {
                  setAddInitialStep(s);
                  setAddOpen(true);
                }}
              />
            ))}
          </div>

          <DragOverlay dropAnimation={null}>
            {activePerson ? (
              <div className="w-72 rotate-1">
                <PersonCard
                  person={activePerson}
                  selected={selectedIds.has(activePerson.id)}
                  onToggleSelect={() => {}}
                  onMove={() => {}}
                  onEdit={() => {}}
                  onDelete={() => {}}
                />
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>

        {people.length === 0 ? (
          <div className="mx-auto mt-6 max-w-md rounded-xl border border-dashed p-8 text-center">
            <h2 className="text-sm font-semibold">No one in the pipeline yet</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Add your first person to get started. Email is the unique
              identifier.
            </p>
            <Button
              className="mt-4"
              onClick={() => {
                setAddInitialStep("eval");
                setAddOpen(true);
              }}
            >
              <PlusIcon /> Add person
            </Button>
          </div>
        ) : null}
      </main>

      <BulkActionBar
        count={selectedIds.size}
        onMove={handleBulkMove}
        onDelete={handleBulkDelete}
        onClear={clearSelection}
      />

      <AddPersonDialog
        open={addOpen}
        initialStep={addInitialStep}
        onOpenChange={setAddOpen}
        onSubmit={handleAdd}
      />

      <EditPersonDialog
        person={editing}
        onOpenChange={(open) => {
          if (!open) setEditing(null);
        }}
        onSubmit={handleEditSubmit}
      />
    </div>
  );
}
