/**
 * Lazily loads an async client without turning `client.model` into a Promise.
 * Model methods and root `$` methods load on invocation, not property access.
 */
export function createLazyClientProxy<T extends object>(load: () => Promise<T>): T {
  let clientPromise: Promise<T> | null = null;
  const modelProxies = new Map<PropertyKey, object>();

  function getClient(): Promise<T> {
    if (!clientPromise) {
      clientPromise = load().catch((error: unknown) => {
        clientPromise = null;
        throw error;
      });
    }
    return clientPromise;
  }

  function method(owner: () => Promise<unknown>, property: PropertyKey) {
    return async (...args: unknown[]) => {
      const target = await owner();
      if ((typeof target !== "object" && typeof target !== "function") || target === null) {
        throw new TypeError("Lazy client target is not an object");
      }
      const member = Reflect.get(target, property) as unknown;
      if (typeof member !== "function") {
        throw new TypeError(`Client member ${String(property)} is not callable`);
      }
      return Reflect.apply(member, target, args) as unknown;
    };
  }

  function getModelProxy(property: PropertyKey): object {
    const cached = modelProxies.get(property);
    if (cached) return cached;
    const model = new Proxy({}, {
      get(_target, memberProperty) {
        if (memberProperty === "then") return undefined;
        return method(
          async () => Reflect.get(await getClient(), property) as unknown,
          memberProperty,
        );
      },
    });
    modelProxies.set(property, model);
    return model;
  }

  return new Proxy({} as T, {
    get(_target, property) {
      // Prevent `await proxy` and Node inspection from treating it as thenable.
      if (property === "then") return undefined;
      if (typeof property === "symbol") return undefined;
      if (property.startsWith("$")) return method(getClient, property);
      return getModelProxy(property);
    },
  });
}
