type Release = () => void;

export function createSemaphore(maxConcurrency: number) {
  let active = 0;
  const waiting: ((release: Release) => void)[] = [];

  function release() {
    active--;
    const next = waiting.shift();
    if (next) {
      active++;
      next(release);
    }
  }

  function acquire(): Promise<Release> {
    if (active < maxConcurrency) {
      active++;
      return Promise.resolve(release);
    }
    return new Promise<Release>((resolve) => waiting.push(resolve));
  }

  return { acquire };
}
