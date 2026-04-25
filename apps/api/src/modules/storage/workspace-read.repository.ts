import {
  BadRequestException,
  Injectable,
  NotFoundException
} from "@nestjs/common";
import { randomBytes } from "node:crypto";
import {
  ConfirmationSource,
  InvoiceStatus,
  ObservationStatus,
  PaymentEventType,
  PaymentMatchResult,
  PaymentStatus,
  Prisma,
  WalletStatus
} from "@prisma/client";
import { PrismaService } from "./prisma.service";
import { ArcProviderDiagnostic } from "../arc/arc.types";
import { buildWebhookDeliveryDiagnostic } from "./webhook-delivery-diagnostics";

type WorkspacePaymentWithInvoice = Prisma.PaymentGetPayload<{
  include: { invoice: true };
}>;

type WorkspaceObservationWithWallet = Prisma.ChainPaymentObservationGetPayload<{
  include: { wallet: true };
}>;

type CreateWorkspaceInvoiceInput = {
  id: string;
  organizationId: string;
  customerId: string;
  referenceCode: string;
  publicToken: string;
  amountMinor: number;
  currency: string;
  dueAt: string;
  memo: string;
  internalNote: string;
  publish: boolean;
  expectedChainId?: number | null;
  expectedToken?: string | null;
};

type CreateWorkspaceOrganizationInput = {
  id: string;
  name: string;
  billingCountry: string;
  baseCurrency: string;
  onboardingStatus?: "pending_wallet" | "completed";
};

type CreateWorkspaceWalletInput = {
  id: string;
  organizationId: string;
  chain: string;
  address: string;
  label: string;
  role: "collection" | "operating" | "reserve" | "payout";
  isDefaultSettlement: boolean;
};

type CreateWorkspaceCustomerInput = {
  id: string;
  organizationId: string;
  name: string;
  email: string;
  billingCurrency: string;
};

type CreateWorkspacePaymentSessionInput = {
  publicToken: string;
  paymentId: string;
  paymentPublicToken: string;
  paymentEventId: string;
};

type IngestWorkspaceRawChainEventInput = {
  rawEventId: string;
  observationId: string;
  txHash: string;
  logIndex?: number | null;
  blockNumber: number;
  blockTimestamp?: string | null;
  confirmedAt?: string | null;
  from: string;
  to: string;
  token: string;
  amount: string;
  decimals: number;
  chainId: number;
  rawPayload?: Record<string, unknown>;
};

type MatchWorkspaceObservationInput = {
  observationId: string;
  matchId: string;
  paymentId?: string;
  publicToken?: string;
};

type FinalizeWorkspacePaymentInput = {
  paymentId?: string;
  publicToken?: string;
  observationId?: string;
  organizationId?: string;
  settlementReference?: string;
  confirmationSource: ConfirmationSource;
  confirmationTxHash?: string;
  confirmationBlockNumber?: number;
  sourceConfirmedAt?: string;
  confirmationNote?: string;
  finalizedNote: string;
};

type FailWorkspacePaymentInput = {
  paymentId?: string;
  publicToken?: string;
  observationId?: string;
  organizationId?: string;
  failureReason?: string;
  failureSource: ConfirmationSource;
  confirmationTxHash?: string;
  confirmationBlockNumber?: number;
  sourceConfirmedAt?: string;
  failureNote?: string;
  failedNote: string;
};

@Injectable()
export class WorkspaceReadRepository {
  constructor(private readonly prisma: PrismaService) {}

  async getSummary() {
    const [
      organizations,
      wallets,
      customers,
      invoices,
      payments,
      latestInvoice,
      latestPayment
    ] = await this.prisma.$transaction([
      this.prisma.organization.count(),
      this.prisma.wallet.count(),
      this.prisma.customer.count(),
      this.prisma.invoice.count(),
      this.prisma.payment.count(),
      this.prisma.invoice.findFirst({
        orderBy: [{ createdAt: "desc" }],
        select: {
          id: true,
          organizationId: true,
          status: true,
          publicToken: true,
          createdAt: true
        }
      }),
      this.prisma.payment.findFirst({
        orderBy: [{ createdAt: "desc" }],
        select: {
          id: true,
          organizationId: true,
          invoiceId: true,
          status: true,
          createdAt: true
        }
      })
    ]);

    return {
      organizations,
      wallets,
      customers,
      invoices,
      payments,
      latestInvoice: latestInvoice
        ? {
            ...latestInvoice,
            createdAt: latestInvoice.createdAt.toISOString()
          }
        : null,
      latestPayment: latestPayment
        ? {
            ...latestPayment,
            createdAt: latestPayment.createdAt.toISOString()
          }
        : null
    };
  }

  async getOrganizationById(organizationId: string) {
    const organization = await this.prisma.organization.findUnique({
      where: { id: organizationId }
    });

    return organization ? this.serializeOrganization(organization) : null;
  }

  async createOrganization(input: CreateWorkspaceOrganizationInput) {
    const organization = await this.prisma.organization.upsert({
      where: { id: input.id },
      update: {
        name: input.name,
        billingCountry: input.billingCountry,
        baseCurrency: input.baseCurrency,
        onboardingStatus: input.onboardingStatus ?? "pending_wallet"
      },
      create: {
        id: input.id,
        name: input.name,
        billingCountry: input.billingCountry,
        baseCurrency: input.baseCurrency,
        onboardingStatus: input.onboardingStatus ?? "pending_wallet"
      }
    });

    return this.serializeOrganization(organization);
  }

  async updateOrganizationOnboardingStatus(
    organizationId: string,
    onboardingStatus: "pending_wallet" | "completed"
  ) {
    const organization = await this.prisma.organization.update({
      where: { id: organizationId },
      data: { onboardingStatus }
    });

    return this.serializeOrganization(organization);
  }

  async listWallets(organizationId: string) {
    const wallets = await this.prisma.wallet.findMany({
      where: { organizationId },
      orderBy: [{ createdAt: "desc" }]
    });

    return wallets.map((wallet) => this.serializeWallet(wallet));
  }

  async createWallet(input: CreateWorkspaceWalletInput) {
    const organization = await this.prisma.organization.findUnique({
      where: { id: input.organizationId },
      select: { id: true }
    });

    if (!organization) {
      throw new BadRequestException("Organization not found for wallet creation.");
    }

    const duplicate = await this.prisma.wallet.findFirst({
      where: {
        organizationId: input.organizationId,
        chain: {
          equals: input.chain,
          mode: "insensitive"
        },
        address: {
          equals: input.address,
          mode: "insensitive"
        }
      }
    });

    if (duplicate) {
      throw new BadRequestException("This wallet is already registered.");
    }

    const wallet = await this.prisma.$transaction(async (tx) => {
      if (input.isDefaultSettlement) {
        await tx.wallet.updateMany({
          where: {
            organizationId: input.organizationId,
            isDefaultSettlement: true
          },
          data: { isDefaultSettlement: false }
        });
      }

      return tx.wallet.create({
        data: {
          id: input.id,
          organizationId: input.organizationId,
          chain: input.chain,
          address: input.address,
          label: input.label,
          role: input.role,
          isDefaultSettlement: input.isDefaultSettlement,
          status: "active"
        }
      });
    });

    return this.serializeWallet(wallet);
  }

