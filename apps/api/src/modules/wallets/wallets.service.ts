import { BadRequestException, Injectable } from "@nestjs/common";
import { randomBytes } from "node:crypto";
import { CurrentAuth } from "../auth/current-auth";
import { OrganizationsService } from "../organizations/organizations.service";
import { AppWallet, StorageService } from "../storage/storage.service";
import { WorkspaceReadRepository } from "../storage/workspace-read.repository";

@Injectable()
export class WalletsService {
  constructor(
    private readonly storage: StorageService,
    private readonly organizationsService: OrganizationsService,
    private readonly workspaceReadRepository: WorkspaceReadRepository
  ) {}

  async list(auth: CurrentAuth) {
    if (!auth.organizationId) {
      return [];
    }

    if (this.shouldUsePostgresWorkspace()) {
      return this.workspaceReadRepository.listWallets(auth.organizationId);
    }

    const store = await this.storage.read();
    return store.wallets.filter((wallet) => wallet.organizationId === auth.organizationId);
  }

  async create(
    auth: CurrentAuth,
    input: {
      chain: string;
      address: string;
      label: string;
      role: "collection" | "operating" | "reserve" | "payout";
      isDefaultSettlement: boolean;
    }
  ) {
    if (!auth.organizationId) {
      throw new BadRequestException("Create an organization before adding wallets.");
    }

    const organizationId = auth.organizationId;
    const chain = input.chain.trim();
    const address = input.address.trim();
    const label = input.label.trim();

    if (!chain || !address || !label || !this.looksLikeWallet(address)) {
      throw new BadRequestException("Provide a valid chain, label, and wallet address.");
    }

    const createdWallet = await this.storage.mutate(async (store) => {
      const duplicate = store.wallets.find(
        (wallet) =>
          wallet.organizationId === organizationId &&
          wallet.chain.toLowerCase() === chain.toLowerCase() &&
          wallet.address.toLowerCase() === address.toLowerCase()
      );

      if (duplicate) {
        throw new BadRequestException("This wallet is already registered.");
      }

      if (input.isDefaultSettlement) {
        for (const wallet of store.wallets) {
          if (wallet.organizationId === organizationId) {
            wallet.isDefaultSettlement = false;
            wallet.updatedAt = new Date().toISOString();
          }
        }
      }

      const now = new Date().toISOString();
      const wallet: AppWallet = {
        id: this.createId("wal"),
        organizationId,
        chain,
        address,
        label,
        role: input.role,
        isDefaultSettlement: input.isDefaultSettlement,
        status: "active",
        createdAt: now,
        updatedAt: now
      };

      store.wallets.push(wallet);
      return wallet;
    });

    if (this.shouldUsePostgresWorkspace()) {
      await this.workspaceReadRepository.createWallet({
        id: createdWallet.id,
        organizationId: createdWallet.organizationId,
        chain: createdWallet.chain,
        address: createdWallet.address,
        label: createdWallet.label,
        role: createdWallet.role,
        isDefaultSettlement: createdWallet.isDefaultSettlement
      });
    }

    if (createdWallet.isDefaultSettlement) {
      await this.organizationsService.markCompleted(organizationId);
    }

    return createdWallet;
  }

  private createId(prefix: string) {
    return `${prefix}_${randomBytes(8).toString("hex")}`;
  }

  private looksLikeWallet(address: string) {
    if (address.startsWith("0x") && address.length === 42) {
      return true;
    }

    return address.length >= 24;
  }

  private shouldUsePostgresWorkspace() {
    return process.env.STABLEBOOKS_STORAGE_MODE?.trim() === "postgres_reads";
  }
}
