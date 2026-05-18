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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { STEP_LABELS, STEP_ORDER, type Step } from "@/lib/steps";

type AddPersonDialogProps = {
  open: boolean;
  initialStep: Step;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: {
    email: string;
    name?: string;
    role?: string;
    step: Step;
  }) => Promise<void>;
};

export function AddPersonDialog({
  open,
  initialStep,
  onOpenChange,
  onSubmit,
}: AddPersonDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {open ? (
        <AddPersonForm
          key={initialStep}
          initialStep={initialStep}
          onOpenChange={onOpenChange}
          onSubmit={onSubmit}
        />
      ) : null}
    </Dialog>
  );
}

function AddPersonForm({
  initialStep,
  onOpenChange,
  onSubmit,
}: Omit<AddPersonDialogProps, "open">) {
  const [email, setEmail] = React.useState("");
  const [name, setName] = React.useState("");
  const [role, setRole] = React.useState("");
  const [step, setStep] = React.useState<Step>(initialStep);
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const validEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!validEmail || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      await onSubmit({
        email: email.trim(),
        name: name.trim() || undefined,
        role: role.trim() || undefined,
        step,
      });
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add person");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <DialogContent>
      <DialogHeader>
        <DialogTitle>Add person</DialogTitle>
        <DialogDescription>
          Track a new person in the workflow. Email is required and must be unique.
        </DialogDescription>
      </DialogHeader>
      <form className="grid gap-3" onSubmit={handleSubmit} aria-busy={submitting}>
        <div className="grid gap-1.5">
          <Label htmlFor="add-email">Email</Label>
          <Input
            id="add-email"
            type="email"
            placeholder="person@example.com"
            autoComplete="off"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoFocus
            required
            aria-invalid={email.length > 0 && !validEmail}
            disabled={submitting}
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="add-name">
            Name <span className="text-muted-foreground">(optional)</span>
          </Label>
          <Input
            id="add-name"
            type="text"
            placeholder="Jane Doe"
            autoComplete="off"
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={submitting}
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="add-role">
            Role <span className="text-muted-foreground">(optional)</span>
          </Label>
          <Input
            id="add-role"
            type="text"
            placeholder="Reviewer"
            autoComplete="off"
            value={role}
            onChange={(e) => setRole(e.target.value)}
            disabled={submitting}
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="add-step">Workflow step</Label>
          <select
            id="add-step"
            value={step}
            onChange={(e) => setStep(e.target.value as Step)}
            className="h-8 rounded-md border border-input bg-background px-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-ring/40"
            disabled={submitting}
          >
            {STEP_ORDER.map((s) => (
              <option key={s} value={s}>
                {STEP_LABELS[s]}
              </option>
            ))}
          </select>
        </div>
        {error ? <p className="text-xs text-destructive">{error}</p> : null}
        <DialogFooter className="mt-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={submitting}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={!validEmail || submitting}>
            {submitting ? (
              <>
                <Loader2Icon className="size-4 animate-spin" aria-hidden="true" />
                Adding to queue...
              </>
            ) : (
              "Add person"
            )}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}
