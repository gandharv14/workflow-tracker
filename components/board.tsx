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
import { PlusIcon, UploadIcon } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { AddPersonDialog } from "@/components/add-person-dialog";
import { EditPersonDialog } from "@/components/edit-person-dialog";
import { UploadCsvDialog } from "@/components/upload-csv-dialog";
import { BulkActionBar } from "@/components/bulk-action-bar";
import { Column } from "@/components/column";
import { PersonCard } from "@/components/person-card";
import { SearchBar } from "@/components/search-bar";
import {
  bulkRequest,
  createPerson,
  deletePersonRequest,
  fetchPeople,
  importPeopleRequest,
  patchPerson,
} from "@/lib/api";
import { serializePeopleCsv, type CsvPersonInput } from "@/lib/csv";
import { normalizeStep, STEP_LABELS, STEP_ORDER, type Step } from "@/lib/steps";
import type { Person } from "@/lib/types";

type BoardProps = {
  initialPeople: Person[];
};

function makeStepRecord<T>(createValue: () => T): Record<Step, T> {
  return Object.fromEntries(
    STEP_ORDER.map((step) => [step, createValue()]),
  ) as Record<Step, T>;
}

function normalizePersonStep(person: Person): Person {
  const step = normalizeStep(person.step) ?? "eval";
  return step === person.step ? person : { ...person, step };
}

function sameNormalizedEmail(left: string, right: string): boolean {
  return left.trim().toLowerCase() === right.trim().toLowerCase();
}

function isNotFoundError(err: unknown): boolean {
  return (
    err instanceof Error &&
    "status" in err &&
    (err as { status?: unknown }).status === 404
  );
}

