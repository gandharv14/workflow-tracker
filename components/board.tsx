"use client";

import * as React from "react";
import Link from "next/link";
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
import { DownloadIcon, PlusIcon, UploadIcon } from "lucide-react";
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
  sendSentContractsEmailRequest,
} from "@/lib/api";
import { serializePeopleCsv, type CsvPersonInput } from "@/lib/csv";
import {
  getDefaultProjectStep,
  getProjectSteps,
  normalizeProjectStep,
  STEP_LABELS,
  type Step,
} from "@/lib/steps";
import { getProject, PROJECTS, projectQuery, type ProjectId } from "@/lib/projects";
import type { Person } from "@/lib/types";
import { cn } from "@/lib/utils";

type BoardProps = {
  projectId: ProjectId;
  initialPeople: Person[];
};

function makeStepRecord<T>(
  steps: readonly Step[],
  createValue: () => T,
): Record<Step, T> {
  return Object.fromEntries(
    steps.map((step) => [step, createValue()]),
  ) as Record<Step, T>;
}

function normalizePersonStep(projectId: ProjectId, person: Person): Person {
  const step = normalizeProjectStep(projectId, person.step) ?? getDefaultProjectStep(projectId);
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

export function Board({ projectId, initialPeople }: BoardProps) {
  const project = getProject(projectId);
  const projectSteps = React.useMemo(() => getProjectSteps(projectId), [projectId]);
  const defaultStep = getDefaultProjectStep(projectId);
  const [people, setPeople] = React.useState<Person[]>(() =>
    initialPeople.map((person) => normalizePersonStep(projectId, person)),
  );
  const [query, setQuery] = React.useState("");
  const [selectedIds, setSelectedIds] = React.useState<Set<string>>(
    () => new Set(),
  );
  const [addOpen, setAddOpen] = React.useState(false);
  const [uploadOpen, setUploadOpen] = React.useState(false);
  const [addInitialStep, setAddInitialStep] = React.useState<Step>(defaultStep);
  const [editing, setEditing] = React.useState<Person | null>(null);
  const [activeId, setActiveId] = React.useState<string | null>(null);
  const [isEmailingSentContracts, setIsEmailingSentContracts] =
    React.useState(false);

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
    const groups = makeStepRecord<Person[]>(projectSteps, () => []);
    for (const p of people) {
      const step = normalizeProjectStep(projectId, p.step) ?? defaultStep;
      groups[step].push(p);
    }
    for (const s of projectSteps) {
      groups[s].sort(
        (a, b) =>
          new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
      );
    }
    return groups;
  }, [defaultStep, people, projectId, projectSteps]);

  const peopleByStep = React.useMemo(() => {
    const groups = makeStepRecord<Person[]>(projectSteps, () => []);
    for (const p of filteredPeople) {
      const step = normalizeProjectStep(projectId, p.step) ?? defaultStep;
      groups[step].push(p);
    }
    for (const s of projectSteps) {
      groups[s].sort(
        (a, b) =>
          new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
      );
    }
    return groups;
  }, [defaultStep, filteredPeople, projectId, projectSteps]);

  const totalsByStep = React.useMemo(() => {
    const totals = makeStepRecord(projectSteps, () => 0);
    for (const p of people) {
      const step = normalizeProjectStep(projectId, p.step) ?? defaultStep;
      totals[step] += 1;
    }
    return totals;
  }, [defaultStep, people, projectId, projectSteps]);

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

  const setQueueSelection = React.useCallback((ids: string[], shouldSelect: boolean) => {
    setSelectedIds((prev) => {
      let changed = false;
      const next = new Set(prev);
      for (const id of ids) {
        if (shouldSelect) {
          if (next.has(id)) continue;
          next.add(id);
          changed = true;
        } else {
          changed = next.delete(id) || changed;
        }
      }
      return changed ? next : prev;
    });
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
        const updated = normalizePersonStep(
          projectId,
          await patchPerson(projectId, id, { step }),
        );
        setPeople((prev) => prev.map((p) => (p.id === id ? updated : p)));
        toast.success(`Moved to ${STEP_LABELS[step]}`);
      } catch (err) {
        if (isNotFoundError(err)) {
          let latestPeople: Person[] | null = null;
          try {
            latestPeople = (await fetchPeople(projectId)).map((person) =>
              normalizePersonStep(projectId, person),
            );
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
                projectId,
                await patchPerson(projectId, replacement.id, { step }),
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
    [peopleById, projectId],
  );

  const handleAdd = React.useCallback(
    async (data: { email: string; name?: string; role?: string; step: Step }) => {
      const created = normalizePersonStep(
        projectId,
        await createPerson(projectId, data),
      );
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
    [projectId, trimmedQuery],
  );

  const handleEditSubmit = React.useCallback(
    async (
      id: string,
      patch: { email: string; name: string | null; role: string | null },
    ) => {
      const updated = normalizePersonStep(
        projectId,
        await patchPerson(projectId, id, patch),
      );
      setPeople((prev) => prev.map((p) => (p.id === id ? updated : p)));
      toast.success("Updated");
    },
    [projectId],
  );

  const handleCsvImport = React.useCallback(
    async (rows: CsvPersonInput[]) => {
      const result = await importPeopleRequest(projectId, { people: rows });
      const importedPeople = result.people.map((person) =>
        normalizePersonStep(projectId, person),
      );
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
    [projectId, trimmedQuery],
  );

  const handleDownloadStep = React.useCallback(
    (step: Step) => {
      const rows = allPeopleByStep[step];
      if (rows.length === 0) return;
      downloadCsv(`workflow-${projectId}-${step}.csv`, serializePeopleCsv(rows));
      toast.success(`Downloaded ${STEP_LABELS[step]} CSV`);
    },
    [allPeopleByStep, projectId],
  );

  const handleDownloadBoard = React.useCallback(() => {
    if (people.length === 0) return;
    const rows = projectSteps.flatMap((step) => allPeopleByStep[step]);
    downloadCsv(`workflow-${projectId}.csv`, serializePeopleCsv(rows));
    toast.success("Downloaded board CSV");
  }, [allPeopleByStep, people.length, projectId, projectSteps]);

  const handleEmailSentContracts = React.useCallback(async () => {
    if ((totalsByStep.sent_contracts ?? 0) === 0 || isEmailingSentContracts) {
      return;
    }
    setIsEmailingSentContracts(true);
    try {
      const result = await sendSentContractsEmailRequest(projectId);
      toast.success(
        `Sent ${result.sent} Sent Contracts ${result.sent === 1 ? "email" : "emails"}`,
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to send emails");
    } finally {
      setIsEmailingSentContracts(false);
    }
  }, [isEmailingSentContracts, projectId, totalsByStep]);

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
        await deletePersonRequest(projectId, id);
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
    [peopleById, projectId],
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
        const result = await bulkRequest(projectId, { action: "move", ids, step });
        const confirmed = (result.updated ?? []).map((person) =>
          normalizePersonStep(projectId, person),
        );
        const confirmedById = new Map(
          confirmed.map((person) => [person.id, person]),
        );
        setPeople((prev) =>
          prev.flatMap((person) => {
            if (!selectedIds.has(person.id)) return [person];
            const updated = confirmedById.get(person.id);
            return updated ? [updated] : [];
          }),
        );
        toast.success(
          confirmed.length === ids.length
            ? `Moved ${confirmed.length} to ${STEP_LABELS[step]}`
            : `Moved ${confirmed.length} of ${ids.length} to ${STEP_LABELS[step]}`,
        );
        clearSelection();
      } catch (err) {
        setPeople(snapshot);
        toast.error(err instanceof Error ? err.message : "Bulk move failed");
      }
    },
    [people, selectedIds, clearSelection, projectId],
  );

  const handleBulkDelete = React.useCallback(async () => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    const snapshot = people;
    setPeople((prev) => prev.filter((p) => !selectedIds.has(p.id)));
    try {
      const result = await bulkRequest(projectId, { action: "delete", ids });
      const deleted = result.deleted ?? 0;
      toast.success(`Removed ${deleted} ${deleted === 1 ? "person" : "people"}`);
      clearSelection();
    } catch (err) {
      setPeople(snapshot);
      toast.error(err instanceof Error ? err.message : "Bulk delete failed");
    }
  }, [people, selectedIds, clearSelection, projectId]);

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
    if (!projectSteps.includes(step)) return;
    void moveOne(String(active.id), step);
  };

  const activePerson = activeId ? peopleById.get(activeId) ?? null : null;
  const hasActiveSearch = trimmedQuery.length > 0;
  const totalAll = people.length;
  const visibleAll = filteredPeople.length;
  const stageLabel = projectSteps.length === 1 ? "stage" : "stages";

  return (
    <div className="flex min-h-screen bg-background">
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 border-r bg-muted/25 p-4 md:block">
        <div className="mb-5">
          <h1 className="text-base font-semibold tracking-tight">
            Workflow Tracker
          </h1>
          <p className="mt-1 text-xs text-muted-foreground">
            Switch between project pipelines.
          </p>
        </div>
        <nav aria-label="Projects" className="grid gap-2">
          {PROJECTS.map((item) => {
            const active = item.id === projectId;
            return (
              <Link
                key={item.id}
                href={`/?${projectQuery(item.id)}`}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "rounded-lg border px-3 py-2 text-left transition-colors",
                  active
                    ? "border-primary bg-background text-foreground shadow-sm"
                    : "border-transparent text-muted-foreground hover:bg-background/70 hover:text-foreground",
                )}
              >
                <span className="block text-sm font-medium">{item.name}</span>
                <span className="mt-0.5 block text-[11px]">{item.description}</span>
              </Link>
            );
          })}
        </nav>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 border-b bg-background/95 backdrop-blur">
          <div className="mx-auto flex w-full max-w-[1400px] flex-wrap items-center gap-3 px-4 py-3 sm:px-6">
            <div className="mr-2 flex flex-col">
              <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                Active project
              </span>
              <h1 className="text-base font-semibold tracking-tight">
                {project.name}
              </h1>
              <p className="text-[11px] text-muted-foreground">
                {totalAll} {totalAll === 1 ? "person" : "people"} across{" "}
                {projectSteps.length} {stageLabel}
              </p>
            </div>
            <div className="flex w-full gap-2 md:hidden">
              {PROJECTS.map((item) => (
                <Link
                  key={item.id}
                  href={`/?${projectQuery(item.id)}`}
                  className={cn(
                    "flex-1 rounded-md border px-2 py-1.5 text-center text-xs font-medium",
                    item.id === projectId
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border text-muted-foreground",
                  )}
                >
                  {item.name}
                </Link>
              ))}
            </div>
            <SearchBar
              value={query}
              onChange={setQuery}
              resultCount={visibleAll}
              totalCount={totalAll}
            />
            <div className="ml-auto flex items-center gap-2">
              {selectedIds.size > 0 ? (
                <Button variant="ghost" size="sm" onClick={clearSelection}>
                  Clear ({selectedIds.size})
                </Button>
              ) : null}
              <Button
                variant="outline"
                onClick={handleDownloadBoard}
                disabled={people.length === 0}
              >
                <DownloadIcon /> Download all CSV
              </Button>
              <Button variant="outline" onClick={() => setUploadOpen(true)}>
                <UploadIcon /> Upload CSV
              </Button>
              <Button
                onClick={() => {
                  setAddInitialStep(defaultStep);
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
          <div
            className={cn(
              "grid grid-cols-1 gap-4 sm:grid-cols-2",
              projectSteps.length <= 3
                ? "lg:grid-cols-3"
                : "lg:grid-cols-3 xl:grid-cols-5",
            )}
          >
            {projectSteps.map((step) => (
              <Column
                key={step}
                step={step}
                workflowSteps={projectSteps}
                people={peopleByStep[step]}
                totalCount={totalsByStep[step]}
                hasActiveSearch={hasActiveSearch}
                selectedIds={selectedIds}
                onToggleSelect={toggleSelect}
                onMove={moveOne}
                onEdit={setEditing}
                onDelete={handleDelete}
                onDownload={handleDownloadStep}
                onToggleSelectAll={setQueueSelection}
                onEmailSentContracts={
                  project.canEmailSentContracts
                    ? handleEmailSentContracts
                    : undefined
                }
                isEmailingSentContracts={isEmailingSentContracts}
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
                  workflowSteps={projectSteps}
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
                setAddInitialStep(defaultStep);
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
        workflowSteps={projectSteps}
        onMove={handleBulkMove}
        onDelete={handleBulkDelete}
        onClear={clearSelection}
      />

      <AddPersonDialog
        open={addOpen}
        initialStep={addInitialStep}
        workflowSteps={projectSteps}
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
        workflowSteps={projectSteps}
        onOpenChange={setUploadOpen}
        onSubmit={handleCsvImport}
      />
      </div>
    </div>
  );
}
