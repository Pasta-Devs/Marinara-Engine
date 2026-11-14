import { useCallback, useLayoutEffect, useRef } from "react";

/**
 * A function whose identity never changes but always runs the latest `fn`. For handlers handed
 * to memoized rows (every chat message) whose dependencies change on unrelated renders, e.g. a
 * useMutation result, which is a new object each render: a fresh handler re-rendered every
 * message whenever the chat re-rendered, such as on opening Chat settings.
 */
export function useStableCallback<Args extends unknown[], Result>(fn: (...args: Args) => Result) {
  const ref = useRef(fn);
  useLayoutEffect(() => {
    ref.current = fn;
  });
  return useCallback((...args: Args) => ref.current(...args), []);
}
