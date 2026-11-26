import type { SupabaseClient } from "@supabase/supabase-js";

export const RECEIPTS_BUCKET = "receipts";
/** Page size for Storage listings and removals. */
const STORAGE_BATCH_SIZE = 100;

/** The Supabase surface account deletion needs (narrowed so tests can fake it). */
export type AccountClient = Pick<SupabaseClient, "auth" | "storage" | "rpc">;

/** A deletion step failed; `message` is safe to show to the user. */
export class AccountDeletionError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "AccountDeletionError";
  }
}

/** Lists every file path under `folder`, descending into subfolders. */
async function listFilePaths(client: AccountClient, folder: string): Promise<string[]> {
  const bucket = client.storage.from(RECEIPTS_BUCKET);
  const paths: string[] = [];
  for (let offset = 0; ; offset += STORAGE_BATCH_SIZE) {
    const { data, error } = await bucket.list(folder, { limit: STORAGE_BATCH_SIZE, offset });
    if (error) throw new AccountDeletionError("Não foi possível listar seus comprovantes.", { cause: error });
    for (const entry of data ?? []) {
      const path = `${folder}/${entry.name}`;
      // Storage reports folders as entries without an id.
      if (entry.id === null) paths.push(...(await listFilePaths(client, path)));
      else paths.push(path);
    }
    if (!data || data.length < STORAGE_BATCH_SIZE) return paths;
  }
}

/** Removes every receipt file the user uploaded (Storage is not covered by the database cascade). */
async function removeReceipts(client: AccountClient, userId: string): Promise<void> {
  const paths = await listFilePaths(client, userId);
  for (let index = 0; index < paths.length; index += STORAGE_BATCH_SIZE) {
    const batch = paths.slice(index, index + STORAGE_BATCH_SIZE);
    const { error } = await client.storage.from(RECEIPTS_BUCKET).remove(batch);
    if (error) throw new AccountDeletionError("Não foi possível apagar seus comprovantes.", { cause: error });
  }
}

/**
 * Permanently deletes the signed-in user's account: receipt files first, then the
 * auth user through `delete_own_account()`, whose cascade removes all financial data.
 * Finally clears the local session, since the user no longer exists.
 */
export async function deleteOwnAccount(client: AccountClient): Promise<void> {
  const { data, error } = await client.auth.getUser();
  const userId = data.user?.id;
  if (error || !userId) throw new AccountDeletionError("Sua sessão expirou. Entre novamente para excluir a conta.", { cause: error });

  await removeReceipts(client, userId);

  const { error: rpcError } = await client.rpc("delete_own_account");
  if (rpcError) throw new AccountDeletionError("Não foi possível excluir a conta. Tente novamente.", { cause: rpcError });

  // The server session died with the user; only the local cookies remain to clear.
  await client.auth.signOut({ scope: "local" });
}
