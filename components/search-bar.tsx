"use client";

import { SearchIcon, XIcon } from "lucide-react";

import { Input } from "@/components/ui/input";

type SearchBarProps = {
  value: string;
  onChange: (value: string) => void;
  resultCount?: number;
  totalCount?: number;
};

export function SearchBar({
  value,
  onChange,
  resultCount,
  totalCount,
}: SearchBarProps) {
  return (
    <div className="relative flex-1 max-w-md">
      <SearchIcon
        className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
        aria-hidden
      />
      <Input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Search by email or name..."
        className="pl-8 pr-20"
        aria-label="Search people"
      />
      {value ? (
        <div className="absolute right-1.5 top-1/2 flex -translate-y-1/2 items-center gap-1">
          {resultCount !== undefined && totalCount !== undefined ? (
            <span className="text-[11px] text-muted-foreground tabular-nums">
              {resultCount}/{totalCount}
            </span>
          ) : null}
          <button
            type="button"
            onClick={() => onChange("")}
            className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
            aria-label="Clear search"
          >
            <XIcon className="size-3.5" />
          </button>
        </div>
      ) : null}
    </div>
  );
}
