import "@testing-library/jest-dom/vitest";
import { afterEach, vi } from "vitest";
import { cleanup } from "@testing-library/react";
import React from "react";

afterEach(() => {
  cleanup();
});

Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}

class IntersectionObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
  takeRecords() {
    return [];
  }
}

vi.stubGlobal("ResizeObserver", ResizeObserverStub);
vi.stubGlobal("IntersectionObserver", IntersectionObserverStub);
vi.stubGlobal("PointerEvent", MouseEvent);

vi.mock("@dnd-kit/core", () => ({
  DndContext: ({ children }: { children: React.ReactNode }) =>
    React.createElement("div", null, children),
  DragOverlay: ({ children }: { children: React.ReactNode }) =>
    React.createElement("div", null, children),
  MouseSensor: vi.fn(),
  TouchSensor: vi.fn(),
  useSensor: vi.fn(() => ({})),
  useSensors: vi.fn((...sensors: unknown[]) => sensors),
  useDroppable: vi.fn(() => ({
    isOver: false,
    setNodeRef: vi.fn(),
  })),
  useDraggable: vi.fn(() => ({
    attributes: {},
    listeners: {},
    setNodeRef: vi.fn(),
    transform: null,
    isDragging: false,
  })),
}));

vi.mock("sonner", () => ({
  Toaster: () => null,
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock("@/components/ui/dropdown-menu", () => {
  const MenuContext = React.createContext<{
    open: boolean;
    setOpen: (open: boolean) => void;
  } | null>(null);

  function DropdownMenu({ children }: { children?: React.ReactNode }) {
    const [open, setOpen] = React.useState(false);
    return React.createElement(
      MenuContext.Provider,
      { value: { open, setOpen } },
      children,
    );
  }

  function Trigger({
    render,
    children,
    ...props
  }: {
    render?: React.ReactElement;
    children?: React.ReactNode;
  }) {
    const menu = React.useContext(MenuContext);
    const nextProps = {
      ...props,
      onClick: (event: React.MouseEvent) => {
        menu?.setOpen(!menu.open);
        if (
          "onClick" in props &&
          typeof props.onClick === "function"
        ) {
          props.onClick(event);
        }
      },
    };
    if (render) {
      return React.cloneElement(render, nextProps);
    }
    return React.createElement(
      "button",
      { type: "button", ...nextProps },
      children,
    );
  }

  function Item({
    children,
    disabled,
    onClick,
  }: {
    children?: React.ReactNode;
    disabled?: boolean;
    onClick?: () => void;
  }) {
    const menu = React.useContext(MenuContext);
    return React.createElement(
      "button",
      {
        disabled,
        onClick: () => {
          onClick?.();
          menu?.setOpen(false);
        },
        type: "button",
      },
      children,
    );
  }

  function Passthrough({ children }: { children?: React.ReactNode }) {
    return React.createElement("div", null, children);
  }

  function Content({ children }: { children?: React.ReactNode }) {
    const menu = React.useContext(MenuContext);
    if (!menu?.open) return null;
    return React.createElement("div", null, children);
  }

  return {
    DropdownMenu,
    DropdownMenuContent: Content,
    DropdownMenuGroup: Passthrough,
    DropdownMenuLabel: Passthrough,
    DropdownMenuPortal: Passthrough,
    DropdownMenuRadioGroup: Passthrough,
    DropdownMenuSeparator: () => React.createElement("hr"),
    DropdownMenuShortcut: Passthrough,
    DropdownMenuSub: Passthrough,
    DropdownMenuSubContent: Passthrough,
    DropdownMenuSubTrigger: Item,
    DropdownMenuTrigger: Trigger,
    DropdownMenuCheckboxItem: Item,
    DropdownMenuItem: Item,
    DropdownMenuRadioItem: Item,
  };
});
