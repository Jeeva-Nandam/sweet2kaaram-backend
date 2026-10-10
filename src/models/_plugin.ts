import { Schema } from 'mongoose';

/** Return `id` instead of `_id`/`__v` in JSON responses. */
export function cleanJson(schema: Schema) {
  schema.set('toJSON', {
    virtuals: true,
    versionKey: false,
    transform: (_doc, ret: Record<string, any>) => {
      ret.id = String(ret._id);
      delete ret._id;
      return ret;
    },
  });
}
