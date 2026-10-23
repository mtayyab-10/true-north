"use client";
import type { TypedEntry } from "@/lib/types";

const FIELD_LABELS: Record<string, string> = {
  vendor_name:    "Vendor / Shop Name",
  invoice_number: "Invoice / Bill #",
  date:           "Date",
  total_amount:   "Total Amount",
  quantity:       "Quantity (line 1)",
  unit_price:     "Unit Price (line 1)",
};

interface Props {
  entries: TypedEntry[];
  onChange: (entries: TypedEntry[]) => void;
}

export default function EntryTable({ entries, onChange }: Props) {
  const update = (id: string, value: string) => {
    onChange(entries.map((e) => (e.id === id ? { ...e, typed_value: value } : e)));
  };

  return (
    <div style={{ overflowX: "auto" }}>
      <table className="data-table">
        <thead>
          <tr>
            <th style={{ width: "40%" }}>Field</th>
            <th>Your Typed Value</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((entry) => (
            <tr key={entry.id}>
              <td style={{ color: "var(--text-secondary)", fontSize: "13px" }}>
                {FIELD_LABELS[entry.field] ?? entry.field}
              </td>
              <td>
                <input
                  className="table-input"
                  type="text"
                  value={entry.typed_value}
                  onChange={(e) => update(entry.id, e.target.value)}
                  placeholder="Enter value…"
                  id={`entry-${entry.field}`}
                  aria-label={`Typed value for ${FIELD_LABELS[entry.field] ?? entry.field}`}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p style={{ color: "var(--text-muted)", fontSize: "11px", marginTop: "10px" }}>
        Fill in the values you typed into your records, then compare against the document.
      </p>
    </div>
  );
}
