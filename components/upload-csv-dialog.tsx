"use client";

import * as React from "react";
import { Loader2Icon } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { parsePeopleCsv, type CsvPersonInput } from "@/lib/csv";
import { STEP_LABELS, type Step } from "@/lib/steps";

type UploadCsvDialogProps = {
  open: boolean;
  workflowSteps: readonly Step[];
  onOpenChange: (open: boolean) => void;
  onSubmit: (people: CsvPersonInput[]) => Promise<void>;
};

export function UploadCsvDialog({
  open,
  workflowSteps,
  onOpenChange,
  onSubmit,
}: UploadCsvDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {open ? (
        <UploadCsvForm
          workflowSteps={workflowSteps}
          onOpenChange={onOpenChange}
          onSubmit={onSubmit}
        />
      ) : null}
    </Dialog>
  );
}

function UploadCsvForm({
  workflowSteps,
  onOpenChange,
  onSubmit,
}: Omit<UploadCsvDialogProps, "open">) {
  const [file, setFile] = React.useState<File | null>(null);
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!file || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const text = await file.text();
      const people = parsePeopleCsv(text, { steps: workflowSteps });
      await onSubmit(people);
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to upload CSV");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <DialogContent className="sm:max-w-lg">
      <DialogHeader>
        <DialogTitle>Upload CSV</DialogTitle>
        <DialogDescription>
          Bulk upload users by email. Existing emails are updated with the CSV
          values.
        </DialogDescription>
      </DialogHeader>
      <form className="grid gap-4" onSubmit={handleSubmit} noValidate>
        <div className="grid gap-2 rounded-lg border bg-muted/30 p-3">
          <p className="text-xs font-medium">CSV format</p>
          <code className="rounded bg-background px-2 py-1 text-xs">
            email,name,role,step
          </code>
          <p className="text-xs text-muted-foreground">
            Email is required. Name, role, and step are optional. Valid steps are{" "}
            {workflowSteps.map((step) => `${step} (${STEP_LABELS[step]})`).join(
              ", ",
            )}
            .
          </p>
          <pre className="overflow-x-auto rounded bg-background p-2 text-xs text-muted-foreground">
            email,name,role,step{"\n"}
            jane@example.com,Jane Doe,Reviewer,eval{"\n"}
            sam@example.com,Sam Patel,Ops Lead,
            {workflowSteps[workflowSteps.length - 1]}
          </pre>
        </div>

        <div className="grid gap-1.5">
          <Label htmlFor="csv-file">CSV file</Label>
          <input
            id="csv-file"
            type="file"
            accept=".csv,text/csv"
            className="h-8 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm transition-colors outline-none file:inline-flex file:h-6 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50"
            onChange={(event) => setFile(event.target.files?.[0] ?? null)}
            disabled={submitting}
            required
          />
        </div>

        {error ? <p className="text-xs text-destructive">{error}</p> : null}

        <DialogFooter className="mt-0">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={submitting}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={!file || submitting}>
            {submitting ? (
              <>
                <Loader2Icon className="size-4 animate-spin" aria-hidden="true" />
                Uploading...
              </>
            ) : (
              "Upload CSV"
            )}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}
