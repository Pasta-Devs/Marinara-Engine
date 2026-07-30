type Row = Record<string, unknown>;

/** Collapse legacy NoodleR access values before post rows reach the fail-closed normalizer. */
export function migrateLegacyNoodlePostAccessRow(row: Row): Row {
  const access = row.access === "public" ? "public" : "locked";
  const hasLegacyPrice = "ppvPrice" in row || "ppv_price" in row;
  if (row.access === access && !hasLegacyPrice) return row;

  const migrated: Row = { ...row, access };
  delete migrated.ppvPrice;
  delete migrated.ppv_price;
  return migrated;
}