  async listCustomers(organizationId: string) {
    const customers = await this.prisma.customer.findMany({
      where: { organizationId },
      orderBy: [{ createdAt: "desc" }]
    });

    return customers.map((customer) => this.serializeCustomer(customer));
  }

  async createCustomer(input: CreateWorkspaceCustomerInput) {
    const organization = await this.prisma.organization.findUnique({
      where: { id: input.organizationId },
      select: { id: true }
    });

    if (!organization) {
      throw new BadRequestException("Organization not found for customer creation.");
    }

    const duplicate = await this.prisma.customer.findFirst({
      where: {
        organizationId: input.organizationId,
        email: {
          equals: input.email,
          mode: "insensitive"
        }
      }
    });

    if (duplicate) {
      throw new BadRequestException("A customer with that email already exists.");
    }

    const customer = await this.prisma.customer.create({
      data: {
        id: input.id,
        organizationId: input.organizationId,
        name: input.name,
        email: input.email,
        billingCurrency: input.billingCurrency,
        metadataJson: Prisma.JsonNull
      }
    });

    return this.serializeCustomer(customer);
  }

  async getCustomerById(organizationId: string, customerId: string) {
    const customer = await this.prisma.customer.findFirst({
      where: {
        id: customerId,
        organizationId
      },
      include: {
        invoices: {
          orderBy: [{ createdAt: "desc" }]
        }
      }
    });

    if (!customer) {
      throw new NotFoundException("Customer not found.");
    }

    return {
      ...this.serializeCustomer(customer),
      invoices: customer.invoices.map((invoice) => this.serializeInvoice(invoice))
    };
  }

  async listInvoices(organizationId: string) {
    const invoices = await this.prisma.invoice.findMany({
      where: { organizationId },
      include: {
        customer: {
          select: { name: true }
        },
        payments: {
          orderBy: [{ createdAt: "desc" }],
          take: 1,
          select: { status: true }
        }
      },
      orderBy: [{ createdAt: "desc" }]
    });

    return invoices.map((invoice) => ({
      ...this.serializeInvoice(
        invoice,
        invoice.customer?.name ?? "Unknown customer"
      ),
      latestPaymentStatus: invoice.payments[0]?.status ?? null
    }));
  }

  async createInvoice(input: CreateWorkspaceInvoiceInput) {
    const customer = await this.prisma.customer.findFirst({
      where: {
        id: input.customerId,
        organizationId: input.organizationId
      },
      select: {
        id: true,
        name: true
      }
    });

    if (!customer) {
      throw new BadRequestException("The selected customer does not exist.");
    }

    const now = new Date();
    const invoice = await this.prisma.invoice.create({
      data: {
        id: input.id,
        organizationId: input.organizationId,
        customerId: customer.id,
        referenceCode: input.referenceCode,
        publicToken: input.publicToken,
        amountMinor: input.amountMinor,
        currency: input.currency,
        expectedChainId: input.expectedChainId ?? null,
        expectedToken: input.expectedToken ?? null,
        dueAt: new Date(input.dueAt),
        memo: input.memo,
        internalNote: input.internalNote,
        status: input.publish ? "open" : "draft",
        publishedAt: input.publish ? now : null
      }
    });

    return this.serializeInvoice(invoice, customer.name);
  }

  async createPaymentSession(input: CreateWorkspacePaymentSessionInput) {
    return this.prisma.$transaction(async (tx) => {
      const invoice = await tx.invoice.findUnique({
        where: { publicToken: input.publicToken },
        include: {
          payments: {
            orderBy: [{ createdAt: "desc" }],
            take: 1
          }
        }
      });

      if (!invoice || invoice.status === "draft") {
        throw new NotFoundException("Public invoice not found.");
      }

      const latestPayment = invoice.payments[0] ?? null;

      if (invoice.status === "paid") {
        return {
          paymentId: latestPayment?.id ?? null,
          status: "finalized" as const,
          redirectPath: `/pay/${input.publicToken}/success`
        };
      }

      if (
        latestPayment &&
        (latestPayment.status === "pending" ||
          latestPayment.status === "processing")
      ) {
        if (invoice.status !== "processing") {
          await tx.invoice.update({
            where: { id: invoice.id },
            data: { status: "processing" }
          });
        }

        return {
          paymentId: latestPayment.id,
          status: latestPayment.status,
          redirectPath: `/pay/${input.publicToken}/processing`
        };
      }

      if (latestPayment?.status === "finalized") {
        return {
          paymentId: latestPayment.id,
          status: latestPayment.status,
          redirectPath: `/pay/${input.publicToken}/success`
        };
      }

      const now = new Date();
      const payment = await tx.payment.create({
        data: {
          id: input.paymentId,
          organizationId: invoice.organizationId,
          invoiceId: invoice.id,
          publicToken: input.paymentPublicToken,
          status: "pending",
          matchResult: "pending",
          amountMinor: invoice.amountMinor,
          currency: invoice.currency,
          startedAt: now
        }
      });

      await tx.paymentEvent.create({
        data: {
          id: input.paymentEventId,
          organizationId: invoice.organizationId,
          invoiceId: invoice.id,
          paymentId: payment.id,
          type: "payment_session_created",
          fromStatus: null,
          toStatus: payment.status,
          note: "Hosted payment session created.",
          payload: {
            invoicePublicToken: input.publicToken
          }
        }
      });

      if (invoice.status !== "processing") {
        await tx.invoice.update({
          where: { id: invoice.id },
          data: { status: "processing" }
        });
      }

      return {
        paymentId: payment.id,
        status: payment.status,
        redirectPath: `/pay/${input.publicToken}/processing`
      };
    });
  }

  async getPublicInvoice(publicToken: string) {
    const invoice = await this.prisma.invoice.findUnique({
      where: { publicToken },
      include: {
        customer: {
          select: { name: true }
        },
        payments: {
          orderBy: [{ createdAt: "desc" }],
          take: 1,
          select: { status: true }
        }
      }
    });

    if (!invoice || invoice.status === "draft") {
      throw new NotFoundException("Public invoice not found.");
    }

    return {
      invoiceId: invoice.id,
      publicToken: invoice.publicToken,
      referenceCode: invoice.referenceCode,
      customerName: invoice.customer?.name ?? "Customer",
      amountMinor: invoice.amountMinor,
      currency: invoice.currency,
      dueAt: invoice.dueAt.toISOString(),
      memo: invoice.memo,
      status: invoice.status,
      paymentStatus: invoice.payments[0]?.status ?? null
    };
  }

  async getPublicInvoiceStatus(publicToken: string) {
    const invoice = await this.prisma.invoice.findUnique({
      where: { publicToken },
      include: {
        payments: {
          orderBy: [{ createdAt: "desc" }],
          take: 1,
          select: {
            status: true,
            amountMinor: true
          }
        }
      }
    });

    if (!invoice || invoice.status === "draft") {
      throw new NotFoundException("Public invoice not found.");
    }

    const payment = invoice.payments[0] ?? null;

    return {
      invoiceStatus: invoice.status,
      paymentStatus: payment?.status ?? null,
      amountPaidMinor: payment?.status === "finalized" ? payment.amountMinor : 0,
      finalSettlement: payment?.status === "finalized",
      redirectHint:
        payment?.status === "finalized" || invoice.status === "paid"
          ? "success"
          : payment?.status === "failed"
            ? "issue"
            : payment?.status === "processing" || invoice.status === "processing"
              ? "processing"
              : "none"
    };
  }

