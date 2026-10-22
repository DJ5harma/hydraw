import { useCallback, useLayoutEffect, useRef, useState } from "react";
import type { KeyboardEvent, MouseEvent } from "react";
import type { Point } from "@hydraw/document";
import "./canvas-context-menu.css";

export type ContextMenuItem = Readonly<{
  id: string;
  label: string;
  shortcut?: string;
  danger?: boolean;
  run: () => void | Promise<void>;
}>;

export function CanvasContextMenu({
  position,
  groups,
  onClose,
  onError,
}: {
  position: Point;
  groups: readonly (readonly ContextMenuItem[])[];
  onClose: () => void;
  onError: (message: string) => void;
}) {
  const menuRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<HTMLButtonElement[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [placed, setPlaced] = useState(false);
  const items = groups.flat();

  const placeMenu = useCallback(() => {
    const menu = menuRef.current;
    if (!menu) return;
    const bounds = menu.getBoundingClientRect();
    const left = Math.max(8, Math.min(position.x, window.innerWidth - bounds.width - 8));
    const top = Math.max(8, Math.min(position.y, window.innerHeight - bounds.height - 8));
    menu.style.left = `${left}px`;
    menu.style.top = `${top}px`;
    setPlaced(true);
  }, [position.x, position.y]);

  useLayoutEffect(() => {
    placeMenu();
    const menu = menuRef.current;
    const observer =
      menu && typeof ResizeObserver !== "undefined" ? new ResizeObserver(placeMenu) : undefined;
    if (menu) observer?.observe(menu);
    window.addEventListener("resize", placeMenu);
    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", placeMenu);
    };
  }, [placeMenu]);

  useLayoutEffect(() => {
    if (!placed) return;
    const first = itemRefs.current.find((item) => item && !item.disabled);
    first?.focus();
  }, [placed]);

  const focusItem = (index: number) => {
    if (!items.length) return;
    const next = (index + items.length) % items.length;
    setActiveIndex(next);
    itemRefs.current[next]?.focus();
    itemRefs.current[next]?.scrollIntoView({ block: "nearest" });
  };

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    event.stopPropagation();
    if (event.key === "Escape") {
      event.preventDefault();
      onClose();
    } else if (event.key === "Tab") {
      event.preventDefault();
      onClose();
    } else if (event.key === "ArrowDown") {
      event.preventDefault();
      focusItem(activeIndex + 1);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      focusItem(activeIndex - 1);
    } else if (event.key === "Home") {
      event.preventDefault();
      focusItem(0);
    } else if (event.key === "End") {
      event.preventDefault();
      focusItem(items.length - 1);
    }
  }

  function handleContextMenu(event: MouseEvent<HTMLDivElement>) {
    event.preventDefault();
    event.stopPropagation();
  }

  function runItem(item: ContextMenuItem) {
    onClose();
    try {
      void Promise.resolve(item.run()).catch((cause: unknown) => {
        onError(
          cause instanceof Error ? cause.message : "The canvas action could not be completed.",
        );
      });
    } catch (cause) {
      onError(cause instanceof Error ? cause.message : "The canvas action could not be completed.");
    }
  }

  let flatIndex = 0;
  return (
    <div
      ref={menuRef}
      className="canvas-context-menu-root"
      data-workspace-overlay-root
      style={{ left: position.x, top: position.y, visibility: placed ? "visible" : "hidden" }}
      onKeyDown={handleKeyDown}
      onContextMenu={handleContextMenu}
      role="menu"
      aria-label="Canvas actions"
    >
      {groups.map((group, groupIndex) => (
        <div className="canvas-context-menu-group" role="none" key={`group-${groupIndex}`}>
          {group.map((item) => {
            const index = flatIndex++;
            return (
              <button
                className={`canvas-context-menu-item${item.danger ? " is-danger" : ""}`}
                type="button"
                role="menuitem"
                key={item.id}
                tabIndex={activeIndex === index ? 0 : -1}
                ref={(node) => {
                  if (node) itemRefs.current[index] = node;
                }}
                onFocus={() => setActiveIndex(index)}
                onClick={() => runItem(item)}
              >
                <span>{item.label}</span>
                {item.shortcut && (
                  <span className="canvas-context-menu-shortcut" aria-hidden="true">
                    {item.shortcut}
                  </span>
                )}
              </button>
            );
          })}
          {groupIndex < groups.length - 1 && (
            <div className="canvas-context-menu-separator" role="separator" />
          )}
        </div>
      ))}
    </div>
  );
}
