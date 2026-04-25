import { BadRequestException, Injectable } from "@nestjs/common";
import {
  AppChainPaymentObservation,
  AppInvoice,
  AppPayment,
  ConfirmationSource,
  PaymentStatus
} from "../storage/storage.service";

type ProcessingTransition = {
  changed: boolean;
  fromStatus: PaymentStatus;
  toStatus: PaymentStatus;
};

type FinalizeInput = {
  payment: AppPayment;
  invoice: AppInvoice;
  observation: AppChainPaymentObservation | null;
  now: string;
  confirmationSource: Exclude<ConfirmationSource, null>;
  settlementReference: string;
  confirmationTxHash?: string;
  confirmationBlockNumber?: number;
  sourceConfirmedAt?: string;
};

type FailInput = {
  payment: AppPayment;
  invoice: AppInvoice;
  observation: AppChainPaymentObservation | null;
  now: string;
  failureSource: Exclude<ConfirmationSource, null>;
  failureReason: string;
  confirmationTxHash?: string;
  confirmationBlockNumber?: number;
  sourceConfirmedAt?: string;
};

@Injectable()
export class PaymentConfirmationService {
  startProcessing(input: {
    payment: AppPayment;
    invoice: AppInvoice;
    observation: AppChainPaymentObservation | null;
    now: string;
  }): ProcessingTransition {
    if (input.payment.status === "processing") {
      return {
        changed: false,
        fromStatus: input.payment.status,
        toStatus: input.payment.status
      };
    }

    if (input.payment.status !== "pending") {
      throw new BadRequestException(
        `Only pending payments can move to processing. Current status: ${input.payment.status}.`
      );
    }

    input.payment.status = "processing";
    input.payment.processingStartedAt = input.now;
    input.payment.updatedAt = input.now;
    input.invoice.status = "processing";
    input.invoice.updatedAt = input.now;

    if (input.observation) {
      input.observation.status = "matched";
      input.observation.updatedAt = input.now;
    }

    return {
      changed: true,
      fromStatus: "pending",
      toStatus: "processing"
    };
  }

  finalize(input: FinalizeInput) {
    if (input.payment.status === "failed") {
      throw new BadRequestException("Failed payments cannot be finalized.");
    }

    if (input.payment.status === "finalized") {
      return {
        changed: false,
        fromStatus: input.payment.status,
        toStatus: input.payment.status,
        processingTransition: null
      };
    }

    let processingTransition: ProcessingTransition | null = null;
    if (input.payment.status === "pending") {
      processingTransition = this.startProcessing({
        payment: input.payment,
        invoice: input.invoice,
        observation: input.observation,
        now: input.now
      });
    }

    const fromStatus = input.payment.status;
    input.payment.status = "finalized";
    input.payment.settlementReference = input.settlementReference;
    input.payment.confirmationSource = input.confirmationSource;
    input.payment.txHash = input.confirmationTxHash ?? input.payment.txHash;
    input.payment.blockNumber =
      input.confirmationBlockNumber ?? input.payment.blockNumber;
    input.payment.confirmationTxHash =
      input.confirmationTxHash ?? input.payment.confirmationTxHash;
    input.payment.confirmationBlockNumber =
      input.confirmationBlockNumber ?? input.payment.confirmationBlockNumber;
    input.payment.sourceConfirmedAt =
      input.sourceConfirmedAt ??
      input.observation?.sourceConfirmedAt ??
      input.payment.sourceConfirmedAt;
    input.payment.confirmationReceivedAt = input.now;
    input.payment.confirmedAt = input.now;
    input.payment.failureReason = null;
    input.payment.finalizedAt = input.now;
    input.payment.updatedAt = input.now;
    input.invoice.status = "paid";
    input.invoice.updatedAt = input.now;

    if (input.observation) {
      input.observation.status = "confirmed";
      input.observation.confirmedAt = input.now;
      input.observation.updatedAt = input.now;
    }

    return {
      changed: true,
      fromStatus,
      toStatus: input.payment.status,
      processingTransition
    };
  }

  fail(input: FailInput) {
    if (input.payment.status === "finalized") {
      throw new BadRequestException("Finalized payments cannot be marked failed.");
    }

    if (input.payment.status === "failed") {
      return {
        changed: false,
        fromStatus: input.payment.status,
        toStatus: input.payment.status,
        processingTransition: null
      };
    }

    let processingTransition: ProcessingTransition | null = null;
    if (input.payment.status === "pending") {
      processingTransition = this.startProcessing({
        payment: input.payment,
        invoice: input.invoice,
        observation: input.observation,
        now: input.now
      });
    }

    const fromStatus = input.payment.status;
    input.payment.status = "failed";
    input.payment.failureReason = input.failureReason;
    input.payment.confirmationSource = input.failureSource;
    input.payment.txHash = input.confirmationTxHash ?? input.payment.txHash;
    input.payment.blockNumber =
      input.confirmationBlockNumber ?? input.payment.blockNumber;
    input.payment.confirmationTxHash =
      input.confirmationTxHash ?? input.payment.confirmationTxHash;
    input.payment.confirmationBlockNumber =
      input.confirmationBlockNumber ?? input.payment.confirmationBlockNumber;
    input.payment.sourceConfirmedAt =
      input.sourceConfirmedAt ??
      input.observation?.sourceConfirmedAt ??
      input.payment.sourceConfirmedAt;
    input.payment.confirmationReceivedAt = input.now;
    input.payment.confirmedAt = input.now;
    input.payment.settlementReference = null;
    input.payment.finalizedAt = null;
    input.payment.updatedAt = input.now;
    input.invoice.status = input.invoice.publishedAt ? "open" : "draft";
    input.invoice.updatedAt = input.now;

    if (input.observation) {
      input.observation.status = "rejected";
      input.observation.updatedAt = input.now;
    }

    return {
      changed: true,
      fromStatus,
      toStatus: input.payment.status,
      processingTransition
    };
  }
}
