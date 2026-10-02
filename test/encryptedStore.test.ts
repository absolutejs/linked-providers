import { expect, test } from "bun:test";
import {
  createEncryptedLinkedProviderGrantStore,
  type LinkedProviderGrant,
  type LinkedProviderGrantStore,
} from "../src";
test("encrypts at rest, round trips, and rejects ciphertext moved to another account", async () => {
  const rows = new Map<string, LinkedProviderGrant>();
  const store: LinkedProviderGrantStore = {
    getGrant: async (id) => rows.get(id),
    listGrantsByOwner: async (owner) =>
      [...rows.values()].filter((r) => r.ownerRef === owner),
    saveGrant: async (grant) => {
      rows.set(grant.id, grant);
    },
  };
  const key = await crypto.subtle.generateKey(
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
  const encrypted = createEncryptedLinkedProviderGrantStore({ store, key });
  const grant: LinkedProviderGrant = {
    id: "one",
    ownerRef: "alice",
    providerFamily: "hubspot",
    authProviderKey: "hubspot",
    providerSubject: "1",
    status: "active",
    grantedScopes: [],
    createdAt: 0,
    updatedAt: 0,
    accessTokenCiphertext: "secret",
    refreshTokenCiphertext: "refresh",
  };
  await encrypted.saveGrant(grant);
  expect(rows.get("one")?.accessTokenCiphertext).not.toContain("secret");
  expect(await encrypted.getGrant("one")).toEqual(grant);
  const row = rows.get("one")!;
  rows.set("one", { ...row, ownerRef: "bob" });
  await expect(encrypted.getGrant("one")).rejects.toThrow();
  rows.set("one", grant);
  await expect(encrypted.getGrant("one")).rejects.toThrow("Unencrypted");
  expect(
    await createEncryptedLinkedProviderGrantStore({
      store,
      key,
      allowLegacyReads: true,
    }).getGrant("one"),
  ).toEqual(grant);
});
