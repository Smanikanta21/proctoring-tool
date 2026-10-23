// The picker prepares a display before the final, user-activated media request.
export function createScreenSelection(getSources) {
  let selectedId;
  let generation = 0;
  return {
    async select(id) {
      const request = ++generation;
      selectedId = undefined;
      if (id === null) return;
      if (typeof id !== 'string') throw new Error('Select an entire screen first.');
      const source = (await getSources()).find((source) => source.id === id);
      if (request !== generation) return;
      if (!source) throw new Error('This display is no longer available. Select a screen again.');
      selectedId = source.id;
    },
    async consume() {
      const id = selectedId;
      selectedId = undefined;
      ++generation;
      if (!id) return undefined;
      // A disconnected display must never silently switch capture to another display.
      return (await getSources()).find((source) => source.id === id);
    },
  };
}
