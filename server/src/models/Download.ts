import mongoose, { Schema, model } from 'mongoose';

export interface DownloadDocument {
  _id: mongoose.Types.ObjectId;
  material: mongoose.Types.ObjectId;
  user: mongoose.Types.ObjectId;
  downloadedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const downloadSchema = new Schema<DownloadDocument>({
  material: { type: Schema.Types.ObjectId, ref: 'Material', required: true, index: true },
  user: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  downloadedAt: { type: Date, default: Date.now, index: true }
}, { timestamps: true });
downloadSchema.index({ material: 1, user: 1, downloadedAt: -1 });

export const Download = model<DownloadDocument>('Download', downloadSchema);

