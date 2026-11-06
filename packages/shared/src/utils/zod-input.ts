import { z } from "zod";

/** Sparse updates skip omitted values before evaluating a field's create-time default. */
export function partialInput<Shape extends z.ZodRawShape, Config extends z.core.$ZodObjectConfig>(
  schema: z.ZodObject<Shape, Config>,
) {
  const shape = Object.fromEntries(
    Object.entries(schema.shape).map(([key, field]) => [key, z.union([z.undefined(), field]).optional()]),
  ) as { [Key in keyof Shape]: z.ZodOptional<z.ZodUnion<[z.ZodUndefined, Shape[Key]]>> };
  return schema.partial().extend(shape);
}
