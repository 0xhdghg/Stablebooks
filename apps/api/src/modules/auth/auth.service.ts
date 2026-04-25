import {
  BadRequestException,
  Injectable,
  UnauthorizedException
} from "@nestjs/common";
import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import {
  AppMembership,
  AppOrganization,
  AppSession,
  AppUser,
  AppWallet,
  StorageService
} from "../storage/storage.service";

type AuthContext = {
  user: AppUser;
  session: AppSession;
  organization: AppOrganization | null;
  membership: AppMembership | null;
  wallets: AppWallet[];
};

@Injectable()
export class AuthService {
  constructor(private readonly storage: StorageService) {}

  async signup(input: { email: string; password: string; name: string }) {
    const email = input.email.trim().toLowerCase();
    const name = input.name.trim();

    if (!email || !name || input.password.length < 8) {
      throw new BadRequestException("Provide name, email, and a password with at least 8 characters.");
    }

    return this.storage.mutate(async (store) => {
      const existing = store.users.find((user) => user.email === email);
      if (existing) {
        throw new BadRequestException("An account with that email already exists.");
      }

      const now = new Date().toISOString();
      const user: AppUser = {
        id: this.createId("usr"),
        email,
        name,
        passwordHash: this.hashPassword(input.password),
        createdAt: now,
        updatedAt: now
      };
      const session: AppSession = {
        token: this.createToken(),
        userId: user.id,
        createdAt: now
      };

      store.users.push(user);
      store.sessions.push(session);

      return this.serializeAuthResponse({
        user,
        session,
        organization: null,
        membership: null,
        wallets: []
      });
    });
  }

  async signin(input: { email: string; password: string }) {
    const email = input.email.trim().toLowerCase();

    return this.storage.mutate(async (store) => {
      const user = store.users.find((entry) => entry.email === email);
      if (!user || !this.verifyPassword(input.password, user.passwordHash)) {
        throw new UnauthorizedException("Invalid email or password.");
      }

      const now = new Date().toISOString();
      const session: AppSession = {
        token: this.createToken(),
        userId: user.id,
        createdAt: now
      };

      store.sessions = store.sessions.filter((entry) => entry.userId !== user.id);
      store.sessions.push(session);

      const membership = store.memberships.find((entry) => entry.userId === user.id) ?? null;
      const organization = membership
        ? store.organizations.find((entry) => entry.id === membership.organizationId) ?? null
        : null;
      const wallets = organization
        ? store.wallets.filter((entry) => entry.organizationId === organization.id)
        : [];

      return this.serializeAuthResponse({
        user,
        session,
        organization,
        membership,
        wallets
      });
    });
  }

  async signout(token: string | null) {
    if (!token) {
      return { success: true };
    }

    await this.storage.mutate(async (store) => {
      store.sessions = store.sessions.filter((entry) => entry.token !== token);
    });

    return { success: true };
  }

  async getContextFromToken(token: string | null): Promise<AuthContext> {
    if (!token) {
      throw new UnauthorizedException("Missing authentication token.");
    }

    const store = await this.storage.read();
    const session = store.sessions.find((entry) => entry.token === token);
    if (!session) {
      throw new UnauthorizedException("Invalid authentication token.");
    }

    const user = store.users.find((entry) => entry.id === session.userId);
    if (!user) {
      throw new UnauthorizedException("User not found for this session.");
    }

    const membership = store.memberships.find((entry) => entry.userId === user.id) ?? null;
    const organization = membership
      ? store.organizations.find((entry) => entry.id === membership.organizationId) ?? null
      : null;
    const wallets = organization
      ? store.wallets.filter((entry) => entry.organizationId === organization.id)
      : [];

    return { user, session, membership, organization, wallets };
  }

  async getMe(token: string | null) {
    const context = await this.getContextFromToken(token);
    return this.serializeAuthResponse(context);
  }

  private serializeAuthResponse(context: AuthContext) {
    const hasOrganization = Boolean(context.organization);
    const hasDefaultSettlementWallet = context.wallets.some(
      (wallet) => wallet.isDefaultSettlement
    );

    return {
      token: context.session.token,
      user: {
        id: context.user.id,
        email: context.user.email,
        name: context.user.name
      },
      organization: context.organization
        ? {
            id: context.organization.id,
            name: context.organization.name,
            billingCountry: context.organization.billingCountry,
            baseCurrency: context.organization.baseCurrency,
            onboardingStatus: context.organization.onboardingStatus
          }
        : null,
      membership: context.membership,
      wallets: context.wallets,
      onboarding: {
        hasOrganization,
        hasDefaultSettlementWallet,
        completed: hasOrganization && hasDefaultSettlementWallet,
        nextStep: !hasOrganization
          ? "organization"
          : hasDefaultSettlementWallet
            ? "dashboard"
            : "wallet"
      }
    };
  }

  private hashPassword(password: string) {
    const salt = randomBytes(16).toString("hex");
    const hash = scryptSync(password, salt, 64).toString("hex");
    return `${salt}:${hash}`;
  }

  private verifyPassword(password: string, stored: string) {
    const [salt, hash] = stored.split(":");
    if (!salt || !hash) {
      return false;
    }
    const candidate = scryptSync(password, salt, 64);
    const expected = Buffer.from(hash, "hex");
    return candidate.length === expected.length && timingSafeEqual(candidate, expected);
  }

  private createId(prefix: string) {
    return `${prefix}_${randomBytes(8).toString("hex")}`;
  }

  private createToken() {
    return `sb_${randomBytes(24).toString("hex")}`;
  }
}