  async ingestRawChainEvent(input: IngestWorkspaceRawChainEventInput) {
    const normalized = this.normalizeRawChainInput(input);

    const existingPrimary = await this.prisma.rawChainEvent.findFirst({
      where: {
        chainId: normalized.chainId,
        txHash: {
          equals: normalized.txHash,
          mode: "insensitive"
        },
        logIndex: normalized.logIndex
      }
    });

    if (existingPrimary) {
      return this.serializeRawChainIngestionDedupe("primary", existingPrimary);
    }

    const existingFallback = await this.prisma.rawChainEvent.findFirst({
      where: {
        chainId: normalized.chainId,
        txHash: {
          equals: normalized.txHash,
          mode: "insensitive"
        },
        toAddress: {
          equals: normalized.toAddress,
          mode: "insensitive"
        },
        amountAtomic: normalized.amountAtomic
      }
    });

    if (existingFallback) {
      return this.serializeRawChainIngestionDedupe("fallback", existingFallback);
    }

    const wallet = await this.prisma.wallet.findFirst({
      where: {
        chain: {
          equals: this.chainIdToName(normalized.chainId),
          mode: "insensitive"
        },
        address: {
          equals: normalized.toAddress,
          mode: "insensitive"
        }
      },
      select: {
        id: true,
        organizationId: true
      }
    });

    if (!wallet) {
      throw new NotFoundException(
        "No known settlement wallet could be resolved for this raw chain event."
      );
    }

    const observedAt = new Date();
    const created = await this.prisma.$transaction(async (tx) => {
      const rawEvent = await tx.rawChainEvent.create({
        data: {
          id: input.rawEventId,
          organizationId: wallet.organizationId,
          walletId: wallet.id,
          chainId: normalized.chainId,
          txHash: normalized.txHash,
          logIndex: normalized.logIndex,
          blockNumber: normalized.blockNumber,
          blockTimestamp: normalized.blockTimestamp,
          fromAddress: normalized.fromAddress,
          toAddress: normalized.toAddress,
          token: normalized.token,
          amountAtomic: normalized.amountAtomic,
          decimals: normalized.decimals,
          sourceConfirmedAt: normalized.confirmedAt,
          rawPayload: normalized.rawPayload,
          observedAt
        }
      });

      const observation = await tx.chainPaymentObservation.create({
        data: {
          id: input.observationId,
          organizationId: wallet.organizationId,
          walletId: wallet.id,
          rawChainEventId: rawEvent.id,
          chainId: normalized.chainId,
          txHash: normalized.txHash,
          logIndex: normalized.logIndex,
          blockNumber: normalized.blockNumber,
          fromAddress: normalized.fromAddress,
          toAddress: normalized.toAddress,
          token: normalized.token,
          amountAtomic: normalized.amountAtomic,
          decimals: normalized.decimals,
          status: "detected",
          observedAt,
          sourceConfirmedAt: normalized.confirmedAt,
          rawPayload: normalized.rawPayload
        }
      });

      return { rawEvent, observation };
    });

    return {
      deduped: false,
      dedupeMode: "none" as const,
      rawEvent: this.serializeRawChainEvent(created.rawEvent),
      observation: this.serializeObservation(created.observation),
      paymentMatch: null
    };
  }

  async matchStoredObservation(input: MatchWorkspaceObservationInput) {
    const result = await this.prisma.$transaction(async (tx) => {
      const observation = await tx.chainPaymentObservation.findUnique({
        where: { id: input.observationId },
        include: {
          wallet: true
        }
      });

      if (!observation) {
        throw new NotFoundException("Observation not found.");
      }

      const candidates = await this.resolvePaymentCandidates(tx, observation, {
        paymentId: input.paymentId,
        publicToken: input.publicToken
      });
      const resolution = this.resolveMatchResult(observation, candidates, {
        explicit: Boolean(input.paymentId || input.publicToken)
      });
      const existingMatch = await tx.paymentMatch.findUnique({
        where: { observationId: observation.id }
      });

      const observationUpdate =
        resolution.matchResult === "exact" && resolution.payment && resolution.invoice
          ? {
              status: "matched" as const,
              paymentId: resolution.payment.id,
              invoiceId: resolution.invoice.id
            }
          : {
              status:
                resolution.matchResult === "rejected"
                  ? ("rejected" as const)
                  : ("detected" as const),
              paymentId: null,
              invoiceId: null
            };

      const updatedObservation = await tx.chainPaymentObservation.update({
        where: { id: observation.id },
        data: observationUpdate
      });

      const matchData = {
        organizationId: resolution.organizationId ?? observation.organizationId,
        paymentId:
          resolution.matchResult === "exact" ? resolution.payment?.id ?? null : null,
        invoiceId:
          resolution.matchResult === "exact" ? resolution.invoice?.id ?? null : null,
        matchResult: resolution.matchResult,
        matchReason: resolution.matchReason
      } satisfies Prisma.PaymentMatchUncheckedUpdateInput;

      const paymentMatch = existingMatch
        ? await tx.paymentMatch.update({
            where: { id: existingMatch.id },
            data: matchData
          })
        : await tx.paymentMatch.create({
            data: {
              id: input.matchId,
              observationId: observation.id,
              ...matchData
            }
          });

      if (
        resolution.matchResult === PaymentMatchResult.exact &&
        resolution.payment &&
        resolution.invoice
      ) {
        const payment = resolution.payment;
        const invoice = resolution.invoice;
        const now = new Date();
        const fromStatus = payment.status;
        const shouldStartProcessing = fromStatus === PaymentStatus.pending;
        const toStatus = shouldStartProcessing
          ? PaymentStatus.processing
          : fromStatus;

        await tx.payment.updateMany({
          where: {
            observationId: observation.id,
            id: { not: payment.id }
          },
          data: {
            observationId: null
          }
        });

        await tx.payment.update({
          where: { id: payment.id },
          data: {
            observationId: observation.id,
            matchResult: resolution.matchResult,
            matchReason: resolution.matchReason,
            token: observation.token,
            amountAtomic: observation.amountAtomic,
            normalizedAmount: this.toNormalizedDecimal(
              observation.amountAtomic,
              observation.decimals
            ),
            decimals: observation.decimals,
            chainId: observation.chainId,
            txHash: observation.txHash,
            logIndex: observation.logIndex,
            blockNumber: observation.blockNumber,
            fromAddress: observation.fromAddress,
            toAddress: observation.toAddress,
            sourceConfirmedAt: observation.sourceConfirmedAt,
            status: toStatus,
            processingStartedAt: shouldStartProcessing
              ? payment.processingStartedAt ?? now
              : payment.processingStartedAt
          }
        });

        if (
          invoice.status !== InvoiceStatus.processing &&
          invoice.status !== InvoiceStatus.paid
        ) {
          await tx.invoice.update({
            where: { id: invoice.id },
            data: { status: InvoiceStatus.processing }
          });
        }

        const exactMatchNote = `Payment observation ${observation.txHash} matched exactly to invoice ${invoice.referenceCode}.`;
        const existingMatchEvent = await tx.paymentEvent.findFirst({
          where: {
            paymentId: payment.id,
            type: PaymentEventType.payment_match_recorded,
            note: exactMatchNote
          },
          select: { id: true }
        });

        if (!existingMatchEvent) {
          await tx.paymentEvent.create({
            data: {
              id: this.createId("evt"),
              organizationId: payment.organizationId,
              invoiceId: payment.invoiceId,
              paymentId: payment.id,
              fromStatus,
              toStatus: fromStatus,
              type: PaymentEventType.payment_match_recorded,
              note: exactMatchNote,
              payload: {
                observationId: observation.id,
                paymentMatchId: paymentMatch.id,
                txHash: observation.txHash,
                logIndex: observation.logIndex,
                matchReason: resolution.matchReason
              }
            }
          });
        }

        if (shouldStartProcessing) {
          await tx.paymentEvent.create({
            data: {
              id: this.createId("evt"),
              organizationId: payment.organizationId,
              invoiceId: payment.invoiceId,
              paymentId: payment.id,
              fromStatus,
              toStatus,
              type: PaymentEventType.payment_processing_started,
              note: "Payment moved to processing after an exact observation match.",
              payload: {
                observationId: observation.id,
                paymentMatchId: paymentMatch.id,
                txHash: observation.txHash,
                logIndex: observation.logIndex
              }
            }
          });
        }
      }

      return {
        observation: updatedObservation,
        paymentId: resolution.payment?.id ?? null,
        match: paymentMatch
      };
    });

    const payment = result.paymentId
      ? await this.prisma.payment.findUnique({
          where: { id: result.paymentId },
          include: this.paymentInclude()
        })
      : null;

    return {
      observation: this.serializeObservation(result.observation),
      payment: payment ? this.serializePayment(payment) : null,
      match: this.serializePaymentMatch(result.match)
    };
  }

