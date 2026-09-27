import mongoose, { Schema, model } from 'mongoose';

export const PAYMENT_STATUSES = ['PENDING', 'PAID', 'FAILED', 'REFUNDED', 'EXPIRED'] as const;
export type PaymentStatus = typeof PAYMENT_STATUSES[number];

export interface PurchaseDocument {
  _id: mongoose.Types.ObjectId;
  student: mongoose.Types.ObjectId;
  material: mongoose.Types.ObjectId;
  amount: number;
  currency: string;
  paymentStatus: PaymentStatus;
  transactionId?: string;
  purchaseDate?: Date;
  expiryDate?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const purchaseSchema = new Schema<PurchaseDocument>({
  student: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  material: { type: Schema.Types.ObjectId, ref: 'Material', required: true, index: true },
  amount: { type: Number, required: true, min: 0 },
  currency: { type: String, default: 'INR' },
  paymentStatus: { type: String, enum: PAYMENT_STATUSES, default: 'PENDING', index: true },
  transactionId: { type: String, trim: true },
  purchaseDate: Date,
  expiryDate: Date
}, { timestamps: true });
purchaseSchema.index({ student: 1, material: 1 }, { unique: true });

export const Purchase = model<PurchaseDocument>('Purchase', purchaseSchema);

