import { create } from "zustand";

export type HintId =
  | "tester"
  | "size"
  | "colors"
  | "share"
  | "search"
  | "categories"
  | "cards"
  | "theme"
  | "studio"
  | "tools"
  | "export"
  | "license"
  | "sources"
  | "agents";

export type GuideRoute = "catalog" | "font" | "agents" | "about";

export type Hint = {
  id: HintId;
  title: string;
  body: string;
};

export const HINTS: Record<HintId, Hint> = {
  tester: {
    id: "tester",
    title: "Type to test",
    body: "Anything you type here is set in every visible typeface. Click a face to keep editing that same line in the studio.",
  },
  size: {
    id: "size",
    title: "Preview size",
    body: "Shows up after you type. Drag to scale the live previews without stretching the page.",
  },
  colors: {
    id: "colors",
    title: "Paper and ink",
    body: "Paper is the background. Ink is the type. Both travel with you onto the font page and into the share card.",
  },
  share: {
    id: "share",
    title: "Share the composition",
    body: "Sends a review link with your type, size, and colors. We generate a 1200×630 preview card so chats and posts unfurl the actual specimen.",
  },
  search: {
    id: "search",
    title: "Search names",
    body: "Filter the catalog by typeface name. Combine it with a category on the left.",
  },
  categories: {
    id: "categories",
    title: "Look by category",
    body: "DaFont themes. Tap a group, then a substyle, to narrow the grid.",
  },
  cards: {
    id: "cards",
    title: "The faces",
    body: "Each card is a typeface. While a font loads, one of its characters spins instead of flashing a default face. Click through to the studio.",
  },
  theme: {
    id: "theme",
    title: "Light and dark",
    body: "Dark is the foundry default. Switch if you are matching a light layout.",
  },
  studio: {
    id: "studio",
    title: "The artboard",
    body: "This is the piece. Drag type, resize from the handles, or add another line with Type. The window never stretches the page.",
  },
  tools: {
    id: "tools",
    title: "Studio tools",
    body: "Select, Type, shapes, image, and hand to pan. Snap keeps edges honest. Paper, layer, type, and FX live in the inspector.",
  },
  export: {
    id: "export",
    title: "Share and export",
    body: "Share generates a social card from this composition. PNG, JPG, and SVG download the board.",
  },
  license: {
    id: "license",
    title: "Commercial use",
    body: "US$95 per face per agent, or US$65,000 for the entire catalog. Font files may not be resold. Typefaces may not be edited without permission.",
  },
  sources: {
    id: "sources",
    title: "Where it lives",
    body: "Every host that lists this face, with download counts, plus the zip and the designer page.",
  },
  agents: {
    id: "agents",
    title: "A foundry for agents",
    body: "MCP tools let an agent browse, preview, and pay with x402. Discovery is at /.well-known/mcp.json.",
  },
};

export const TOURS: Record<GuideRoute, HintId[]> = {
  catalog: ["tester", "colors", "share", "categories", "cards"],
  font: ["studio", "tools", "export", "license"],
  agents: ["agents", "license"],
  about: ["theme"],
};

const HINTS_KEY = "xf-hints";
const TOUR_KEY = "xf-tour-seen";

type GuideState = {
  hintsOn: boolean;
  tourRoute: GuideRoute | null;
  tourIndex: number | null;
  openHint: HintId | null;
  seenTour: Partial<Record<GuideRoute, boolean>>;
  hydrate: () => void;
  toggle: (route: GuideRoute) => void;
  next: () => void;
  back: () => void;
  skipTour: () => void;
  setOpenHint: (id: HintId | null) => void;
};

function readSeen(): Partial<Record<GuideRoute, boolean>> {
  try {
    const raw = localStorage.getItem(TOUR_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    return parsed && typeof parsed === "object" ? (parsed as Partial<Record<GuideRoute, boolean>>) : {};
  } catch {
    return {};
  }
}

function persistSeen(seen: Partial<Record<GuideRoute, boolean>>) {
  try {
    localStorage.setItem(TOUR_KEY, JSON.stringify(seen));
  } catch {
    /* private mode */
  }
}

export const useGuide = create<GuideState>((set, get) => ({
  hintsOn: false,
  tourRoute: null,
  tourIndex: null,
  openHint: null,
  seenTour: {},
  hydrate: () => {
    try {
      const hintsOn = localStorage.getItem(HINTS_KEY) === "on";
      set({ hintsOn, seenTour: readSeen() });
    } catch {
      /* private mode */
    }
  },
  toggle: (route) => {
    const { hintsOn, seenTour } = get();
    if (hintsOn) {
      try {
        localStorage.setItem(HINTS_KEY, "off");
      } catch {
        /* private mode */
      }
      set({ hintsOn: false, tourRoute: null, tourIndex: null, openHint: null });
      return;
    }
    try {
      localStorage.setItem(HINTS_KEY, "on");
    } catch {
      /* private mode */
    }
    const startTour = !seenTour[route] && TOURS[route].length > 0;
    set({
      hintsOn: true,
      openHint: null,
      tourRoute: startTour ? route : null,
      tourIndex: startTour ? 0 : null,
    });
  },
  next: () => {
    const { tourRoute, tourIndex, seenTour } = get();
    if (tourRoute == null || tourIndex == null) return;
    const steps = TOURS[tourRoute];
    if (tourIndex >= steps.length - 1) {
      const nextSeen = { ...seenTour, [tourRoute]: true };
      persistSeen(nextSeen);
      set({ tourRoute: null, tourIndex: null, seenTour: nextSeen, openHint: null });
      return;
    }
    set({ tourIndex: tourIndex + 1, openHint: null });
  },
  back: () => {
    const { tourIndex } = get();
    if (tourIndex == null || tourIndex <= 0) return;
    set({ tourIndex: tourIndex - 1, openHint: null });
  },
  skipTour: () => {
    const { tourRoute, seenTour } = get();
    const nextSeen = tourRoute ? { ...seenTour, [tourRoute]: true } : seenTour;
    persistSeen(nextSeen);
    set({ tourRoute: null, tourIndex: null, seenTour: nextSeen, openHint: null });
  },
  setOpenHint: (openHint) => set({ openHint }),
}));

export function guideRouteFromPath(pathname: string): GuideRoute {
  if (pathname.startsWith("/font/")) return "font";
  if (pathname.startsWith("/agents")) return "agents";
  if (pathname.startsWith("/about")) return "about";
  return "catalog";
}

export function currentTourStep(route: GuideRoute | null, index: number | null): Hint | null {
  if (route == null || index == null) return null;
  const id = TOURS[route][index];
  return id ? HINTS[id] : null;
}
