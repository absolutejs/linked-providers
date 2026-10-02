export type LinkedProviderFamily =
  | "google"
  | "linkedin"
  | "x"
  | "meta"
  | (string & {});

export type LinkedConnectorProvider =
  | "gmail"
  | "linkedin"
  | "x"
  | "instagram"
  | "facebook"
  | (string & {});

export type LinkedProviderAccountType =
  | "mailbox"
  | "member"
  | "page"
  | "instagram_business"
  | "user"
  | (string & {});

export type LinkedProviderGrantStatus =
  | "active"
  | "refresh_required"
  | "revoked"
  | "error";

export type LinkedProviderBindingStatus =
  | "active"
  | "disconnected"
  | "restricted";

export type LinkedProviderResolutionPurpose =
  | "agent_action"
  | "interactive_test"
  | "background_sync"
  | "backfill";

export type LinkedProviderFailureCode =
  | "unauthorized"
  | "insufficient_scope"
  | "revoked"
  | "rate_limited"
  | "provider_error";

export type LinkedProviderGrant = {
  id: string;
  ownerRef: string;
  providerFamily: LinkedProviderFamily;
  authProviderKey: string;
  providerSubject: string;
  status: LinkedProviderGrantStatus;
  grantedScopes: string[];
  accessTokenCiphertext?: string;
  refreshTokenCiphertext?: string;
  tokenType?: string;
  expiresAt?: number;
  lastRefreshedAt?: number;
  lastRefreshError?: string;
  metadata?: JsonObject;
  createdAt: number;
  updatedAt: number;
};

export type LinkedProviderBinding = {
  id: string;
  grantId: string;
  connectorProvider: LinkedConnectorProvider;
  externalAccountId: string;
  externalAccountType: LinkedProviderAccountType;
  label?: string;
  username?: string;
  email?: string;
  status: LinkedProviderBindingStatus;
  availableScopes: string[];
  capabilities?: string[];
  metadata?: JsonObject;
  createdAt: number;
  updatedAt: number;
};

export type ResolvedLinkedProviderCredential = {
  bindingId: string;
  grantId: string;
  ownerRef: string;
  connectorProvider: LinkedConnectorProvider;
  providerFamily: LinkedProviderFamily;
  authProviderKey: string;
  externalAccountId: string;
  externalAccountType: LinkedProviderAccountType;
  scopes: string[];
  capabilities?: string[];
  label?: string;
  username?: string;
  email?: string;
  metadata?: JsonObject;
};

export type LinkedProviderAccessTokenLease = {
  accessToken: string;
  tokenType?: string;
  expiresAt?: number;
  grantedScopes: string[];
};

export type LinkedProviderCredentialFailureReport = {
  code: LinkedProviderFailureCode;
  message?: string;
  retryAt?: number;
  metadata?: JsonObject;
};

export type ResolveLinkedProviderCredentialInput = {
  ownerRef: string;
  connectorProvider: LinkedConnectorProvider;
  bindingId?: string;
  externalAccountId?: string;
  requiredScopes?: string[];
  purpose: LinkedProviderResolutionPurpose;
};

export type LinkedProviderGrantStore = {
  getGrant: (id: string) => Promise<LinkedProviderGrant | undefined>;
  listGrantsByOwner: (ownerRef: string) => Promise<LinkedProviderGrant[]>;
  saveGrant: (grant: LinkedProviderGrant) => Promise<void>;
  removeGrant?: (id: string) => Promise<void>;
};

export type LinkedProviderBindingStore = {
  getBinding: (id: string) => Promise<LinkedProviderBinding | undefined>;
  listBindingsByOwner: (ownerRef: string) => Promise<LinkedProviderBinding[]>;
  listBindingsByGrant: (grantId: string) => Promise<LinkedProviderBinding[]>;
  saveBinding: (binding: LinkedProviderBinding) => Promise<void>;
  removeBinding?: (id: string) => Promise<void>;
};

