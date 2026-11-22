import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { createLazyClientProxy } from "./lazy-client-proxy";

type FakeClient = {
  user: {
    findUnique(this: FakeClient["user"], input: { id: string }): Promise<{ id: string; owner: boolean }>;
  };
  $transaction<T>(callback: (client: FakeClient) => Promise<T>): Promise<T>;
};

describe("lazy Prisma-compatible client proxy", () => {
  it("returns model proxies synchronously and loads the client once", async () => {
    let loads = 0;
    const client: FakeClient = {
      user: {
        async findUnique(input) {
          return { id: input.id, owner: this === client.user };
        },
      },
      async $transaction(callback) {
        return callback(client);
      },
    };
    const proxy = createLazyClientProxy<FakeClient>(() => {
      loads += 1;
      return Promise.resolve(client);
    });

    const [first, second] = await Promise.all([
      proxy.user.findUnique({ id: "one" }),
      proxy.user.findUnique({ id: "two" }),
    ]);
    const transactional = await proxy.$transaction((tx) => tx.user.findUnique({ id: "three" }));

    assert.deepEqual(first, { id: "one", owner: true });
    assert.deepEqual(second, { id: "two", owner: true });
    assert.deepEqual(transactional, { id: "three", owner: true });
    assert.equal(loads, 1);
  });
});
