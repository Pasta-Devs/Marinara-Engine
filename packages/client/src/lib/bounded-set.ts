export function rememberBoundedSetValue<T>(values: Set<T>, value: T, maximum: number): void {
  values.delete(value);
  values.add(value);
  while (values.size > maximum) {
    const oldest = values.values().next();
    if (oldest.done) return;
    values.delete(oldest.value);
  }
}
