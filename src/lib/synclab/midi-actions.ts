/** Live controls (X-Y pads etc.) register here so learned CCs reach them without store state. */
const ccActions = new Map<string, (value: number) => void>();

export function registerCcAction(
  id: string,
  param: string,
  fn: (value: number) => void,
): () => void {
  const key = `${id}|${param}`;
  ccActions.set(key, fn);
  return () => {
    if (ccActions.get(key) === fn) ccActions.delete(key);
  };
}

export function ccAction(id: string, param: string) {
  return ccActions.get(`${id}|${param}`);
}
