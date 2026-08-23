// Minimal synchronous event bus. The sim emits; the UI listens. Keeping the
// simulation ignorant of the DOM is what lets the balance harness run headless.

export class EventBus {
  constructor() {
    this.handlers = new Map();
  }

  on(type, fn) {
    if (!this.handlers.has(type)) this.handlers.set(type, new Set());
    this.handlers.get(type).add(fn);
    return () => this.off(type, fn);
  }

  once(type, fn) {
    const off = this.on(type, (payload) => {
      off();
      fn(payload);
    });
    return off;
  }

  off(type, fn) {
    this.handlers.get(type)?.delete(fn);
  }

  emit(type, payload) {
    const direct = this.handlers.get(type);
    if (direct) for (const fn of Array.from(direct)) fn(payload, type);
    const wild = this.handlers.get('*');
    if (wild) for (const fn of Array.from(wild)) fn(payload, type);
  }

  clear() {
    this.handlers.clear();
  }
}

export const bus = new EventBus();
