// A callback ref that focuses its element when it mounts. Module-level, so its identity
// never changes and React calls it only on mount and unmount, never on re-renders.
// Use it for messages that should be read out once they appear (the element needs
// tabIndex={-1}).
export function focusOnMount(element: HTMLElement | null) {
  element?.focus()
}
