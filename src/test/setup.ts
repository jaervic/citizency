// src/test/setup.ts
// Propósito: preparar el entorno de pruebas. El store de Zustand se apoya en `localStorage`,
// que no existe en Node; se instala un stub síncrono en memoria antes de que los tests
// importen ningún módulo de la app (vitest ejecuta los `setupFiles` primero).
const memory = new Map<string, string>();

const localStorageStub: Storage = {
  getItem: (key: string) => memory.get(key) ?? null,
  setItem: (key: string, value: string) => {
    memory.set(key, String(value));
  },
  removeItem: (key: string) => {
    memory.delete(key);
  },
  clear: () => {
    memory.clear();
  },
  key: (index: number) => Array.from(memory.keys())[index] ?? null,
  get length() {
    return memory.size;
  },
};

Object.defineProperty(globalThis, 'localStorage', {
  value: localStorageStub,
  configurable: true,
  writable: true,
});
