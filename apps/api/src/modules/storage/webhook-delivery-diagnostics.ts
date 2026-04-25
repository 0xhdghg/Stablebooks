type DeliveryStatus = "disabled" | "delivered" | "failed" | "dead_letter";

type DeliveryDiagnosticInput = {
  status: DeliveryStatus;
  destination?: string | null;
  responseStatus?: number | null;
  errorMessage?: string | null;
  attemptCount: number;
  maxAttempts: number;
  nextAttemptAt?: string | Date | null;
  deliveredAt?: string | Date | null;
  deadLetteredAt?: string | Date | null;
};

export function buildWebhookDeliveryDiagnostic(input: DeliveryDiagnosticInput) {
  if (input.status === "delivered") {
    return {
      severity: "success" as const,
      label: "Delivered",
      detail: input.deliveredAt
        ? `Webhook delivered successfully at ${toIso(input.deliveredAt)}.`
        : "Webhook delivered successfully.",
      nextAction: null
    };
  }

  if (input.status === "disabled") {
    return {
      severity: "warning" as const,
      label: "No destination configured",
      detail:
        "Stablebooks skipped this delivery because no webhook destination is configured.",
      nextAction:
        "Configure STABLEBOOKS_WEBHOOK_URL or a merchant endpoint, then retry or replay the delivery."
    };
  }

  if (input.status === "dead_letter") {
    return {
      severity: "critical" as const,
      label: "Moved to dead-letter",
      detail: buildFailureDetail(input, "The delivery exhausted retry attempts."),
      nextAction:
        "Fix the destination endpoint, then manually replay the payment event or retry this delivery."
    };
  }

  return {
    severity: "warning" as const,
    label: "Retry scheduled",
    detail: buildFailureDetail(input, "The delivery failed and is waiting for retry."),
    nextAction: input.nextAttemptAt
      ? `Next retry is scheduled for ${toIso(input.nextAttemptAt)}. Fix the endpoint before then or retry manually.`
      : "Fix the endpoint, then retry this delivery manually."
  };
}

function buildFailureDetail(input: DeliveryDiagnosticInput, prefix: string) {
  const reason = input.responseStatus
    ? `Endpoint returned HTTP ${input.responseStatus}.`
    : input.errorMessage
      ? input.errorMessage
      : "No response details were recorded.";

  return `${prefix} ${reason} Attempts: ${input.attemptCount}/${input.maxAttempts}.`;
}

function toIso(value: string | Date) {
  return value instanceof Date ? value.toISOString() : value;
}
