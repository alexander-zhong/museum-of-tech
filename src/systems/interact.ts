// Registry mapping interactId -> handler + crosshair prompt label.
// Exhibits register their parts; the player raycast dispatches on E.

type Handler = () => void;

const handlers = new Map<string, Handler>();
const labels = new Map<string, string | (() => string)>();

export function registerInteract(
  id: string,
  label: string | (() => string),
  fn: Handler,
) {
  handlers.set(id, fn);
  labels.set(id, label);
  return () => {
    handlers.delete(id);
    labels.delete(id);
  };
}

export function dispatchInteract(id: string) {
  handlers.get(id)?.();
}

export function promptFor(id: string): string | null {
  const l = labels.get(id);
  if (!l) return null;
  return typeof l === "function" ? l() : l;
}