  async finalizePayment(input: FinalizeWorkspacePaymentInput) {
    if (!input.paymentId && !input.publicToken && !input.observationId) {
      throw new BadRequestException(
        "Provide paymentId, publicToken, or observationId for finalization."
      );
    }

    const confirmationBlockNumber = this.normalizeOptionalBlockNumber(
      input.confirmationBlockNumber
    );
    const sourceConfirmedAt = this.normalizeOptionalDate(
      input.sourceConfirmedAt,
      "sourceConfirmedAt"
    );
    const confirmationTxHash = input.confirmationTxHash?.trim() || null;
    const settlementReference =
      input.settlementReference?.trim() || this.createSettlementReference();

    const result = await this.prisma.$transaction(async (tx) => {
      const payment = await this.findTerminalPayment(tx, input);

      if (!payment) {
        throw new NotFoundException("Payment not found.");
      }

      if (payment.status === PaymentStatus.failed) {
        throw new BadRequestException("Failed payments cannot be finalized.");
      }

      if (payment.status === PaymentStatus.finalized) {
        return {
          changed: false,
          paymentId: payment.id
        };
      }

      const now = new Date();
      const shouldStartProcessing = payment.status === PaymentStatus.pending;
      const fromStatus = shouldStartProcessing
        ? PaymentStatus.processing
        : payment.status;
      const effectiveConfirmationTxHash =
        confirmationTxHash ??
        payment.observation?.txHash ??
        payment.confirmationTxHash ??
        payment.txHash;
      const effectiveConfirmationBlockNumber =
        confirmationBlockNumber ??
        payment.observation?.blockNumber ??
        payment.confirmationBlockNumber ??
        payment.blockNumber;
      const effectiveSourceConfirmedAt =
        sourceConfirmedAt ??
        payment.observation?.sourceConfirmedAt ??
        payment.sourceConfirmedAt;

      if (shouldStartProcessing) {
        await tx.paymentEvent.create({
          data: {
            id: this.createId("evt"),
            organizationId: payment.organizationId,
            invoiceId: payment.invoiceId,
            paymentId: payment.id,
            fromStatus: PaymentStatus.pending,
            toStatus: PaymentStatus.processing,
            type: PaymentEventType.payment_processing_started,
            note: "Payment moved to processing before final confirmation was accepted.",
            payload: {
              observationId: payment.observationId,
              confirmationSource: input.confirmationSource
            }
          }
        });
      }

      await tx.payment.update({
        where: { id: payment.id },
        data: {
          status: PaymentStatus.finalized,
          settlementReference,
          confirmationSource: input.confirmationSource,
          txHash: effectiveConfirmationTxHash ?? payment.txHash,
          blockNumber:
            effectiveConfirmationBlockNumber ?? payment.blockNumber,
          confirmationTxHash:
            effectiveConfirmationTxHash ?? payment.confirmationTxHash,
          confirmationBlockNumber:
            effectiveConfirmationBlockNumber ??
            payment.confirmationBlockNumber,
          sourceConfirmedAt: effectiveSourceConfirmedAt,
          confirmationReceivedAt: now,
          confirmedAt: now,
          failureReason: null,
          processingStartedAt: shouldStartProcessing
            ? payment.processingStartedAt ?? now
            : payment.processingStartedAt,
          finalizedAt: now
        }
      });

      await tx.invoice.update({
        where: { id: payment.invoiceId },
        data: {
          status: InvoiceStatus.paid
        }
      });

      if (payment.observationId) {
        await tx.chainPaymentObservation.update({
          where: { id: payment.observationId },
          data: {
            status: ObservationStatus.confirmed,
            confirmedAt: now
          }
        });
      }

      await tx.paymentEvent.create({
        data: {
          id: this.createId("evt"),
          organizationId: payment.organizationId,
          invoiceId: payment.invoiceId,
          paymentId: payment.id,
          fromStatus,
          toStatus: fromStatus,
          type: PaymentEventType.payment_confirmation_received,
          note:
            input.confirmationNote ??
            "Payment confirmation received and accepted.",
          payload: {
            observationId: payment.observationId,
            confirmationSource: input.confirmationSource,
            confirmationTxHash: effectiveConfirmationTxHash,
            confirmationBlockNumber: effectiveConfirmationBlockNumber,
            sourceConfirmedAt: effectiveSourceConfirmedAt?.toISOString() ?? null
          }
        }
      });

      await tx.paymentEvent.create({
        data: {
          id: this.createId("evt"),
          organizationId: payment.organizationId,
          invoiceId: payment.invoiceId,
          paymentId: payment.id,
          fromStatus,
          toStatus: PaymentStatus.finalized,
          type: PaymentEventType.payment_finalized,
          note: input.finalizedNote,
          payload: {
            observationId: payment.observationId,
            settlementReference,
            confirmationSource: input.confirmationSource,
            confirmationTxHash: effectiveConfirmationTxHash,
            confirmationBlockNumber: effectiveConfirmationBlockNumber
          }
        }
      });

      return {
        changed: true,
        paymentId: payment.id
      };
    });

    const payment = await this.prisma.payment.findUnique({
      where: { id: result.paymentId },
      include: this.paymentInclude()
    });

    if (!payment) {
      throw new NotFoundException("Payment not found after finalization.");
    }

    return {
      payment: this.serializePayment(payment),
      changed: result.changed
    };
  }

