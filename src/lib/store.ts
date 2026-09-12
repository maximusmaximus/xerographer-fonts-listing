import { create } from "zustand";

export type SortKey = "popular" | "name" | "recent";

type ExplorerState = {
  previewText: string;
  previewSize: number;
  previewFg: string;
  previewBg: string;
  query: string;
  category: string | null;
  subcategory: string | null;
  sort: SortKey;
  setPreviewText: (value: string) => void;
  setPreviewSize: (value: number) => void;
  setPreviewFg: (value: string) => void;
  setPreviewBg: (value: string) => void;
  setQuery: (value: string) => void;
  setCategory: (category: string | null, subcategory?: string | null) => void;
  setSort: (value: SortKey) => void;
};

export const useExplorer = create<ExplorerState>((set) => ({
  previewText: "",
  previewSize: 64,
  previewFg: "#f2efe6",
  previewBg: "#121212",
  query: "",
  category: null,
  subcategory: null,
  sort: "popular",
  setPreviewText: (previewText) => set({ previewText }),
  setPreviewSize: (previewSize) => set({ previewSize }),
  setPreviewFg: (previewFg) => set({ previewFg }),
  setPreviewBg: (previewBg) => set({ previewBg }),
  setQuery: (query) => set({ query }),
  setCategory: (category, subcategory = null) => set({ category, subcategory }),
  setSort: (sort) => set({ sort }),
}));
