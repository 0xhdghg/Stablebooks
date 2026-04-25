import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { randomBytes } from "node:crypto";
import { CurrentAuth } from "../auth/current-auth";
import { AppCustomer, StorageService } from "../storage/storage.service";
import { WorkspaceReadRepository } from "../storage/workspace-read.repository";

@Injectable()
export class CustomersService {
  constructor(
    private readonly storage: StorageService,
    private readonly workspaceReadRepository: WorkspaceReadRepository
  ) {}

  async list(auth: CurrentAuth) {
    if (!auth.organizationId) {
      return [];
    }

    if (this.shouldUsePostgresWorkspace()) {
      return this.workspaceReadRepository.listCustomers(auth.organizationId);
    }

    const store = await this.storage.read();
    return store.customers
      .filter((customer) => customer.organizationId === auth.organizationId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async getById(auth: CurrentAuth, customerId: string) {
    if (!auth.organizationId) {
      throw new NotFoundException("Customer not found.");
    }

    if (this.shouldUsePostgresWorkspace()) {
      return this.workspaceReadRepository.getCustomerById(
        auth.organizationId,
        customerId
      );
    }

    const store = await this.storage.read();
    const customer = store.customers.find(
      (entry) => entry.id === customerId && entry.organizationId === auth.organizationId
    );

    if (!customer) {
      throw new NotFoundException("Customer not found.");
    }

    const invoices = store.invoices
      .filter((invoice) => invoice.customerId === customer.id)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

    return {
      ...customer,
      invoices
    };
  }

  async create(
    auth: CurrentAuth,
    input: { name: string; email: string; billingCurrency: string }
  ) {
    if (!auth.organizationId) {
      throw new BadRequestException("Create an organization before adding customers.");
    }

    const organizationId = auth.organizationId;
    const name = input.name.trim();
    const email = input.email.trim().toLowerCase();
    const billingCurrency = input.billingCurrency.trim().toUpperCase();

    if (!name || !email || !billingCurrency) {
      throw new BadRequestException("Name, email, and billing currency are required.");
    }

    if (this.shouldUsePostgresWorkspace()) {
      const now = new Date().toISOString();
      const customer: AppCustomer = {
        id: this.createId("cus"),
        organizationId,
        name,
        email,
        billingCurrency,
        metadata: null,
        createdAt: now,
        updatedAt: now
      };

      await this.workspaceReadRepository.createCustomer({
        id: customer.id,
        organizationId: customer.organizationId,
        name: customer.name,
        email: customer.email,
        billingCurrency: customer.billingCurrency
      });

      return customer;
    }

    return this.storage.mutate(async (store) => {
      const duplicate = store.customers.find(
        (customer) =>
          customer.organizationId === organizationId &&
          customer.email === email
      );

      if (duplicate) {
        throw new BadRequestException("A customer with that email already exists.");
      }

      const now = new Date().toISOString();
      const customer: AppCustomer = {
        id: this.createId("cus"),
        organizationId,
        name,
        email,
        billingCurrency,
        metadata: null,
        createdAt: now,
        updatedAt: now
      };

      store.customers.push(customer);
      return customer;
    });
  }

  private createId(prefix: string) {
    return `${prefix}_${randomBytes(8).toString("hex")}`;
  }

  private shouldUsePostgresWorkspace() {
    return process.env.STABLEBOOKS_STORAGE_MODE?.trim() === "postgres_reads";
  }
}