  async failPayment(input: FailWorkspacePaymentInput) {
    if (!input.paymentId && !input.publicToken && !input.observationId) {
      throw new BadRequestException(
        "Provide paymentId, publicToken, or observationId for failure."
      );
    }

    const confirmationBlockNumber = this.normalizeOptionalBlockNumber(
      input.confirmationBlockNumber
    );
    const sourceConfirmedAt = this.normalizeOptionalDate(
      input.sourceConfirmedAt,
      "sourceConfirmedAt"
    );
    const confirmationTxHash = input.confirmationTxHash?.trim() || null;
    const failureReason =
      input.failureReason?.trim() || "Settlement could not be completed.";

    const result = await this.prisma.$transaction(async (tx) => {
      const payment = await this.findTerminalPayment(tx, input);

      if (!payment) {
        throw new NotFoundException("Payment not found.");
      }

      if (payment.status === PaymentStatus.finalized) {
        throw new BadRequestException(
          "Finalized payments cannot be marked failed."
        );
      }

      if (payment.status === PaymentStatus.failed) {
        return {
          changed: false,
          paymentId: payment.id
        };
      }

      const now = new Date();
      const shouldStartProcessing = payment.status === PaymentStatus.pending;
      const fromStatus = shouldStartProcessing
        ? PaymentStatus.processing
        : payment.status;
      const effectiveConfirmationTxHash =
        confirmationTxHash ??
        payment.observation?.txHash ??
        payment.confirmationTxHash ??
        payment.txHash;
      const effectiveConfirmationBlockNumber =
        confirmationBlockNumber ??
        payment.observation?.blockNumber ??
        payment.confirmationBlockNumber ??
        payment.blockNumber;
      const effectiveSourceConfirmedAt =
        sourceConfirmedAt ??
        payment.observation?.sourceConfirmedAt ??
        payment.sourceConfirmedAt;

      if (shouldStartProcessing) {
        await tx.paymentEvent.create({
          data: {
            id: this.createId("evt"),
            organizationId: payment.organizationId,
            invoiceId: payment.invoiceId,
            paymentId: payment.id,
            fromStatus: PaymentStatus.pending,
            toStatus: PaymentStatus.processing,
            type: PaymentEventType.payment_processing_started,
            note: "Payment moved to processing before the settlement attempt was rejected.",
            payload: {
              observationId: payment.observationId,
              failureSource: input.failureSource
            }
          }
        });
      }

      await tx.payment.update({
        where: { id: payment.id },
        data: {
          status: PaymentStatus.failed,
          failureReason,
          confirmationSource: input.failureSource,
          txHash: effectiveConfirmationTxHash ?? payment.txHash,
          blockNumber:
            effectiveConfirmationBlockNumber ?? payment.blockNumber,
          confirmationTxHash:
            effectiveConfirmationTxHash ?? payment.confirmationTxHash,
          confirmationBlockNumber:
            effectiveConfirmationBlockNumber ??
            payment.confirmationBlockNumber,
          sourceConfirmedAt: effectiveSourceConfirmedAt,
          confirmationReceivedAt: now,
          confirmedAt: now,
          settlementReference: null,
          processingStartedAt: shouldStartProcessing
            ? payment.processingStartedAt ?? now
            : payment.processingStartedAt,
          finalizedAt: null
        }
      });

      if (payment.invoice.status === InvoiceStatus.paid) {
        await tx.invoice.update({
          where: { id: payment.invoiceId },
          data: {
            status: payment.invoice.publishedAt
              ? InvoiceStatus.open
              : InvoiceStatus.draft
          }
        });
      }

      if (payment.observationId) {
        await tx.chainPaymentObservation.update({
          where: { id: payment.observationId },
          data: {
            status: ObservationStatus.rejected
          }
        });
      }

      await tx.paymentEvent.create({
        data: {
          id: this.createId("evt"),
          organizationId: payment.organizationId,
          invoiceId: payment.invoiceId,
          paymentId: payment.id,
          fromStatus,
          toStatus: fromStatus,
          type: PaymentEventType.payment_failure_received,
          note:
            input.failureNote ??
            "Payment failure received and accepted.",
          payload: {
            observationId: payment.observationId,
            failureSource: input.failureSource,
            failureReason,
            confirmationTxHash: effectiveConfirmationTxHash,
            confirmationBlockNumber: effectiveConfirmationBlockNumber,
            sourceConfirmedAt: effectiveSourceConfirmedAt?.toISOString() ?? null
          }
        }
      });

      await tx.paymentEvent.create({
        data: {
          id: this.createId("evt"),
          organizationId: payment.organizationId,
          invoiceId: payment.invoiceId,
          paymentId: payment.id,
          fromStatus,
          toStatus: PaymentStatus.failed,
          type: PaymentEventType.payment_failed,
          note: input.failedNote,
          payload: {
            observationId: payment.observationId,
            failureSource: input.failureSource,
            failureReason,
            confirmationTxHash: effectiveConfirmationTxHash,
            confirmationBlockNumber: effectiveConfirmationBlockNumber
          }
        }
      });

      return {
        changed: true,
        paymentId: payment.id
      };
    });

    const payment = await this.prisma.payment.findUnique({
      where: { id: result.paymentId },
      include: this.paymentInclude()
    });

    if (!payment) {
      throw new NotFoundException("Payment not found after failure transition.");
    }

    return {
      payment: this.serializePayment(payment),
      changed: result.changed
    };
  }

  async refreshObservationFromArcFinality(input: {
    chainId: number;
    txHash: string;
    logIndex?: number;
    blockNumber?: number;
    confirmedAt?: string;
  }) {
    const chainId = Number(input.chainId);
    const txHash = input.txHash.trim();
    const logIndex =
      input.logIndex === undefined || input.logIndex === null
        ? null
        : Number(input.logIndex);
    const blockNumber = this.normalizeOptionalBlockNumber(input.blockNumber);
    const sourceConfirmedAt = this.normalizeOptionalDate(
      input.confirmedAt,
      "confirmedAt"
    );

    if (!Number.isFinite(chainId) || chainId <= 0 || !Number.isInteger(chainId)) {
      throw new BadRequestException("chainId must be a positive integer.");
    }

    if (!txHash) {
      throw new BadRequestException("txHash is required.");
    }

    if (
      logIndex !== null &&
      (!Number.isFinite(logIndex) ||
        logIndex < 0 ||
        !Number.isInteger(logIndex))
    ) {
      throw new BadRequestException("logIndex must be a non-negative integer.");
    }

    const observation = await this.prisma.$transaction(async (tx) => {
      const matches = await tx.chainPaymentObservation.findMany({
        where: {
          chainId,
          txHash: {
            equals: txHash,
            mode: "insensitive"
          },
          ...(logIndex === null ? {} : { logIndex })
        }
      });

      if (!matches.length) {
        throw new NotFoundException(
          "Arc observation not found for the provided locator."
        );
      }

      if (matches.length > 1) {
        throw new BadRequestException(
          "Multiple Arc observations share this txHash. Provide logIndex for finality."
        );
      }

      const match = matches[0];
      const updated = await tx.chainPaymentObservation.update({
        where: { id: match.id },
        data: {
          ...(blockNumber === null ? {} : { blockNumber }),
          ...(sourceConfirmedAt === null ? {} : { sourceConfirmedAt })
        }
      });

      if (updated.rawChainEventId) {
        await tx.rawChainEvent.update({
          where: { id: updated.rawChainEventId },
          data: {
            ...(blockNumber === null ? {} : { blockNumber }),
            ...(sourceConfirmedAt === null ? {} : { sourceConfirmedAt })
          }
        });
      }

      await tx.payment.updateMany({
        where: {
          OR: [
            ...(updated.paymentId ? [{ id: updated.paymentId }] : []),
            { observationId: updated.id }
          ]
        },
        data: {
          ...(blockNumber === null ? {} : { blockNumber }),
          ...(sourceConfirmedAt === null ? {} : { sourceConfirmedAt })
        }
      });

      return updated;
    });

    return this.serializeObservation(observation);
  }

