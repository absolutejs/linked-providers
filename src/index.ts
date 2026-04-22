export type LinkedProviderFamily =
	| 'google'
	| 'linkedin'
	| 'x'
	| 'meta'
	| (string & {});

export type LinkedConnectorProvider =
	| 'gmail'
	| 'linkedin'
	| 'x'
	| 'instagram'
	| 'facebook'
	| (string & {});

export type LinkedProviderAccountType =
	| 'mailbox'
	| 'member'
	| 'page'
	| 'instagram_business'
	| 'user'
	| (string & {});

export type LinkedProviderGrantStatus =
	| 'active'
	| 'refresh_required'
	| 'revoked'
	| 'error';

export type LinkedProviderBindingStatus =
	| 'active'
	| 'disconnected'
	| 'restricted';

export type LinkedProviderResolutionPurpose =
	| 'interactive_test'
	| 'background_sync'
	| 'backfill';

export type LinkedProviderFailureCode =
	| 'unauthorized'
	| 'insufficient_scope'
	| 'revoked'
	| 'rate_limited'
	| 'provider_error';

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
	metadata?: Record<string, unknown>;
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
	metadata?: Record<string, unknown>;
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
	metadata?: Record<string, unknown>;
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
	metadata?: Record<string, unknown>;
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
		status?: Extract<LinkedProviderBindingStatus, 'active' | 'restricted'>;
	}) => Promise<LinkedProviderBinding[]> | LinkedProviderBinding[];
	resolveCredential: (
		input: ResolveLinkedProviderCredentialInput
	) =>
		| Promise<ResolvedLinkedProviderCredential | null>
		| ResolvedLinkedProviderCredential
		| null;
	getAccessToken: (
		credential: ResolvedLinkedProviderCredential,
		input?: {
			minValidityMs?: number;
			requiredScopes?: string[];
		}
	) =>
		| Promise<LinkedProviderAccessTokenLease>
		| LinkedProviderAccessTokenLease;
	reportFailure: (
		credential: ResolvedLinkedProviderCredential,
		report: LinkedProviderCredentialFailureReport
	) => Promise<void> | void;
};
