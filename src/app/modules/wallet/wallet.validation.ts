import { z } from "zod";

const depositValidation = z.object({
  amount: z
    .number({ message: "Amount is required" })
    .min(5, "Minimum deposit is €5")
    .max(10000, "Maximum deposit is €10,000 per transaction"),
});

const paypalCaptureValidation = z.object({
  orderId: z.string({ message: "orderId is required" }),
});

const withdrawalRequestValidation = z
  .object({
    amount: z
      .number({ message: "Amount is required" })
      .min(10, "Minimum withdrawal is €10"),
    method: z.enum(["PayPal", "BankTransfer"], {
      message: "method must be PayPal or BankTransfer",
    }),
    paymentDetails: z.object({
      email: z.string().email().optional(),
      iban: z.string().optional(),
      accountHolderName: z.string().optional(),
    }),
  })
  .superRefine((data, ctx) => {
    if (data.method === "PayPal" && !data.paymentDetails.email) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "A valid PayPal email is required",
        path: ["paymentDetails", "email"],
      });
    }

    if (data.method === "BankTransfer") {
      if (!data.paymentDetails.iban) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "IBAN is required",
          path: ["paymentDetails", "iban"],
        });
      }
      if (!data.paymentDetails.accountHolderName) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Account holder name is required",
          path: ["paymentDetails", "accountHolderName"],
        });
      }
    }
  });

const withdrawalRejectValidation = z.object({
  reason: z.string().min(5, "A rejection reason is required"),
});

const adjustBalanceValidation = z.object({
  direction: z.enum(["Credit", "Debit"], {
    message: "direction must be Credit or Debit",
  }),
  amount: z
    .number({ message: "Amount is required" })
    .positive("Amount must be greater than 0"),
  reason: z.string().min(5, "A reason is required for manual adjustments"),
});

export const walletValidation = {
  depositValidation,
  paypalCaptureValidation,
  withdrawalRequestValidation,
  withdrawalRejectValidation,
  adjustBalanceValidation,
};
