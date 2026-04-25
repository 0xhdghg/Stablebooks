import { Injectable, NotFoundException } from "@nestjs/common";
import { ArcCanonicalEvent, ArcFixtureName } from "./arc.types";

type ArcFixtureOverrides = Partial<ArcCanonicalEvent>;

@Injectable()
export class ArcFixturesService {
  listFixtureNames(): ArcFixtureName[] {
    return [
      "invoice_exact_match",
      "invoice_exact_match_alt_sender",
      "invoice_unmatched_amount"
    ];
  }

  createFixture(
    name: string,
    overrides: ArcFixtureOverrides = {}
  ): ArcCanonicalEvent {
    const fixtureName = this.assertFixtureName(name);
    const base = this.buildBaseFixture(fixtureName);

    return {
      ...base,
      ...overrides,
      rawPayload: {
        ...(base.rawPayload ?? {}),
        ...(overrides.rawPayload ?? {}),
        fixtureName
      }
    };
  }

  private assertFixtureName(name: string): ArcFixtureName {
    if (name === "invoice_exact_match") {
      return name;
    }

    if (name === "invoice_exact_match_alt_sender") {
      return name;
    }

    if (name === "invoice_unmatched_amount") {
      return name;
    }

    throw new NotFoundException(`Unknown Arc fixture: ${name}.`);
  }

  private buildBaseFixture(name: ArcFixtureName): ArcCanonicalEvent {
    const common = {
      to: "0x1111111111111111111111111111111111111111",
      token: "USDC",
      decimals: 6,
      chainId: 777,
      logIndex: 0
    } satisfies Pick<
      ArcCanonicalEvent,
      "to" | "token" | "decimals" | "chainId" | "logIndex"
    >;

    if (name === "invoice_exact_match") {
      return {
        ...common,
        txHash: "0xarcfixture00000000000000000000000000000000000000000000000000000001",
        blockNumber: 303001,
        confirmedAt: "2026-04-20T18:10:00.000Z",
        from: "0x4444444444444444444444444444444444444444",
        amount: "1250000000",
        blockTimestamp: "2026-04-20T18:09:54.000Z",
        rawPayload: {
          provider: "arc-fixture"
        }
      };
    }

    if (name === "invoice_exact_match_alt_sender") {
      return {
        ...common,
        txHash: "0xarcfixture00000000000000000000000000000000000000000000000000000002",
        blockNumber: 303002,
        confirmedAt: "2026-04-20T18:11:00.000Z",
        from: "0x5555555555555555555555555555555555555555",
        amount: "1250000000",
        blockTimestamp: "2026-04-20T18:10:54.000Z",
        rawPayload: {
          provider: "arc-fixture"
        }
      };
    }

    return {
      ...common,
      txHash: "0xarcfixture00000000000000000000000000000000000000000000000000000003",
      blockNumber: 303003,
      confirmedAt: "2026-04-20T18:12:00.000Z",
      from: "0x6666666666666666666666666666666666666666",
      amount: "990000000",
      blockTimestamp: "2026-04-20T18:11:54.000Z",
      rawPayload: {
        provider: "arc-fixture"
      }
    };
  }
}
