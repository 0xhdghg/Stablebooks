export type ArcSourceKind =
  | "rpc_polling"
  | "indexer_polling"
  | "webhook"
  | "fixtures";

export type ArcFixtureName =
  | "invoice_exact_match"
  | "invoice_exact_match_alt_sender"
  | "invoice_unmatched_amount";

export type ArcCanonicalEvent = {
  txHash: string;
  blockNumber: number;
  confirmedAt: string;
  from: string;
  to: string;
  token: string;
  amount: string;
  decimals: number;
  chainId: number;
  logIndex?: number;
  blockTimestamp?: string | null;
  rawPayload?: Record<string, unknown>;
};

export type ArcFinalityOutcome = "finalized" | "failed";

export type ArcFinalityEvent = {
  txHash: string;
  chainId: number;
  outcome: ArcFinalityOutcome;
  logIndex?: number;
  blockNumber?: number;
  confirmedAt?: string;
  failureReason?: string;
  settlementReference?: string;
  rawPayload?: Record<string, unknown>;
};

export type ArcRuntimeConfig = {
  enabled: boolean;
  sourceKind: ArcSourceKind;
  rpcUrl: string | null;
  chainId: number | null;
  pollIntervalMs: number;
  confirmationsRequired: number;
  startBlock: number | null;
  webhookSecret: string | null;
  sourceProfile: ArcProviderSourceProfile;
};

export type ArcProviderSourceProfile = {
  provider: "circle_event_monitor";
  eventMonitorSource: string | null;
  contractAddress: string | null;
  eventSignature: string | null;
  tokenSymbol: string | null;
  tokenDecimals: number | null;
};

export type ArcAdapterReadiness = {
  ready: boolean;
  sourceKind: ArcSourceKind;
  missing: string[];
  config: Omit<ArcRuntimeConfig, "rpcUrl" | "webhookSecret"> & {
    hasRpcUrl: boolean;
    hasWebhookSecret: boolean;
  };
};

export type ArcProviderBoundaryKind = "canonical" | "circle_event_monitor";

export type ArcProviderBoundary = {
  kind: ArcProviderBoundaryKind;
  sourceKind: ArcSourceKind;
  sourceProfileMatched: boolean | null;
  providerWarnings: string[];
  warnings: string[];
};

export type ArcProviderDiagnostic = {
  boundaryKind: ArcProviderBoundaryKind;
  sourceKind: ArcSourceKind;
  sourceProfileMatched: boolean | null;
  providerWarnings: string[];
  rejectedReason: string | null;
};

export type ArcDecodedProviderEvent = {
  boundary: ArcProviderBoundary;
  canonicalEvent: ArcCanonicalEvent;
};

export type ArcDecodedFinalityEvent = {
  boundary: ArcProviderBoundary;
  finalityEvent: ArcFinalityEvent;
};