function downloadCsv(filename: string, csv: string): void {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export function Board({ initialPeople }: BoardProps) {
  const [people, setPeople] = React.useState<Person[]>(() =>
    initialPeople.map(normalizePersonStep),
  );
  const [query, setQuery] = React.useState("");
  const [selectedIds, setSelectedIds] = React.useState<Set<string>>(
    () => new Set(),
  );
  const [addOpen, setAddOpen] = React.useState(false);
  const [uploadOpen, setUploadOpen] = React.useState(false);
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
      const haystack = `${p.email} ${p.name ?? ""} ${p.role ?? ""}`.toLowerCase();
      return haystack.includes(trimmedQuery);
    });
  }, [people, trimmedQuery]);

  const allPeopleByStep = React.useMemo(() => {
    const groups = makeStepRecord<Person[]>(() => []);
    for (const p of people) groups[normalizeStep(p.step) ?? "eval"].push(p);
    for (const s of STEP_ORDER) {
      groups[s].sort(
        (a, b) =>
          new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
      );
    }
    return groups;
  }, [people]);

  const peopleByStep = React.useMemo(() => {
    const groups = makeStepRecord<Person[]>(() => []);
    for (const p of filteredPeople) groups[normalizeStep(p.step) ?? "eval"].push(p);
    for (const s of STEP_ORDER) {
      groups[s].sort(
        (a, b) =>
          new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
      );
    }
    return groups;
  }, [filteredPeople]);

  const totalsByStep = React.useMemo(() => {
    const totals = makeStepRecord(() => 0);
    for (const p of people) totals[normalizeStep(p.step) ?? "eval"] += 1;
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
        const updated = normalizePersonStep(await patchPerson(id, { step }));
        setPeople((prev) => prev.map((p) => (p.id === id ? updated : p)));
        toast.success(`Moved to ${STEP_LABELS[step]}`);
      } catch (err) {
        if (isNotFoundError(err)) {
          let latestPeople: Person[] | null = null;
          try {
            latestPeople = (await fetchPeople()).map(normalizePersonStep);
          } catch {
            // Keep the stale-card fallback below if reconciliation fails.
          }
          const latestPeopleList = latestPeople ?? [];
          const replacement = latestPeopleList.find(
            (person) =>
              person.id !== id && sameNormalizedEmail(person.email, previous.email),
          );
          if (replacement) {
            try {
              const updated = normalizePersonStep(
                await patchPerson(replacement.id, { step }),
              );
              setPeople([
                ...latestPeopleList.filter(
                  (person) =>
                    person.id !== id &&
                    person.id !== updated.id &&
                    !sameNormalizedEmail(person.email, updated.email),
                ),
                updated,
              ]);
              toast.success(`Moved to ${STEP_LABELS[step]}`);
            } catch (retryErr) {
              if (latestPeople) setPeople(latestPeople);
              else setPeople((prev) => prev.map((p) => (p.id === id ? previous : p)));
              toast.error(
                retryErr instanceof Error ? retryErr.message : "Failed to move",
              );
            }
            return;
          }

          if (latestPeople) {
            setPeople(latestPeople.filter((person) => person.id !== id));
          } else {
            setPeople((prev) => prev.filter((p) => p.id !== id));
          }
          setSelectedIds((prev) => {
            if (!prev.has(id)) return prev;
            const next = new Set(prev);
            next.delete(id);
            return next;
          });
          toast.error("Person no longer exists");
          return;
        }
        setPeople((prev) => prev.map((p) => (p.id === id ? previous : p)));
        toast.error(err instanceof Error ? err.message : "Failed to move");
      }
    },
    [peopleById],
  );

  const handleAdd = React.useCallback(
    async (data: { email: string; name?: string; role?: string; step: Step }) => {
      const created = normalizePersonStep(await createPerson(data));
      setPeople((prev) => [
        ...prev.filter((p) => !sameNormalizedEmail(p.email, created.email)),
        created,
      ]);
      if (trimmedQuery) {
        const createdHaystack =
          `${created.email} ${created.name ?? ""} ${created.role ?? ""}`.toLowerCase();
        if (!createdHaystack.includes(trimmedQuery)) setQuery("");
      }
      toast.success(`Added ${created.email}`);
    },
    [trimmedQuery],
  );

  const handleEditSubmit = React.useCallback(
    async (
      id: string,
      patch: { email: string; name: string | null; role: string | null },
    ) => {
      const updated = normalizePersonStep(await patchPerson(id, patch));
      setPeople((prev) => prev.map((p) => (p.id === id ? updated : p)));
      toast.success("Updated");
    },
    [],
  );

  const handleCsvImport = React.useCallback(
    async (rows: CsvPersonInput[]) => {
      const result = await importPeopleRequest({ people: rows });
      const importedPeople = result.people.map(normalizePersonStep);
      const importedEmails = new Set(
        importedPeople.map((person) => person.email.trim().toLowerCase()),
      );
      const importedIds = new Set(importedPeople.map((person) => person.id));

      setPeople((prev) => [
        ...prev.filter(
          (person) =>
            !importedIds.has(person.id) &&
            !importedEmails.has(person.email.trim().toLowerCase()),
        ),
        ...importedPeople,
      ]);
      if (trimmedQuery) setQuery("");

      const total = result.created + result.updated;
      toast.success(
        `Imported ${total} ${total === 1 ? "user" : "users"} (${result.created} new, ${result.updated} updated)`,
      );
    },
    [trimmedQuery],
  );

  const handleDownloadStep = React.useCallback(
    (step: Step) => {
      const rows = allPeopleByStep[step];
      if (rows.length === 0) return;
      downloadCsv(`workflow-${step}.csv`, serializePeopleCsv(rows));
      toast.success(`Downloaded ${STEP_LABELS[step]} CSV`);
    },
    [allPeopleByStep],
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
        if (isNotFoundError(err)) {
          toast.success(`Removed ${previous.email}`);
          return;
        }
        setPeople((prev) =>
          prev.some(
            (p) =>
              p.id === previous.id ||
              sameNormalizedEmail(p.email, previous.email),
          )
            ? prev
            : [...prev, previous],
        );
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
            <Button variant="outline" onClick={() => setUploadOpen(true)}>
              <UploadIcon /> Upload CSV
            </Button>
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
          id="workflow-board-dnd"
          sensors={sensors}
          onDragStart={onDragStart}
          onDragEnd={onDragEnd}
        >
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
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
                onDownload={handleDownloadStep}
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

      <UploadCsvDialog
        open={uploadOpen}
        onOpenChange={setUploadOpen}
        onSubmit={handleCsvImport}
      />
    </div>
  );
}
