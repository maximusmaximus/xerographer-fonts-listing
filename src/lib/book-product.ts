import { createServerFn } from "@tanstack/react-start";
import type { BookProduct } from "./product";

export const loadBookProduct = createServerFn({ method: "GET" }).handler(async (): Promise<BookProduct> => {
  const { getBookProduct } = await import("./product.server");
  return getBookProduct();
});
