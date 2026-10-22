import { getSql } from "./db";
import { BOOK_PRODUCT_DEFAULTS, type BookProduct } from "./product";

type Row = {
  title: string;
  specs: string;
  description: string;
  price_label: string;
  price_note: string;
  listed: boolean;
};

export async function getBookProduct(): Promise<BookProduct> {
  try {
    const sql = await getSql();
    const rows = await sql.query<Row>("select title, specs, description, price_label, price_note, listed from site_products where id = $1", [
      "specimen-ledger",
    ]);
    const row = rows[0];
    if (!row) return BOOK_PRODUCT_DEFAULTS;
    return {
      title: row.title,
      specs: row.specs,
      description: row.description,
      priceLabel: row.price_label,
      priceNote: row.price_note,
      listed: row.listed,
    };
  } catch {
    return BOOK_PRODUCT_DEFAULTS;
  }
}

export async function saveBookProduct(product: BookProduct): Promise<void> {
  const sql = await getSql();
  await sql.query(
    `insert into site_products (id, title, specs, description, price_label, price_note, listed, updated_at)
     values ('specimen-ledger', $1, $2, $3, $4, $5, $6, now())
     on conflict (id) do update set
       title = excluded.title,
       specs = excluded.specs,
       description = excluded.description,
       price_label = excluded.price_label,
       price_note = excluded.price_note,
       listed = excluded.listed,
       updated_at = now()`,
    [product.title, product.specs, product.description, product.priceLabel, product.priceNote, product.listed],
  );
}
