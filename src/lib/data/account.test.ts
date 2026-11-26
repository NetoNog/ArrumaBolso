import { describe, expect, it } from "vitest";

import { AccountDeletionError, deleteOwnAccount, type AccountClient } from "@/lib/data/account";

type Entry = { name: string; id: string | null };

interface FakeOptions {
  userId?: string | null;
  /** Folder path -> entries listed in it. */
  folders?: Record<string, Entry[]>;
  listError?: boolean;
  removeError?: boolean;
  rpcError?: boolean;
}

function fakeClient(options: FakeOptions = {}) {
  const calls: string[] = [];
  const removed: string[][] = [];
  const userId = options.userId === undefined ? "user-1" : options.userId;

  const client = {
    auth: {
      getUser: async () => ({ data: { user: userId ? { id: userId } : null }, error: null }),
      signOut: async (opts: { scope: string }) => {
        calls.push(`signOut:${opts.scope}`);
        return { error: null };
      },
    },
    storage: {
      from: (bucket: string) => ({
        list: async (folder: string, { limit, offset }: { limit: number; offset: number }) => {
          calls.push(`list:${bucket}:${folder}:${offset}`);
          if (options.listError) return { data: null, error: new Error("list failed") };
          const entries = options.folders?.[folder] ?? [];
          return { data: entries.slice(offset, offset + limit), error: null };
        },
        remove: async (paths: string[]) => {
          calls.push(`remove:${bucket}`);
          removed.push(paths);
          return { data: [], error: options.removeError ? new Error("remove failed") : null };
        },
      }),
    },
    rpc: async (fn: string) => {
      calls.push(`rpc:${fn}`);
      return { data: null, error: options.rpcError ? new Error("rpc failed") : null };
    },
  } as unknown as AccountClient;

  return { client, calls, removed };
}

const file = (name: string): Entry => ({ name, id: `id-${name}` });

describe("deleteOwnAccount", () => {
  it("removes receipts, deletes the account and clears the local session, in that order", async () => {
    const { client, calls, removed } = fakeClient({ folders: { "user-1": [file("a.jpg"), file("b.pdf")] } });

    await deleteOwnAccount(client);

    expect(removed).toEqual([["user-1/a.jpg", "user-1/b.pdf"]]);
    expect(calls).toEqual(["list:receipts:user-1:0", "remove:receipts", "rpc:delete_own_account", "signOut:local"]);
  });

  it("skips the Storage removal when the user has no receipts", async () => {
    const { client, calls } = fakeClient();

    await deleteOwnAccount(client);

    expect(calls).toEqual(["list:receipts:user-1:0", "rpc:delete_own_account", "signOut:local"]);
  });

  it("descends into subfolders and pages through more than 100 files", async () => {
    const many = Array.from({ length: 150 }, (_, index) => file(`r${index}.jpg`));
    const { client, removed } = fakeClient({
      folders: { "user-1": [...many, { name: "old", id: null }], "user-1/old": [file("x.png")] },
    });

    await deleteOwnAccount(client);

    const all = removed.flat();
    expect(all).toHaveLength(151);
    expect(all).toContain("user-1/old/x.png");
    expect(removed.every((batch) => batch.length <= 100)).toBe(true);
  });

  it("refuses to run without a signed-in user", async () => {
    const { client, calls } = fakeClient({ userId: null });

    await expect(deleteOwnAccount(client)).rejects.toBeInstanceOf(AccountDeletionError);
    expect(calls).toEqual([]);
  });

  it("keeps the account when receipts cannot be listed or removed", async () => {
    for (const failure of [{ listError: true }, { removeError: true }]) {
      const { client, calls } = fakeClient({ ...failure, folders: { "user-1": [file("a.jpg")] } });

      await expect(deleteOwnAccount(client)).rejects.toBeInstanceOf(AccountDeletionError);
      expect(calls).not.toContain("rpc:delete_own_account");
    }
  });

  it("keeps the session when the database deletion fails", async () => {
    const { client, calls } = fakeClient({ rpcError: true });

    await expect(deleteOwnAccount(client)).rejects.toThrow("Não foi possível excluir a conta");
    expect(calls).not.toContain("signOut:local");
  });
});
