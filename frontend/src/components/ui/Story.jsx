import React, { useMemo, useState } from "react";
import StoryViewer from "./StoryViewer";
import { normalizeImageUrl } from "../../utils/imageUrl";

const clean = (u) => (u ? String(u).replace(/\\/g, "/") : "");
const isVisible = (s) => {
  if (!s) return false;
  if (s.isActive !== undefined && !s.isActive) return false;
  if (!s.expiresAt) return true;
  const expiry = new Date(s.expiresAt).getTime();
  if (!Number.isFinite(expiry)) return true;
  return expiry > Date.now();
};

export default function Story({ stories = [], loading = false }) {
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);

  // ✅ backend stories -> UI items
  const items = useMemo(() => {
    return (Array.isArray(stories) ? stories : []).filter(isVisible).map((s, idx) => {
      const merchant = s?.merchant || {};
      const user = merchant?.user || {};

      let rawMedia = s?.mediaUrls;
      if (typeof rawMedia === "string") {
        try {
          rawMedia = JSON.parse(rawMedia);
        } catch {
          rawMedia = [];
        }
      }
      const media = Array.isArray(rawMedia)
        ? rawMedia.map((u) => normalizeImageUrl(clean(u))).filter(Boolean)
        : [];
      const cover = media[0] || "";

      return {
        key: s?.id ?? idx,
        storyId: s?.id ?? idx,
        title: s?.title || null,
        productId: Number(s?.productId || 0) || null,

        mediaUrls: media,

        merchantId: merchant?.id || null,
        merchantName: user?.name || "Seller",
        merchantAvatar: normalizeImageUrl(clean(user?.imageUrl)) || "",
        cover: cover || normalizeImageUrl(clean(user?.imageUrl)) || "/placeholder-product.jpg",
      };
    });
  }, [stories]);

  const onOpen = (idx) => {
    setActiveIndex(idx);
    setOpen(true);
  };

  if (!loading && items.length === 0) return null;

  return (
    <>
      <div className="px-4 md:px-6">
        {loading ? (
          <div className="flex gap-3 md:gap-4 overflow-x-auto scrollbar-hide pb-2">
            {Array.from({ length: 8 }).map((_, i) => (
              <div 
                key={i} 
                className="flex flex-col items-start w-[42vw] max-w-[170px] sm:w-[180px] md:w-[200px] lg:w-[220px] flex-shrink-0"
                style={{ animation: `skeletonFadeIn 0.4s ease-out ${i * 70}ms both` }}
              >
                <div className="shimmer-block w-full aspect-[9/16] rounded-2xl border border-white/60 shadow-sm" />
                <div className="shimmer-block mt-2 h-3 md:h-3.5 w-2/3 rounded-full" />
              </div>
            ))}
          </div>
        ) : (
          <div className="flex gap-3 md:gap-4 overflow-x-auto scrollbar-hide pb-2">
            {items.map((s, idx) => (
              <button
                key={s.key}
                type="button"
                onClick={() => onOpen(idx)}
                className="flex flex-col items-start w-[42vw] max-w-[170px] sm:w-[180px] md:w-[200px] lg:w-[220px] flex-shrink-0 group"
                title={s.merchantName}
              >
                <div className="w-full aspect-[9/16] rounded-2xl overflow-hidden bg-gray-100 border border-white shadow-sm">
                  <img
                    src={s.cover}
                    alt={s.merchantName}
                    loading="lazy"
                    decoding="async"
                    className="w-full h-full object-cover group-hover:scale-[1.04] transition-transform"
                    draggable={false}
                  />
                </div>

                <span className="mt-1 text-xs md:text-sm font-medium text-gray-700 w-full truncate text-left">
                  {s.merchantName}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      <StoryViewer
        open={open}
        onClose={() => setOpen(false)}
        stories={items}
        startIndex={activeIndex}
      />
    </>
  );
}