export type LinkedProviderCredentialResolver = {
  listBindings: (input: {
    ownerRef: string;
    connectorProvider?: LinkedConnectorProvider;
    status?: Extract<LinkedProviderBindingStatus, "active" | "restricted">;
  }) => Promise<LinkedProviderBinding[]> | LinkedProviderBinding[];
  resolveCredential: (
    input: ResolveLinkedProviderCredentialInput,
  ) =>
    | Promise<ResolvedLinkedProviderCredential | null>
    | ResolvedLinkedProviderCredential
    | null;
  getAccessToken: (
    credential: ResolvedLinkedProviderCredential,
    input?: {
      minValidityMs?: number;
      requiredScopes?: string[];
    },
  ) => Promise<LinkedProviderAccessTokenLease> | LinkedProviderAccessTokenLease;
  reportFailure: (
    credential: ResolvedLinkedProviderCredential,
    report: LinkedProviderCredentialFailureReport,
  ) => Promise<void> | void;
};
export type JsonPrimitive = boolean | null | number | string;
export type JsonValue = JsonPrimitive | JsonObject | JsonValue[];
export type JsonObject = { [key: string]: JsonValue };

/** Encryption at the persistence boundary. Callers continue to pass plaintext leases.
 * AAD binds ciphertext to grant + token field, preventing cross-account substitution.
 * Legacy reads must be explicitly enabled during a controlled migration.
 */
export const createEncryptedLinkedProviderGrantStore = (options: {
  store: LinkedProviderGrantStore;
  key: CryptoKey;
  allowLegacyReads?: boolean;
}): LinkedProviderGrantStore => {
  const prefix = "lp:v1:";
  const encoder = new TextEncoder();
  const encode = (bytes: Uint8Array) =>
    btoa(Array.from(bytes, (byte) => String.fromCharCode(byte)).join(""));
  const decode = (value: string) =>
    Uint8Array.from(atob(value), (char) => char.charCodeAt(0));
  const field = async (
    grant: LinkedProviderGrant,
    name: "accessTokenCiphertext" | "refreshTokenCiphertext",
    encrypt: boolean,
  ) => {
    const value = grant[name];
    if (value === undefined) return undefined;
    const additionalData = encoder.encode(
      JSON.stringify([grant.id, grant.ownerRef, grant.authProviderKey, name]),
    );
    if (encrypt) {
      const iv = crypto.getRandomValues(new Uint8Array(12));
      const ciphertext = await crypto.subtle.encrypt(
        { name: "AES-GCM", iv, additionalData },
        options.key,
        encoder.encode(value),
      );
      return prefix + encode(iv) + ":" + encode(new Uint8Array(ciphertext));
    }
    if (!value.startsWith(prefix)) {
      if (options.allowLegacyReads) return value;
      throw new Error(
        "Unencrypted linked-provider token; migrate stored grants before enabling encrypted reads",
      );
    }
    const [iv, ciphertext, extra] = value.slice(prefix.length).split(":");
    if (!iv || !ciphertext || extra !== undefined)
      throw new Error("Invalid encrypted linked-provider token");
    return new TextDecoder().decode(
      await crypto.subtle.decrypt(
        { name: "AES-GCM", iv: decode(iv), additionalData },
        options.key,
        decode(ciphertext),
      ),
    );
  };
  const transform = async (
    grant: LinkedProviderGrant,
    encrypt: boolean,
  ): Promise<LinkedProviderGrant> => ({
    ...grant,
    accessTokenCiphertext: await field(grant, "accessTokenCiphertext", encrypt),
    refreshTokenCiphertext: await field(
      grant,
      "refreshTokenCiphertext",
      encrypt,
    ),
  });
  return {
    ...options.store,
    async getGrant(id) {
      const grant = await options.store.getGrant(id);
      return grant ? transform(grant, false) : undefined;
    },
    async listGrantsByOwner(owner) {
      return Promise.all(
        (await options.store.listGrantsByOwner(owner)).map((grant) =>
          transform(grant, false),
        ),
      );
    },
    async saveGrant(grant) {
      await options.store.saveGrant(await transform(grant, true));
    },
  };
};
