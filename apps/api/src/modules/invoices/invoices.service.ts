import {
  BadRequestException,
  Injectable,
  NotFoundException
} from "@nestjs/common";
import { randomBytes } from "node:crypto";
import { CurrentAuth } from "../auth/current-auth";
import { AppInvoice, StorageService } from "../storage/storage.service";
import { PaymentsService } from "../payments/payments.service";
import { WorkspaceReadRepository } from "../storage/workspace-read.repository";

@Injectable()
export class InvoicesService {
  constructor(
    private readonly storage: StorageService,
    private readonly paymentsService: PaymentsService,
    private readonly workspaceReadRepository: WorkspaceReadRepository
  ) {}

  async list(auth: CurrentAuth) {
    if (!auth.organizationId) {
      return [];
    }

    if (this.shouldReadFromPostgres()) {
      return this.workspaceReadRepository.listInvoices(auth.organizationId);
    }

    const store = await this.storage.read();
    return store.invoices
      .filter((invoice) => invoice.organizationId === auth.organizationId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map((invoice) => {
        const customer = store.customers.find((entry) => entry.id === invoice.customerId);
        const latestPayment = this.paymentsService.getLatestPaymentForInvoice(store, invoice.id);
        return {
          ...this.serializeInvoice(invoice, customer?.name ?? "Unknown customer"),
          latestPaymentStatus: latestPayment?.status ?? null
        };
      });
  }

  async getById(auth: CurrentAuth, invoiceId: string) {
    if (!auth.organizationId) {
      throw new NotFoundException("Invoice not found.");
    }

    if (this.shouldReadFromPostgres()) {
      return this.workspaceReadRepository.getInvoiceById(
        auth.organizationId,
        invoiceId
      );
    }

    const store = await this.storage.read();
    const invoice = store.invoices.find(
      (entry) => entry.id === invoiceId && entry.organizationId === auth.organizationId
    );

    if (!invoice) {
      throw new NotFoundException("Invoice not found.");
    }

    const customer = store.customers.find((entry) => entry.id === invoice.customerId);
    const payments = this.paymentsService.listByInvoiceId(auth, invoice.id);
    const timeline = this.buildInvoiceTimeline(store, invoice.id);

    return {
      ...this.serializeInvoice(invoice, customer?.name ?? "Unknown customer"),
      customer: customer
        ? {
            id: customer.id,
            name: customer.name,
            email: customer.email,
            billingCurrency: customer.billingCurrency
          }
        : null,
      payments: await payments,
      timeline
    };
  }

  async create(
    auth: CurrentAuth,
    input: {
      customerId: string;
      amountMinor: number;
      currency: string;
      dueAt: string;
      memo: string;
      internalNote: string;
      publish: boolean;
    }
  ) {
    if (!auth.organizationId) {
      throw new BadRequestException("Create an organization before creating invoices.");
    }

    const organizationId = auth.organizationId;
    const amountMinor = Number(input.amountMinor);
    const currency = input.currency.trim().toUpperCase();
    const dueAt = input.dueAt;
    const memo = input.memo.trim();
    const internalNote = input.internalNote.trim();

    if (!input.customerId || !currency || !dueAt || !Number.isFinite(amountMinor) || amountMinor <= 0) {
      throw new BadRequestException("Provide customer, amount, currency, and due date.");
    }

    if (this.shouldWriteInvoicesToPostgres()) {
      return this.workspaceReadRepository.createInvoice({
        id: this.createId("inv"),
        organizationId,
        customerId: input.customerId,
        referenceCode: this.createReferenceCode(),
        publicToken: this.createToken(),
        amountMinor,
        currency,
        dueAt,
        memo,
        internalNote,
        publish: input.publish
      });
    }

    return this.storage.mutate(async (store) => {
      const customer = store.customers.find(
        (entry) =>
          entry.id === input.customerId && entry.organizationId === organizationId
      );

      if (!customer) {
        throw new BadRequestException("The selected customer does not exist.");
      }

      const now = new Date().toISOString();
      const invoice: AppInvoice = {
        id: this.createId("inv"),
        organizationId,
        customerId: customer.id,
        referenceCode: this.createReferenceCode(),
        publicToken: this.createToken(),
        amountMinor,
        currency,
        dueAt,
        memo,
        internalNote,
        status: input.publish ? "open" : "draft",
        publishedAt: input.publish ? now : null,
        createdAt: now,
        updatedAt: now
      };

      store.invoices.push(invoice);
      return this.serializeInvoice(invoice, customer.name);
    });
  }

  private serializeInvoice(invoice: AppInvoice, customerName: string) {
    return {
      id: invoice.id,
      customerId: invoice.customerId,
      customerName,
      referenceCode: invoice.referenceCode,
      publicToken: invoice.publicToken,
      amountMinor: invoice.amountMinor,
      currency: invoice.currency,
      dueAt: invoice.dueAt,
      memo: invoice.memo,
      internalNote: invoice.internalNote,
      status: invoice.status,
      publishedAt: invoice.publishedAt,
      createdAt: invoice.createdAt,
      updatedAt: invoice.updatedAt
    };
  }

  private buildInvoiceTimeline(
    store: Awaited<ReturnType<StorageService["read"]>>,
    invoiceId: string
  ) {
    const invoice = store.invoices.find((entry) => entry.id === invoiceId);
    if (!invoice) {
      return [];
    }

    const baseEvents = [
      {
        id: `${invoice.id}_created`,
        type: "invoice_created",
        note: "Invoice record created.",
        createdAt: invoice.createdAt
      }
    ];

    if (invoice.publishedAt) {
      baseEvents.push({
        id: `${invoice.id}_published`,
        type: "invoice_published",
        note: "Invoice published and made payable.",
        createdAt: invoice.publishedAt
      });
    }

    const paymentEvents = this.paymentsService.buildTimeline(store, invoiceId);

    return [...baseEvents, ...paymentEvents].sort((a, b) =>
      a.createdAt.localeCompare(b.createdAt)
    );
  }

  private createId(prefix: string) {
    return `${prefix}_${randomBytes(8).toString("hex")}`;
  }

  private createReferenceCode() {
    return `SB-${randomBytes(3).toString("hex").toUpperCase()}`;
  }

  private createToken() {
    return `pub_${randomBytes(12).toString("hex")}`;
  }

  private shouldReadFromPostgres() {
    return process.env.STABLEBOOKS_STORAGE_MODE?.trim() === "postgres_reads";
  }

  private shouldWriteInvoicesToPostgres() {
    return process.env.STABLEBOOKS_INVOICE_WRITE_MODE?.trim() === "postgres";
  }
}
