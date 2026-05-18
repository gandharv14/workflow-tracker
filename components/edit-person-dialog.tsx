"use client";

import * as React from "react";

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
import type { Person } from "@/lib/types";

type EditPersonDialogProps = {
  person: Person | null;
  onOpenChange: (open: boolean) => void;
  onSubmit: (
    id: string,
    patch: { email: string; name: string | null },
  ) => Promise<void>;
};

export function EditPersonDialog({
  person,
  onOpenChange,
  onSubmit,
}: EditPersonDialogProps) {
  const [email, setEmail] = React.useState("");
  const [name, setName] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (person) {
      setEmail(person.email);
      setName(person.name ?? "");
      setError(null);
      setSubmitting(false);
    }
  }, [person]);

  const validEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!person || !validEmail || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      await onSubmit(person.id, {
        email: email.trim(),
        name: name.trim() ? name.trim() : null,
      });
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update person");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={person !== null} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit person</DialogTitle>
          <DialogDescription>
            Update the email or name. Use drag-and-drop or the card menu to change the step.
          </DialogDescription>
        </DialogHeader>
        <form className="grid gap-3" onSubmit={handleSubmit}>
          <div className="grid gap-1.5">
            <Label htmlFor="edit-email">Email</Label>
            <Input
              id="edit-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              aria-invalid={email.length > 0 && !validEmail}
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="edit-name">
              Name <span className="text-muted-foreground">(optional)</span>
            </Label>
            <Input
              id="edit-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          {error ? (
            <p className="text-xs text-destructive">{error}</p>
          ) : null}
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
              {submitting ? "Saving..." : "Save changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
