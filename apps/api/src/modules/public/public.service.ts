import { Injectable, NotFoundException } from "@nestjs/common";
import { randomBytes } from "node:crypto";
import {
  AppInvoice,
  AppPayment,
  StorageService
} from "../storage/storage.service";
import { PaymentsService } from "../payments/payments.service";
import { WorkspaceReadRepository } from "../storage/workspace-read.repository";

@Injectable()
export class PublicService {
  constructor(
    private readonly storage: StorageService,
    private readonly paymentsService: PaymentsService,
    private readonly workspaceReadRepository: WorkspaceReadRepository
  ) {}

  async getInvoice(publicToken: string) {
    if (this.shouldReadFromPostgres()) {
      return this.workspaceReadRepository.getPublicInvoice(publicToken);
    }

    const store = await this.storage.read();
    const invoice = this.findPayableInvoice(store.invoices, publicToken);
    const customer = store.customers.find((entry) => entry.id === invoice.customerId) ?? null;
    const payment = this.paymentsService.getLatestPaymentForInvoice(store, invoice.id);

    return this.serializePublicInvoice(invoice, customer?.name ?? "Customer", payment);
  }

  async getStatus(publicToken: string) {
    if (this.shouldReadFromPostgres()) {
      return this.workspaceReadRepository.getPublicInvoiceStatus(publicToken);
    }

    return this.storage.read().then((store) => {
      const invoice = this.findPayableInvoice(store.invoices, publicToken);
      const payment = this.paymentsService.getLatestPaymentForInvoice(store, invoice.id);

      return {
        invoiceStatus: invoice.status,
        paymentStatus: payment?.status ?? null,
        amountPaidMinor:
          payment?.status === "finalized" ? payment.amountMinor : 0,
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
    });
  }

  async createPaymentSession(publicToken: string) {
    if (this.shouldWritePaymentSessionsToPostgres()) {
      return this.workspaceReadRepository.createPaymentSession({
        publicToken,
        paymentId: this.createId("pay"),
        paymentPublicToken: this.createId("pay_pub"),
        paymentEventId: this.createId("evt")
      });
    }

    return this.storage.mutate(async (store) => {
      const invoice = this.findPayableInvoice(store.invoices, publicToken);

      if (invoice.status === "paid") {
        return {
          paymentId: this.paymentsService.getLatestPaymentForInvoice(store, invoice.id)?.id ?? null,
          status: "finalized" as const,
          redirectPath: `/pay/${publicToken}/success`
        };
      }

      const existing = this.paymentsService.getLatestPaymentForInvoice(store, invoice.id);
      if (existing && (existing.status === "pending" || existing.status === "processing")) {
        invoice.status = "processing";
        invoice.updatedAt = new Date().toISOString();
        return {
          paymentId: existing.id,
          status: existing.status,
          redirectPath: `/pay/${publicToken}/processing`
        };
      }
      if (existing && existing.status === "finalized") {
        return {
          paymentId: existing.id,
          status: existing.status,
          redirectPath: `/pay/${publicToken}/success`
        };
      }

      const payment = this.paymentsService.createPendingPayment(
        {
          organizationId: invoice.organizationId,
          invoiceId: invoice.id,
          publicToken,
          amountMinor: invoice.amountMinor,
          currency: invoice.currency
        },
        store
      );
      invoice.status = "processing";
      invoice.updatedAt = payment.createdAt;

      return {
        paymentId: payment.id,
        status: payment.status,
        redirectPath: `/pay/${publicToken}/processing`
      };
    });
  }

  private serializePublicInvoice(
    invoice: AppInvoice,
    customerName: string,
    payment: AppPayment | null
  ) {
    return {
      invoiceId: invoice.id,
      publicToken: invoice.publicToken,
      referenceCode: invoice.referenceCode,
      customerName,
      amountMinor: invoice.amountMinor,
      currency: invoice.currency,
      dueAt: invoice.dueAt,
      memo: invoice.memo,
      status: invoice.status,
      paymentStatus: payment?.status ?? null
    };
  }

  private findPayableInvoice(invoices: AppInvoice[], publicToken: string) {
    const invoice = invoices.find((entry) => entry.publicToken === publicToken);
    if (!invoice || invoice.status === "draft") {
      throw new NotFoundException("Public invoice not found.");
    }
    return invoice;
  }

  private createId(prefix: string) {
    return `${prefix}_${randomBytes(8).toString("hex")}`;
  }

  private shouldWritePaymentSessionsToPostgres() {
    return process.env.STABLEBOOKS_PAYMENT_SESSION_WRITE_MODE?.trim() === "postgres";
  }

  private shouldReadFromPostgres() {
    return process.env.STABLEBOOKS_STORAGE_MODE?.trim() === "postgres_reads";
  }
}