  async getInvoiceById(organizationId: string, invoiceId: string) {
    const invoice = await this.prisma.invoice.findFirst({
      where: {
        id: invoiceId,
        organizationId
      },
      include: {
        customer: true,
        payments: {
          include: this.paymentInclude(),
          orderBy: [{ createdAt: "desc" }]
        },
        paymentEvents: {
          orderBy: [{ createdAt: "asc" }]
        }
      }
    });

    if (!invoice) {
      throw new NotFoundException("Invoice not found.");
    }

    return {
      ...this.serializeInvoice(invoice),
      customerName: invoice.customer?.name ?? "Unknown customer",
      customer: invoice.customer
        ? {
            id: invoice.customer.id,
            name: invoice.customer.name,
            email: invoice.customer.email,
            billingCurrency: invoice.customer.billingCurrency
          }
        : null,
      payments: invoice.payments.map((payment) => this.serializePayment(payment)),
      timeline: this.buildInvoiceTimeline(invoice)
    };
  }

  async listPaymentsByInvoiceId(organizationId: string, invoiceId: string) {
    const payments = await this.prisma.payment.findMany({
      where: {
        organizationId,
        invoiceId
      },
      include: this.paymentInclude(),
      orderBy: [{ createdAt: "desc" }]
    });

    return payments.map((payment) => this.serializePayment(payment));
  }

  async getPaymentById(organizationId: string, paymentId: string) {
    const payment = await this.prisma.payment.findFirst({
      where: {
        id: paymentId,
        organizationId
      },
      include: this.paymentInclude()
    });

    if (!payment) {
      throw new NotFoundException("Payment not found.");
    }

    return this.serializePayment(payment);
  }

  private serializeOrganization(
    organization: Prisma.OrganizationGetPayload<Record<string, never>>
  ) {
    return {
      ...organization,
      createdAt: organization.createdAt.toISOString(),
      updatedAt: organization.updatedAt.toISOString()
    };
  }

  private serializeCustomer(
    customer: Prisma.CustomerGetPayload<Record<string, never>>
  ) {
    return {
      id: customer.id,
      organizationId: customer.organizationId,
      name: customer.name,
      email: customer.email,
      billingCurrency: customer.billingCurrency,
      metadata: customer.metadataJson ?? null,
      createdAt: customer.createdAt.toISOString(),
      updatedAt: customer.updatedAt.toISOString()
    };
  }

  private serializeWallet(wallet: Prisma.WalletGetPayload<Record<string, never>>) {
    return {
      ...wallet,
      createdAt: wallet.createdAt.toISOString(),
      updatedAt: wallet.updatedAt.toISOString()
    };
  }

  private serializeRawChainEvent(
    rawEvent: Prisma.RawChainEventGetPayload<Record<string, never>>
  ) {
    return {
      ...rawEvent,
      blockTimestamp: rawEvent.blockTimestamp?.toISOString() ?? null,
      sourceConfirmedAt: rawEvent.sourceConfirmedAt?.toISOString() ?? null,
      observedAt: rawEvent.observedAt.toISOString(),
      createdAt: rawEvent.createdAt.toISOString(),
      updatedAt: rawEvent.updatedAt.toISOString()
    };
  }

  private serializeInvoice(
    invoice: Prisma.InvoiceGetPayload<Record<string, never>>,
    customerName = "Unknown customer"
  ) {
    return {
      id: invoice.id,
      customerId: invoice.customerId,
      customerName,
      referenceCode: invoice.referenceCode,
      publicToken: invoice.publicToken,
      amountMinor: invoice.amountMinor,
      currency: invoice.currency,
      dueAt: invoice.dueAt.toISOString(),
      memo: invoice.memo,
      internalNote: invoice.internalNote,
      status: invoice.status,
      publishedAt: invoice.publishedAt?.toISOString() ?? null,
      createdAt: invoice.createdAt.toISOString(),
      updatedAt: invoice.updatedAt.toISOString()
    };
  }

  private serializePayment(
    payment: Prisma.PaymentGetPayload<{
      include: ReturnType<WorkspaceReadRepository["paymentInclude"]>;
    }>
  ) {
    const observation = payment.observation
      ? this.serializeObservation(payment.observation)
      : null;
    const paymentMatch =
      payment.observationId && payment.paymentMatches.length
        ? this.serializePaymentMatch(payment.paymentMatches[0])
        : null;

    return {
      id: payment.id,
      organizationId: payment.organizationId,
      invoiceId: payment.invoiceId,
      publicToken: payment.publicToken,
      status: payment.status,
      matchResult: payment.matchResult,
      matchReason: payment.matchReason,
      observationId: payment.observationId,
      amountMinor: payment.amountMinor,
      currency: payment.currency,
      token: payment.token,
      amountAtomic: payment.amountAtomic,
      decimals: payment.decimals,
      chainId: payment.chainId,
      txHash: payment.txHash,
      blockNumber: payment.blockNumber,
      fromAddress: payment.fromAddress,
      toAddress: payment.toAddress,
      settlementReference: payment.settlementReference,
      failureReason: payment.failureReason,
      confirmationSource: payment.confirmationSource,
      confirmationTxHash: payment.confirmationTxHash,
      confirmationBlockNumber: payment.confirmationBlockNumber,
      sourceConfirmedAt: payment.sourceConfirmedAt?.toISOString() ?? null,
      confirmationReceivedAt:
        payment.confirmationReceivedAt?.toISOString() ?? null,
      confirmedAt: payment.confirmedAt?.toISOString() ?? null,
      startedAt: payment.startedAt.toISOString(),
      processingStartedAt: payment.processingStartedAt?.toISOString() ?? null,
      finalizedAt: payment.finalizedAt?.toISOString() ?? null,
      createdAt: payment.createdAt.toISOString(),
      updatedAt: payment.updatedAt.toISOString(),
      observation,
      providerDiagnostic: this.buildProviderDiagnostic(observation),
      paymentMatch,
      events: payment.paymentEvents.map((event) => ({
        id: event.id,
        type: event.type,
        fromStatus: event.fromStatus,
        toStatus: event.toStatus,
        note: event.note,
        createdAt: event.createdAt.toISOString(),
        paymentId: event.paymentId
      })),
      webhookDeliveries: payment.webhookDeliveries.map((delivery) => ({
        ...delivery,
        eventCreatedAt: delivery.eventCreatedAt.toISOString(),
        lastAttemptAt: delivery.lastAttemptAt?.toISOString() ?? null,
        nextAttemptAt: delivery.nextAttemptAt?.toISOString() ?? null,
        deliveredAt: delivery.deliveredAt?.toISOString() ?? null,
        deadLetteredAt: delivery.deadLetteredAt?.toISOString() ?? null,
        createdAt: delivery.createdAt.toISOString(),
        updatedAt: delivery.updatedAt.toISOString(),
        diagnostic: buildWebhookDeliveryDiagnostic({
          status: this.toAppWebhookDeliveryStatus(delivery.status),
          destination: delivery.destination,
          responseStatus: delivery.responseStatus,
          errorMessage: delivery.errorMessage,
          attemptCount: delivery.attemptCount,
          maxAttempts: delivery.maxAttempts,
          nextAttemptAt: delivery.nextAttemptAt,
          deliveredAt: delivery.deliveredAt,
          deadLetteredAt: delivery.deadLetteredAt
        })
      }))
    };
  }

