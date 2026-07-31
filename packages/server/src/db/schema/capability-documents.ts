// Schema: Package-owned reusable JSON documents
import { integer, fileTable, text } from "../file-schema.js";

export const capabilityDocuments = fileTable("capability_documents", {
  id: text("id").primaryKey(),
  packageId: text("package_id").notNull(),
  kind: text("kind").notNull(),
  name: text("name").notNull(),
  description: text("description").notNull().default(""),
  data: text("data").notNull(),
  revision: integer("revision").notNull().default(1),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});
