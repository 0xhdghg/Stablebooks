"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

const API_BASE_URL = (
  process.env.NEXT_PUBLIC_API_BASE_URL?.trim() ||
  "http://127.0.0.1:4000/api/v1"
).replace(/\/+$/, "");

type PublicPaymentPollerProps = {
  publicToken: string;
};

export function PublicPaymentPoller({ publicToken }: PublicPaymentPollerProps) {
  const router = useRouter();

  useEffect(() => {
    let active = true;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const poll = async () => {
      try {
        const response = await fetch(
          `${API_BASE_URL}/public/invoices/${publicToken}/status`,
          {
            cache: "no-store"
          }
        );

        if (!response.ok) {
          throw new Error("status");
        }

        const payload = (await response.json()) as {
          data: {
            redirectHint: "none" | "processing" | "success" | "issue";
          };
        };

        if (!active) {
          return;
        }

        if (payload.data.redirectHint === "success") {
          router.replace(`/pay/${publicToken}/success`);
          return;
        }

        if (payload.data.redirectHint === "issue") {
          router.replace(`/pay/${publicToken}/issue`);
          return;
        }

        timer = setTimeout(poll, 1250);
      } catch {
        if (!active) {
          return;
        }

        timer = setTimeout(poll, 2500);
      }
    };

    timer = setTimeout(poll, 800);

    return () => {
      active = false;
      if (timer) {
        clearTimeout(timer);
      }
    };
  }, [publicToken, router]);

  return null;
}
