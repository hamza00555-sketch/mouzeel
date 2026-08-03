/**
 * Whether the user currently has an image open in the editor.
 *
 * Read by the service-worker hook to decide if it may reload the page after a
 * new worker takes over. Deliberately a module-level flag rather than React
 * state: the reader lives outside the component tree, and a DOM query for the
 * editor would be a brittle proxy for "there is unsaved work here".
 */
let editing = false;

export function setEditing(value: boolean) {
  editing = value;
}

export function isEditing() {
  return editing;
}
