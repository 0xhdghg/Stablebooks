import {
  BadRequestException,
  Injectable,
  UnauthorizedException
} from "@nestjs/common";
import { MembershipRole } from "@prisma/client";
import {
  AppMembership,
  AppOrganization,
  AppSession,
  AppUser,
  AppWallet
} from "./storage.service";
import { PrismaService } from "./prisma.service";

export type AuthRuntimeContext = {
  user: AppUser;
  session: AppSession;
  organization: AppOrganization | null;
  membership: AppMembership | null;
  wallets: AppWallet[];
};

type CreateRuntimeUserSessionInput = {
  userId: string;
  token: string;
  email: string;
  name: string;
  passwordHash: string;
};

type CreateRuntimeMembershipInput = {
  id: string;
  userId: string;
  organizationId: string;
  role: "admin" | "member";
};

@Injectable()
export class AuthRuntimeRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findUserByEmail(email: string) {
    const user = await this.prisma.user.findUnique({
      where: { email }
    });

    return user ? this.serializeUser(user) : null;
  }

  async createUserWithSession(input: CreateRuntimeUserSessionInput) {
    const existing = await this.prisma.user.findUnique({
      where: { email: input.email }
    });

    if (existing) {
      throw new BadRequestException("An account with that email already exists.");
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.user.create({
        data: {
          id: input.userId,
          email: input.email,
          name: input.name,
          passwordHash: input.passwordHash
        }
      });

      await tx.session.create({
        data: {
          token: input.token,
          userId: input.userId
        }
      });
    });

    return this.getContextByToken(input.token);
  }

  async replaceUserSession(userId: string, token: string) {
    await this.prisma.$transaction(async (tx) => {
      await tx.session.deleteMany({
        where: { userId }
      });

      await tx.session.create({
        data: {
          token,
          userId
        }
      });
    });

    return this.getContextByToken(token);
  }

  async deleteSessionByToken(token: string) {
    await this.prisma.session.deleteMany({
      where: { token }
    });
  }

  async getMembershipForUser(userId: string) {
    const membership = await this.prisma.membership.findFirst({
      where: { userId },
      orderBy: [{ createdAt: "asc" }]
    });

    return membership ? this.serializeMembership(membership) : null;
  }

  async createMembership(input: CreateRuntimeMembershipInput) {
    const existing = await this.prisma.membership.findUnique({
      where: {
        userId_organizationId: {
          userId: input.userId,
          organizationId: input.organizationId
        }
      }
    });

    if (existing) {
      return this.serializeMembership(existing);
    }

    const membership = await this.prisma.membership.create({
      data: {
        id: input.id,
        userId: input.userId,
        organizationId: input.organizationId,
        role: this.toMembershipRole(input.role)
      }
    });

    return this.serializeMembership(membership);
  }

  async getContextByToken(token: string | null): Promise<AuthRuntimeContext> {
    if (!token) {
      throw new UnauthorizedException("Missing authentication token.");
    }

    const session = await this.prisma.session.findUnique({
      where: { token },
      include: {
        user: {
          include: {
            memberships: {
              include: {
                organization: {
                  include: {
                    wallets: {
                      orderBy: [{ createdAt: "desc" }]
                    }
                  }
                }
              },
              orderBy: [{ createdAt: "asc" }]
            }
          }
        }
      }
    });

    if (!session) {
      throw new UnauthorizedException("Invalid authentication token.");
    }

    const membership = session.user.memberships[0] ?? null;
    const organization = membership?.organization ?? null;
    const wallets = organization?.wallets ?? [];

    return {
      user: this.serializeUser(session.user),
      session: this.serializeSession(session),
      organization: organization ? this.serializeOrganization(organization) : null,
      membership: membership ? this.serializeMembership(membership) : null,
      wallets: wallets.map((wallet) => this.serializeWallet(wallet))
    };
  }

  private serializeUser(user: {
    id: string;
    email: string;
    name: string;
    passwordHash: string;
    createdAt: Date;
    updatedAt: Date;
  }): AppUser {
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      passwordHash: user.passwordHash,
      createdAt: user.createdAt.toISOString(),
      updatedAt: user.updatedAt.toISOString()
    };
  }

  private serializeSession(session: {
    token: string;
    userId: string;
    createdAt: Date;
  }): AppSession {
    return {
      token: session.token,
      userId: session.userId,
      createdAt: session.createdAt.toISOString()
    };
  }

  private serializeMembership(membership: {
    id: string;
    userId: string;
    organizationId: string;
    role: MembershipRole;
    createdAt: Date;
  }): AppMembership {
    return {
      id: membership.id,
      userId: membership.userId,
      organizationId: membership.organizationId,
      role: membership.role,
      createdAt: membership.createdAt.toISOString()
    };
  }

  private serializeOrganization(organization: {
    id: string;
    name: string;
    billingCountry: string;
    baseCurrency: string;
    onboardingStatus: "pending_wallet" | "completed";
    createdAt: Date;
    updatedAt: Date;
  }): AppOrganization {
    return {
      id: organization.id,
      name: organization.name,
      billingCountry: organization.billingCountry,
      baseCurrency: organization.baseCurrency,
      onboardingStatus: organization.onboardingStatus,
      createdAt: organization.createdAt.toISOString(),
      updatedAt: organization.updatedAt.toISOString()
    };
  }

  private serializeWallet(wallet: {
    id: string;
    organizationId: string;
    chain: string;
    address: string;
    label: string;
    role: "collection" | "operating" | "reserve" | "payout";
    isDefaultSettlement: boolean;
    status: "active" | "disabled";
    createdAt: Date;
    updatedAt: Date;
  }): AppWallet {
    return {
      id: wallet.id,
      organizationId: wallet.organizationId,
      chain: wallet.chain,
      address: wallet.address,
      label: wallet.label,
      role: wallet.role,
      isDefaultSettlement: wallet.isDefaultSettlement,
      status: wallet.status,
      createdAt: wallet.createdAt.toISOString(),
      updatedAt: wallet.updatedAt.toISOString()
    };
  }

  private toMembershipRole(role: "admin" | "member") {
    return role === "admin" ? MembershipRole.admin : MembershipRole.member;
  }
}