  private serializeObservation(
    observation: Prisma.ChainPaymentObservationGetPayload<Record<string, never>>
  ) {
    return {
      ...observation,
      observedAt: observation.observedAt.toISOString(),
      sourceConfirmedAt: observation.sourceConfirmedAt?.toISOString() ?? null,
      confirmedAt: observation.confirmedAt?.toISOString() ?? null,
      createdAt: observation.createdAt.toISOString(),
      updatedAt: observation.updatedAt.toISOString()
    };
  }

  private buildProviderDiagnostic(
    observation: ReturnType<WorkspaceReadRepository["serializeObservation"]> | null
  ): ArcProviderDiagnostic | null {
    const rawPayload = observation?.rawPayload;
    if (!rawPayload || typeof rawPayload !== "object" || Array.isArray(rawPayload)) {
      return null;
    }

    const diagnostic = (rawPayload as Record<string, unknown>).stablebooksProviderDiagnostic;
    if (!diagnostic || typeof diagnostic !== "object" || Array.isArray(diagnostic)) {
      return null;
    }

    const candidate = diagnostic as Partial<ArcProviderDiagnostic>;
    if (
      (candidate.boundaryKind !== "canonical" &&
        candidate.boundaryKind !== "circle_event_monitor") ||
      (candidate.sourceKind !== "rpc_polling" &&
        candidate.sourceKind !== "indexer_polling" &&
        candidate.sourceKind !== "webhook" &&
        candidate.sourceKind !== "fixtures")
    ) {
      return null;
    }

    return {
      boundaryKind: candidate.boundaryKind,
      sourceKind: candidate.sourceKind,
      sourceProfileMatched:
        typeof candidate.sourceProfileMatched === "boolean"
          ? candidate.sourceProfileMatched
          : null,
      providerWarnings: Array.isArray(candidate.providerWarnings)
        ? candidate.providerWarnings.filter((entry) => typeof entry === "string")
        : [],
      rejectedReason:
        typeof candidate.rejectedReason === "string"
          ? candidate.rejectedReason
          : null
    };
  }

  private serializePaymentMatch(
    match: Prisma.PaymentMatchGetPayload<Record<string, never>>
  ) {
    return {
      ...match,
      createdAt: match.createdAt.toISOString(),
      updatedAt: match.updatedAt.toISOString()
    };
  }

  private toAppWebhookDeliveryStatus(
    status: Prisma.WebhookDeliveryGetPayload<Record<string, never>>["status"]
  ) {
    if (status === "disabled") {
      return "disabled";
    }

    if (status === "delivered") {
      return "delivered";
    }

    if (status === "dead_letter") {
      return "dead_letter";
    }

    return "failed";
  }

  private async serializeRawChainIngestionDedupe(
    dedupeMode: "primary" | "fallback",
    rawEvent: Prisma.RawChainEventGetPayload<Record<string, never>>
  ) {
    const observation = await this.prisma.chainPaymentObservation.findFirst({
      where: { rawChainEventId: rawEvent.id }
    });
    const paymentMatch = observation
      ? await this.prisma.paymentMatch.findUnique({
          where: { observationId: observation.id }
        })
      : null;

    return {
      deduped: true,
      dedupeMode,
      rawEvent: this.serializeRawChainEvent(rawEvent),
      observation: observation ? this.serializeObservation(observation) : null,
      paymentMatch: paymentMatch
        ? this.serializePaymentMatch(paymentMatch)
        : null
    };
  }

  private async resolvePaymentCandidates(
    tx: Prisma.TransactionClient,
    observation: WorkspaceObservationWithWallet,
    input: {
      paymentId?: string;
      publicToken?: string;
    }
  ): Promise<WorkspacePaymentWithInvoice[]> {
    const eligiblePaymentStatuses: PaymentStatus[] = [
      PaymentStatus.pending,
      PaymentStatus.processing
    ];
    const baseWhere = {
      status: {
        in: eligiblePaymentStatuses
      }
    };

    if (input.paymentId) {
      const payment = await tx.payment.findFirst({
        where: {
          ...baseWhere,
          id: input.paymentId
        },
        include: { invoice: true }
      });

      return payment ? [payment] : [];
    }

    if (input.publicToken) {
      return tx.payment.findMany({
        where: {
          ...baseWhere,
          OR: [
            { publicToken: input.publicToken },
            {
              invoice: {
                publicToken: input.publicToken
              }
            }
          ]
        },
        include: { invoice: true },
        orderBy: [{ createdAt: "desc" }]
      });
    }

    const walletOrganizationIds = await this.resolveWalletOrganizationIds(
      tx,
      observation
    );

    if (!walletOrganizationIds.length) {
      return [];
    }

    return tx.payment.findMany({
      where: {
        ...baseWhere,
        organizationId: {
          in: walletOrganizationIds
        },
        invoice: {
          status: {
            in: ["open", "processing"] as const
          }
        }
      },
      include: { invoice: true },
      orderBy: [{ createdAt: "desc" }]
    });
  }

  private async resolveWalletOrganizationIds(
    tx: Prisma.TransactionClient,
    observation: WorkspaceObservationWithWallet
  ) {
    const wallets = await tx.wallet.findMany({
      where: {
        chain: {
          equals: this.chainIdToName(observation.chainId),
          mode: "insensitive"
        },
        address: {
          equals: observation.toAddress,
          mode: "insensitive"
        },
        status: WalletStatus.active
      },
      select: {
        organizationId: true
      }
    });

    if (wallets.length) {
      return [...new Set(wallets.map((wallet) => wallet.organizationId))];
    }

    return observation.wallet?.organizationId
      ? [observation.wallet.organizationId]
      : [];
  }

  private resolveMatchResult(
    observation: Prisma.ChainPaymentObservationGetPayload<Record<string, never>>,
    candidates: WorkspacePaymentWithInvoice[],
    input: { explicit: boolean }
  ) {
    const validCandidates = candidates.filter((candidate) =>
      this.isAcceptedTokenForInvoice(candidate.invoice.currency, observation.token)
    );
    const exactCandidates = validCandidates.filter((candidate) =>
      this.matchesInvoiceAmount(
        observation.amountAtomic,
        observation.decimals,
        candidate.invoice.amountMinor
      )
    );

    if (exactCandidates.length === 1) {
      const exact = exactCandidates[0];

      return {
        organizationId: exact.organizationId,
        payment: exact,
        invoice: exact.invoice,
        matchResult: PaymentMatchResult.exact,
        matchReason:
          "Observation matched exactly to one open payment attempt by wallet routing, token acceptance, and amount."
      };
    }

    if (exactCandidates.length > 1) {
      return {
        organizationId: observation.organizationId,
        payment: null,
        invoice: null,
        matchResult: PaymentMatchResult.ambiguous,
        matchReason:
          "Observation routed to multiple open payment attempts with the same exact amount."
      };
    }

    if (candidates.length > 0) {
      const matchResult = input.explicit
        ? PaymentMatchResult.rejected
        : PaymentMatchResult.unmatched;

      return {
        organizationId: observation.organizationId,
        payment: null,
        invoice: null,
        matchResult,
        matchReason:
          matchResult === "rejected"
            ? "Observation resolved to a payment attempt, but token or amount validation failed."
            : "Observation reached a known settlement wallet, but no exact open payment attempt could be matched."
      };
    }

    return {
      organizationId: observation.organizationId,
      payment: null,
      invoice: null,
      matchResult: PaymentMatchResult.unmatched,
      matchReason:
        "Observation reached a known settlement wallet, but no open payment attempt was available for matching."
    };
  }

