import mongoose from 'mongoose';

const leadSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, trim: true, lowercase: true, unique: true },
    phone: { type: String, required: true, trim: true },
    service: { type: String, required: true, trim: true },
    budgetRange: { type: String, required: true, trim: true },
    message: { type: String, required: true, trim: true },
    leadScore: { type: Number, required: true, min: 0, max: 100, index: true },
    status: {
      type: String,
      enum: ['new', 'contacted', 'qualified', 'won', 'lost'],
      default: 'new',
      index: true,
    },
    source: { type: String, enum: ['wordpress', 'manual'], default: 'wordpress' },
  },
  {
    timestamps: true,
    versionKey: false,
    toJSON: {
      transform(_doc, value) {
        value.id = value._id.toString();
        delete value._id;
        delete value.updatedAt;
        return value;
      },
    },
  }
);

leadSchema.index({ createdAt: -1 });

export default mongoose.model('Lead', leadSchema);
