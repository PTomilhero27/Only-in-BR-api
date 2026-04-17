import {
  MarketplaceReservationStatus,
  MarketplaceSlotStatus,
  OwnerFairPaymentStatus,
  OwnerFairStatus,
} from '@prisma/client';

export type MarketplaceReservationConfirmationSource =
  | 'ADMIN_PANEL'
  | 'PAYMENT_GATEWAY'
  | 'SYSTEM';

export type MarketplaceReservationInstallmentInput = {
  number: number;
  dueDate: string;
  amountCents: number;
  paidAt?: string | null;
  paidAmountCents?: number | null;
};

export type MarketplaceReservationPaymentApprovalInput = {
  approved: boolean;
  approvedAt?: Date | null;
  approvalReference?: string | null;
  provider?: string | null;
  metadata?: Record<string, unknown> | null;
};

export type MarketplaceReservationPaymentInput = {
  unitPriceCents?: number;
  paidCents?: number;
  installmentsCount?: number;
  installments?: MarketplaceReservationInstallmentInput[];
  approval: MarketplaceReservationPaymentApprovalInput;
};

export type MarketplaceReservationBindingInput = {
  stallId?: string | null;
};

export type MarketplaceReservationConfirmationInput = {
  reservationId: string;
  actorUserId: string;
  source: MarketplaceReservationConfirmationSource;
  payment: MarketplaceReservationPaymentInput;
  binding?: MarketplaceReservationBindingInput;
};

export type MarketplaceReservationConfirmationResult = {
  ok: true;
  reservationId: string;
  reservationStatus: MarketplaceReservationStatus;
  fairId: string;
  ownerId: string;
  ownerFairId: string | null;
  ownerFairStatus: OwnerFairStatus | null;
  purchaseId: string | null;
  paymentStatus: OwnerFairPaymentStatus | null;
  stallFairId: string | null;
  createdOwnerFair: boolean;
  createdPurchase: boolean;
  createdStallFair: boolean;
  slotStatus: MarketplaceSlotStatus;
  source: MarketplaceReservationConfirmationSource;
};