  private isAcceptedTokenForInvoice(currency: string, token: string) {
    const normalizedToken = token.trim().toUpperCase();
    const invoiceCurrency = currency.trim().toUpperCase();

    if (normalizedToken === invoiceCurrency) {
      return true;
    }

    if (invoiceCurrency === "USD") {
      return normalizedToken === "USDC" || normalizedToken === "USD";
    }

    return false;
  }

  private matchesInvoiceAmount(
    amountAtomic: string,
    decimals: number,
    invoiceAmountMinor: number
  ) {
    const atomic = BigInt(amountAtomic);
    const scale = 10n ** BigInt(decimals);
    return atomic * 100n === BigInt(invoiceAmountMinor) * scale;
  }

  private async findTerminalPayment(
    tx: Prisma.TransactionClient,
    input: {
      paymentId?: string;
      publicToken?: string;
      observationId?: string;
      organizationId?: string;
    }
  ) {
    const organizationWhere = input.organizationId
      ? { organizationId: input.organizationId }
      : {};
    const include = {
      invoice: true,
      observation: true
    } satisfies Prisma.PaymentInclude;

    if (input.paymentId) {
      return tx.payment.findFirst({
        where: {
          ...organizationWhere,
          id: input.paymentId
        },
        include
      });
    }

    if (input.observationId) {
      return tx.payment.findFirst({
        where: {
          ...organizationWhere,
          OR: [
            { observationId: input.observationId },
            {
              observedSignals: {
                some: {
                  id: input.observationId
                }
              }
            }
          ]
        },
        include
      });
    }

    return tx.payment.findFirst({
      where: {
        ...organizationWhere,
        OR: [
          { publicToken: input.publicToken },
          {
            invoice: {
              publicToken: input.publicToken
            }
          }
        ]
      },
      include,
      orderBy: [{ createdAt: "desc" }]
    });
  }

  private normalizeOptionalBlockNumber(blockNumber: number | undefined) {
    if (blockNumber === undefined) {
      return null;
    }

    const normalized = Number(blockNumber);
    if (
      !Number.isFinite(normalized) ||
      normalized <= 0 ||
      !Number.isInteger(normalized)
    ) {
      throw new BadRequestException("blockNumber must be a positive integer.");
    }

    return normalized;
  }

  private normalizeOptionalDate(value: string | undefined, fieldName: string) {
    const trimmed = value?.trim();
    if (!trimmed) {
      return null;
    }

    if (Number.isNaN(Date.parse(trimmed))) {
      throw new BadRequestException(`${fieldName} must be a valid ISO timestamp.`);
    }

    return new Date(trimmed);
  }

  private toNormalizedDecimal(amountAtomic: string, decimals: number) {
    return new Prisma.Decimal(amountAtomic).div(
      new Prisma.Decimal(10).pow(decimals)
    );
  }

  private normalizeRawChainInput(input: IngestWorkspaceRawChainEventInput) {
    const txHash = input.txHash.trim();
    const fromAddress = input.from.trim();
    const toAddress = input.to.trim();
    const token = input.token.trim().toUpperCase();
    const amountAtomic = String(input.amount ?? "").trim();
    const decimals = Number(input.decimals);
    const chainId = Number(input.chainId);
    const blockNumber = Number(input.blockNumber);
    const logIndex =
      input.logIndex === undefined || input.logIndex === null
        ? 0
        : Number(input.logIndex);
    const confirmedAt = input.confirmedAt?.trim() || null;
    const blockTimestamp = input.blockTimestamp?.trim() || null;

    if (!txHash || !fromAddress || !toAddress || !token || !amountAtomic) {
      throw new BadRequestException(
        "txHash, from, to, token, and amount are required."
      );
    }

    if (
      !Number.isFinite(blockNumber) ||
      blockNumber <= 0 ||
      !Number.isInteger(blockNumber)
    ) {
      throw new BadRequestException("blockNumber must be a positive integer.");
    }

    if (
      !Number.isFinite(logIndex) ||
      logIndex < 0 ||
      !Number.isInteger(logIndex)
    ) {
      throw new BadRequestException("logIndex must be a non-negative integer.");
    }

    if (
      !Number.isFinite(decimals) ||
      decimals < 0 ||
      !Number.isInteger(decimals)
    ) {
      throw new BadRequestException("decimals must be a non-negative integer.");
    }

    if (!Number.isFinite(chainId) || chainId <= 0 || !Number.isInteger(chainId)) {
      throw new BadRequestException("chainId must be a positive integer.");
    }

    if (!/^\d+$/.test(amountAtomic)) {
      throw new BadRequestException("amount must be a base-10 integer string.");
    }

    if (confirmedAt && Number.isNaN(Date.parse(confirmedAt))) {
      throw new BadRequestException("confirmedAt must be a valid ISO timestamp.");
    }

    if (blockTimestamp && Number.isNaN(Date.parse(blockTimestamp))) {
      throw new BadRequestException(
        "blockTimestamp must be a valid ISO timestamp."
      );
    }

    return {
      txHash,
      fromAddress,
      toAddress,
      token,
      amountAtomic,
      decimals,
      chainId,
      blockNumber,
      logIndex,
      blockTimestamp: blockTimestamp ? new Date(blockTimestamp) : null,
      confirmedAt: confirmedAt ? new Date(confirmedAt) : null,
      rawPayload: (input.rawPayload ?? {}) as Prisma.InputJsonValue
    };
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

  private buildInvoiceTimeline(
    invoice: Prisma.InvoiceGetPayload<{
      include: {
        customer: true;
        payments: {
          include: ReturnType<WorkspaceReadRepository["paymentInclude"]>;
        };
        paymentEvents: true;
      };
    }>
  ) {
    const baseEvents = [
      {
        id: `${invoice.id}_created`,
        type: "invoice_created",
        note: "Invoice record created.",
        createdAt: invoice.createdAt.toISOString()
      }
    ];

    if (invoice.publishedAt) {
      baseEvents.push({
        id: `${invoice.id}_published`,
        type: "invoice_published",
        note: "Invoice published and made payable.",
        createdAt: invoice.publishedAt.toISOString()
      });
    }

    const paymentEvents = invoice.paymentEvents.map((event) => ({
      id: event.id,
      type: event.type,
      note: event.note,
      createdAt: event.createdAt.toISOString(),
      paymentId: event.paymentId
    }));

    return [...baseEvents, ...paymentEvents].sort((a, b) =>
      a.createdAt.localeCompare(b.createdAt)
    );
  }

  private paymentInclude() {
    return {
      observation: true,
      paymentMatches: {
        orderBy: [{ createdAt: "desc" as const }],
        take: 1
      },
      paymentEvents: {
        orderBy: [{ createdAt: "asc" as const }]
      },
      webhookDeliveries: {
        orderBy: [{ createdAt: "desc" as const }]
      }
    };
  }

  private createId(prefix: string) {
    return `${prefix}_${randomBytes(8).toString("hex")}`;
  }

  private createSettlementReference() {
    return `settle_${randomBytes(6).toString("hex")}`;
  }
}
