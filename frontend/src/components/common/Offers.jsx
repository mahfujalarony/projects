import React, { useEffect, useMemo, useState } from "react";
import { Drawer, Grid, Modal } from "antd";
import { API_BASE_URL } from "../../config/env";
import { normalizeImageUrl } from "../../utils/imageUrl";
const { useBreakpoint } = Grid;

// same helper style as your Home component
const getFullImageUrl = (imgPath) => {
  return normalizeImageUrl(imgPath) || "/placeholder-product.jpg";
};

const Offers = () => {
  const screens = useBreakpoint();
  const isMobile = !screens.sm;
  const stripHtml = (html = "") =>
    String(html || "")
      .replace(/<[^>]*>/g, " ")
      .replace(/\s+/g, " ")
      .trim();

  useEffect(() => window.scrollTo(0, 0), []);

  // filters
  const [type, setType] = useState("carousel"); // carousel / banner / grid etc (your backend)
  const [activeCategory, setActiveCategory] = useState("All");
  const [q, setQ] = useState("");

  // data
  const [offers, setOffers] = useState([]);
  const [meta, setMeta] = useState({ page: 1, limit: 18, total: 0, totalPages: 1 });

  // ui states
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [selected, setSelected] = useState(null);

  // category list from fetched offers
  const categories = useMemo(() => {
    const set = new Set((offers || []).map((o) => o.category).filter(Boolean));
    return ["All", ...Array.from(set)];
  }, [offers]);

  const fetchOffers = async (page = 1) => {
    try {
      setLoading(true);
      setErr("");

      const params = new URLSearchParams();
      params.set("page", String(page));
      params.set("limit", String(meta.limit));
      if (type) params.set("type", type);
      if (activeCategory !== "All") params.set("category", activeCategory);
      if (q.trim()) params.set("q", q.trim());

      const res = await fetch(`${API_BASE_URL}/api/offers?${params.toString()}`);
      const data = await res.json();

      // expected: { success, offers, meta } or { success, offers, total... }
      if (!res.ok || !data?.success) {
        setOffers([]);
        setMeta((m) => ({ ...m, page: 1, total: 0, totalPages: 1 }));
        setErr(data?.message || "Offers load failed");
        return;
      }

      const list = Array.isArray(data.offers) ? data.offers : [];

      // meta fallback support
      const newMeta = data.meta
        ? {
            page: Number(data.meta.page || page),
            limit: Number(data.meta.limit || meta.limit),
            total: Number(data.meta.total || list.length),
            totalPages: Number(data.meta.totalPages || 1),
          }
        : {
            page: Number(data.page || page),
            limit: Number(data.limit || meta.limit),
            total: Number(data.total || list.length),
            totalPages: Number(data.totalPages || 1),
          };

      setOffers(list);
      setMeta(newMeta);
    } catch (e) {
      setOffers([]);
      setErr("Offers load failed");
    } finally {
      setLoading(false);
    }
  };

  // initial + filters change => reload page 1
  useEffect(() => {
    fetchOffers(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type, activeCategory]);

  // search submit
  const onSearch = (e) => {
    e.preventDefault();
    fetchOffers(1);
  };

  const canPrev = meta.page > 1;
  const canNext = meta.page < meta.totalPages;

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      <div className="mx-auto max-w-6xl px-4 py-8">


        {/* Filters */}
        <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          {/* Type */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-gray-600">Type</span>
            <select
              value={type}
              onChange={(e) => setType(e.target.value)}
              className="h-10 rounded-xl border border-gray-200 bg-white px-3 text-sm outline-none"
            >
              <option value="carousel">carousel</option>
              <option value="banner">banner</option>
            </select>
          </div>

          {/* Categories */}
          <div className="flex flex-wrap gap-2">
            {categories.map((c) => (
              <button
                key={c}
                onClick={() => setActiveCategory(c)}
                className={`rounded-full border px-4 py-2 text-xs font-medium transition sm:text-sm ${
                  activeCategory === c
                    ? "border-gray-300 bg-gray-900 text-white"
                    : "border-gray-200 bg-white hover:bg-gray-50"
                }`}
              >
                {c}
              </button>
            ))}
          </div>
        </div>

        {/* Error */}
        {err ? (
          <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            {err}
          </div>
        ) : null}

        {/* Grid */}
        <div className="mt-6">
          {loading ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 9 }).map((_, i) => (
                <div key={i} className="h-[240px] rounded-2xl border border-gray-200 bg-white animate-pulse" />
              ))}
            </div>
          ) : offers.length === 0 ? (
            <div className="rounded-2xl border border-gray-200 bg-white p-10 text-center">
              <div className="text-base font-semibold">No offers found</div>
              <div className="mt-1 text-sm text-gray-600">Try changing filters or search.</div>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {offers.map((o) => (
                <button
                  key={o.id}
                  onClick={() => setSelected(o)}
                  className="group overflow-hidden rounded-2xl border border-gray-200 bg-white text-left shadow-sm transition hover:shadow-md"
                >
                  <div className="relative">
                    <img
                      src={getFullImageUrl(o.imageUrl)}
                      alt={o.title || "Offer"}
                      className="h-52 w-full object-cover"
                      loading="lazy"
                    />
                    {o.tag ? (
                      <span className="absolute left-3 top-3 rounded-full bg-white/95 px-3 py-1 text-xs font-semibold text-gray-900 shadow">
                        {o.tag}
                      </span>
                    ) : null}
                  </div>

                  <div className="p-4">
                    <div className="text-base font-semibold line-clamp-1">{o.title || "Untitled Offer"}</div>
                    {o.description ? (
                      <div className="mt-1 text-sm text-gray-600 line-clamp-2">
                        {stripHtml(o.description)}
                      </div>
                    ) : null}

                    <div className="mt-3 flex items-center justify-between">
                      <span className="rounded-full bg-gray-100 px-3 py-1 text-xs text-gray-700">
                        {o.category || "General"}
                      </span>
                      <span className="text-xs text-gray-500 group-hover:text-gray-700">Preview →</span>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Pagination */}
        {!loading && offers.length > 0 ? (
          <div className="mt-8 flex items-center justify-between">
            <button
              disabled={!canPrev}
              onClick={() => fetchOffers(meta.page - 1)}
              className={`h-10 rounded-xl border px-4 text-sm font-medium ${
                canPrev
                  ? "border-gray-200 bg-white hover:bg-gray-50"
                  : "cursor-not-allowed border-gray-100 bg-gray-100 text-gray-400"
              }`}
            >
              ← Prev
            </button>

            <div className="text-sm text-gray-600">
              Page <span className="font-medium">{meta.page}</span> / {meta.totalPages}
            </div>

            <button
              disabled={!canNext}
              onClick={() => fetchOffers(meta.page + 1)}
              className={`h-10 rounded-xl border px-4 text-sm font-medium ${
                canNext
                  ? "border-gray-200 bg-white hover:bg-gray-50"
                  : "cursor-not-allowed border-gray-100 bg-gray-100 text-gray-400"
              }`}
            >
              Next →
            </button>
          </div>
        ) : null}
      </div>

      {/* Modal */}
      {false && selected && !isMobile ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4"
          onClick={() => setSelected(null)}
        >
          <div
            className="w-full max-w-3xl overflow-hidden bg-white shadow-xl rounded-t-2xl sm:rounded-2xl max-h-[92vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sm:hidden flex justify-center pt-2">
              <div className="h-1.5 w-12 rounded-full bg-gray-300" />
            </div>

            <div className="flex items-start justify-between gap-4 border-b border-gray-100 p-4 shrink-0">
              <div>
                <div className="text-lg font-semibold">{selected.title || "Offer"}</div>
                <div className="mt-2 flex flex-wrap gap-2">
                  <span className="rounded-full bg-gray-100 px-3 py-1 text-xs text-gray-700">
                    {selected.category || "General"}
                  </span>
                  {selected.tag ? (
                    <span className="rounded-full bg-gray-100 px-3 py-1 text-xs text-gray-700">
                      {selected.tag}
                    </span>
                  ) : null}
                  {selected.type ? (
                    <span className="rounded-full bg-gray-100 px-3 py-1 text-xs text-gray-700">
                      {selected.type}
                    </span>
                  ) : null}
                </div>
              </div>

              <button
                className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm hover:bg-gray-50"
                onClick={() => setSelected(null)}
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            <div className="overflow-y-auto">
            <div className="bg-gray-50 p-2">
              <img
                src={getFullImageUrl(selected.imageUrl)}
                alt={selected.title || "Offer"}
                className="max-h-[42vh] sm:max-h-[75vh] w-full rounded-xl object-contain"
              />
            </div>

            {selected.description ? (
              <div className="p-4 border-t border-gray-100">
                <div className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">
                  Description
                </div>
                <div
                  className="prose prose-sm max-w-none prose-p:my-2 prose-ul:my-2 prose-ol:my-2"
                  dangerouslySetInnerHTML={{ __html: selected.description }}
                />
              </div>
            ) : null}
            </div>
          </div>
        </div>
      ) : null}

      <Drawer
        open={!!selected}
        onClose={() => setSelected(null)}
        placement={isMobile ? "bottom" : "right"}
        height={isMobile ? "88vh" : undefined}
        width={isMobile ? undefined : 900}
        closable={false}
        title={null}
        styles={{ header: { display: "none" }, body: { padding: 0, overflow: "hidden" } }}
      >
        {selected ? (
          <div className="h-full flex flex-col bg-white">
            <div className="flex justify-center pt-2 pb-1 shrink-0">
              <div className="h-1.5 w-12 rounded-full bg-gray-300" />
            </div>

            <div className="flex items-start justify-between gap-4 border-b border-gray-100 p-4 shrink-0">
              <div>
                <div className="text-lg font-semibold">{selected.title || "Offer"}</div>
                <div className="mt-2 flex flex-wrap gap-2">
                  <span className="rounded-full bg-gray-100 px-3 py-1 text-xs text-gray-700">
                    {selected.category || "General"}
                  </span>
                  {selected.tag ? (
                    <span className="rounded-full bg-gray-100 px-3 py-1 text-xs text-gray-700">
                      {selected.tag}
                    </span>
                  ) : null}
                  {selected.type ? (
                    <span className="rounded-full bg-gray-100 px-3 py-1 text-xs text-gray-700">
                      {selected.type}
                    </span>
                  ) : null}
                </div>
              </div>

              <button
                className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm"
                onClick={() => setSelected(null)}
                aria-label="Close"
              >
                x
              </button>
            </div>

            <div className="overflow-y-auto">
              <div className="bg-gray-50 p-2">
                <img
                  src={getFullImageUrl(selected.imageUrl)}
                  alt={selected.title || "Offer"}
                  className="max-h-[42vh] w-full rounded-xl object-contain"
                />
              </div>

              {selected.description ? (
                <div className="p-4 border-t border-gray-100">
                  <div className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">
                    Description
                  </div>
                  <div
                    className="prose prose-sm max-w-none prose-p:my-2 prose-ul:my-2 prose-ol:my-2"
                    dangerouslySetInnerHTML={{ __html: selected.description }}
                  />
                </div>
              ) : null}
            </div>
          </div>
        ) : null}
      </Drawer>
    </div>
  );
};

export default Offers;
