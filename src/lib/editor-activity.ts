/**
 * Whether the user has work in flight — an upload being processed, a cutout
 * open, or an error they may still retry from. Anything but the empty
 * dropzone counts.
 *
 * Read by the service-worker hook, which must never reload the page out from
 * under work. The first version of this flag only counted the *ready* state, so
 * a reload landing during processing wiped an upload mid-flight and dropped the
 * user back to an empty page as if nothing had happened.
 *
 * A pending reload is deferred rather than dropped: a browser holding a
 * poisoned cache still needs it, so it runs the moment the app is idle again.
 *
 * Deliberately a module-level flag, not React state: the reader lives outside
 * the component tree, and a DOM query would be a brittle proxy for "there is
 * work here".
 */
let busy = false;
let pending: (() => void) | null = null;

export function setBusy(value: boolean) {
  busy = value;

  if (!value && pending) {
    const run = pending;
    pending = null;
    run();
  }
}

export function isBusy() {
  return busy;
}

/** Runs `action` now if the app is idle, otherwise as soon as it becomes idle. */
export function runWhenIdle(action: () => void) {
  if (!busy) action();
  else pending = action;
}
