import { BadRequestException, Injectable } from "@nestjs/common";
import { randomBytes } from "node:crypto";
import { CurrentAuth } from "../auth/current-auth";
import {
  AppMembership,
  AppOrganization,
  StorageService
} from "../storage/storage.service";
import { AuthRuntimeRepository } from "../storage/auth-runtime.repository";
import { WorkspaceReadRepository } from "../storage/workspace-read.repository";

@Injectable()
export class OrganizationsService {
  constructor(
    private readonly storage: StorageService,
    private readonly authRuntimeRepository: AuthRuntimeRepository,
    private readonly workspaceReadRepository: WorkspaceReadRepository
  ) {}

  async createForUser(
    auth: CurrentAuth,
    input: { name: string; billingCountry: string; baseCurrency: string }
  ) {
    const name = input.name.trim();
    const billingCountry = input.billingCountry.trim().toUpperCase();
    const baseCurrency = input.baseCurrency.trim().toUpperCase();

    if (!name || !billingCountry || !baseCurrency) {
      throw new BadRequestException("Organization name, billing country, and base currency are required.");
    }

    if (this.shouldUsePostgresWorkspace()) {
      const existingMembership = await this.authRuntimeRepository.getMembershipForUser(
        auth.userId
      );
      if (existingMembership) {
        throw new BadRequestException("This user already has an organization.");
      }

      const now = new Date().toISOString();
      const organization: AppOrganization = {
        id: this.createId("org"),
        name,
        billingCountry,
        baseCurrency,
        onboardingStatus: "pending_wallet",
        createdAt: now,
        updatedAt: now
      };
      const membership: AppMembership = {
        id: this.createId("mem"),
        userId: auth.userId,
        organizationId: organization.id,
        role: "admin",
        createdAt: now
      };

      await this.workspaceReadRepository.createOrganization({
        id: organization.id,
        name: organization.name,
        billingCountry: organization.billingCountry,
        baseCurrency: organization.baseCurrency,
        onboardingStatus: organization.onboardingStatus
      });
      await this.authRuntimeRepository.createMembership({
        id: membership.id,
        userId: membership.userId,
        organizationId: membership.organizationId,
        role: membership.role
      });

      return {
        organization,
        membership
      };
    }

    return this.storage.mutate(async (store) => {
      const existingMembershipInStore = store.memberships.find(
        (membership) => membership.userId === auth.userId
      );
      if (existingMembershipInStore) {
        throw new BadRequestException("This user already has an organization.");
      }

      const now = new Date().toISOString();
      const organization: AppOrganization = {
        id: this.createId("org"),
        name,
        billingCountry,
        baseCurrency,
        onboardingStatus: "pending_wallet",
        createdAt: now,
        updatedAt: now
      };
      const membership: AppMembership = {
        id: this.createId("mem"),
        userId: auth.userId,
        organizationId: organization.id,
        role: "admin",
        createdAt: now
      };

      store.organizations.push(organization);
      store.memberships.push(membership);

      return {
        organization,
        membership
      };
    });
  }

  async getCurrent(auth: CurrentAuth) {
    if (!auth.organizationId) {
      return null;
    }

    if (this.shouldUsePostgresWorkspace()) {
      return this.workspaceReadRepository.getOrganizationById(auth.organizationId);
    }

    const store = await this.storage.read();
    return (
      store.organizations.find((organization) => organization.id === auth.organizationId) ??
      null
    );
  }

  async markCompleted(organizationId: string) {
    if (this.shouldUsePostgresWorkspace()) {
      await this.workspaceReadRepository.updateOrganizationOnboardingStatus(
        organizationId,
        "completed"
      );
      return;
    }

    await this.storage.mutate(async (store) => {
      const organization = store.organizations.find((entry) => entry.id === organizationId);
      if (!organization) {
        return;
      }

      organization.onboardingStatus = "completed";
      organization.updatedAt = new Date().toISOString();
    });
  }

  private createId(prefix: string) {
    return `${prefix}_${randomBytes(8).toString("hex")}`;
  }

  private shouldUsePostgresWorkspace() {
    return process.env.STABLEBOOKS_STORAGE_MODE?.trim() === "postgres_reads";
  }
}
