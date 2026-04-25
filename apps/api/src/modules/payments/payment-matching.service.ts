import { Injectable } from "@nestjs/common";
import {
  AppChainPaymentObservation,
  AppInvoice,
  AppPayment,
  AppStore,
  AppWallet,
  PaymentMatchResult
} from "../storage/storage.service";

type MatchCandidate = {
  payment: AppPayment;
  invoice: AppInvoice;
};

type MatchInput = {
  paymentId?: string;
  publicToken?: string;
};

export type MatchResolution = {
  organizationId: string | null;
  wallet: AppWallet | null;
  payment: AppPayment | null;
  invoice: AppInvoice | null;
  matchResult: PaymentMatchResult;
  matchReason: string;
  candidates: MatchCandidate[];
};

@Injectable()
export class PaymentMatchingService {
  resolveObservationMatch(
    store: AppStore,
    observation: Pick<
      AppChainPaymentObservation,
      "chainId" | "toAddress" | "token" | "amountAtomic" | "decimals"
    >,
    input: MatchInput = {}
  ): MatchResolution {
    const wallets = this.findWalletsForObservation(store, observation);
    const wallet = wallets[0] ?? null;
    const organizationIds = wallets.map((entry) => entry.organizationId);
    const organizationId = wallet?.organizationId ?? null;

    const candidatePayments = this.resolveCandidatePayments(store, {
      organizationId,
      organizationIds,
      wallet,
      paymentId: input.paymentId,
      publicToken: input.publicToken
    });

    if (!wallet && candidatePayments.length === 0) {
      return {
        organizationId: null,
        wallet: null,
        payment: null,
        invoice: null,
        matchResult: "rejected",
        matchReason:
          "Observation could not be routed to a known settlement wallet or payment attempt.",
        candidates: []
      };
    }

    const validCandidates = candidatePayments.filter(({ invoice }) =>
      this.isAcceptedTokenForInvoice(invoice, observation.token)
    );

    const exactCandidates = validCandidates.filter(({ invoice }) =>
      this.matchesInvoiceAmount(
        observation.amountAtomic,
        observation.decimals,
        invoice.amountMinor
      )
    );

    if (exactCandidates.length === 1) {
      return {
        organizationId: exactCandidates[0].payment.organizationId,
        wallet,
        payment: exactCandidates[0].payment,
        invoice: exactCandidates[0].invoice,
        matchResult: "exact",
        matchReason:
          "Observation matched exactly to one open payment attempt by wallet routing, token acceptance, and amount.",
        candidates: exactCandidates
      };
    }

    if (exactCandidates.length > 1) {
      return {
        organizationId: organizationId ?? exactCandidates[0].payment.organizationId,
        wallet,
        payment: null,
        invoice: null,
        matchResult: "ambiguous",
        matchReason:
          "Observation routed to multiple open payment attempts with the same exact amount.",
        candidates: exactCandidates
      };
    }

    if (candidatePayments.length > 0) {
      const result: PaymentMatchResult = input.paymentId || input.publicToken ? "rejected" : "unmatched";

      return {
        organizationId: organizationId ?? candidatePayments[0].payment.organizationId,
        wallet,
        payment: null,
        invoice: null,
        matchResult: result,
        matchReason:
          result === "rejected"
            ? "Observation resolved to a payment attempt, but token or amount validation failed."
            : "Observation reached a known settlement wallet, but no exact open payment attempt could be matched.",
        candidates: candidatePayments
      };
    }

    return {
      organizationId,
      wallet,
      payment: null,
      invoice: null,
      matchResult: "unmatched",
      matchReason:
        "Observation reached a known settlement wallet, but no open payment attempt was available for matching.",
      candidates: []
    };
  }

  matchesInvoiceAmount(
    amountAtomic: string,
    decimals: number,
    invoiceAmountMinor: number
  ) {
    const atomic = BigInt(amountAtomic);
    const scale = 10n ** BigInt(decimals);
    return atomic * 100n === BigInt(invoiceAmountMinor) * scale;
  }

  private findWalletsForObservation(
    store: AppStore,
    observation: Pick<AppChainPaymentObservation, "chainId" | "toAddress">
  ) {
    const chain = this.chainIdToName(observation.chainId);
    return store.wallets.filter(
        (wallet) =>
          wallet.chain.toLowerCase() === chain &&
          wallet.address.toLowerCase() === observation.toAddress.toLowerCase()
    );
  }

  private resolveCandidatePayments(
    store: AppStore,
    input: {
      organizationId: string | null;
      organizationIds: string[];
      wallet: AppWallet | null;
      paymentId?: string;
      publicToken?: string;
    }
  ) {
    if (input.paymentId) {
      const payment = store.payments.find((entry) => entry.id === input.paymentId) ?? null;
      if (!payment) {
        return [];
      }

      const invoice = store.invoices.find((entry) => entry.id === payment.invoiceId) ?? null;
      return invoice ? [{ payment, invoice }] : [];
    }

    if (input.publicToken) {
      return store.payments
        .filter((entry) => entry.publicToken === input.publicToken)
        .filter((entry) => entry.status === "pending" || entry.status === "processing")
        .map((payment) => ({
          payment,
          invoice: store.invoices.find((entry) => entry.id === payment.invoiceId) ?? null
        }))
        .filter((entry): entry is MatchCandidate => Boolean(entry.invoice));
    }

    const organizationIds = input.organizationIds.length
      ? input.organizationIds
      : input.organizationId
        ? [input.organizationId]
        : [];

    if (!organizationIds.length) {
      return [];
    }

    return store.payments
      .filter((payment) => organizationIds.includes(payment.organizationId))
      .filter((payment) => payment.status === "pending" || payment.status === "processing")
      .map((payment) => ({
        payment,
        invoice: store.invoices.find((entry) => entry.id === payment.invoiceId) ?? null
      }))
      .filter((entry): entry is MatchCandidate => Boolean(entry.invoice))
      .filter(
        ({ invoice }) => invoice.status === "open" || invoice.status === "processing"
      );
  }

  private isAcceptedTokenForInvoice(invoice: AppInvoice, token: string) {
    const normalizedToken = token.trim().toUpperCase();
    const invoiceCurrency = invoice.currency.trim().toUpperCase();

    if (normalizedToken === invoiceCurrency) {
      return true;
    }

    if (invoiceCurrency === "USD") {
      return normalizedToken === "USDC" || normalizedToken === "USD";
    }

    return false;
  }

  private chainIdToName(chainId: number) {
    if (chainId === 1) {
      return "ethereum";
    }

    if (chainId === 8453) {
      return "base";
    }

    return "arc";
  }
}
