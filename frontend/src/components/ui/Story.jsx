import React, { useMemo, useState } from "react";
import { Skeleton, Empty } from "antd";
import StoryViewer from "./StoryViewer";

const clean = (u) => (u ? String(u).replace(/\\/g, "/") : "");

export default function Story({ stories = [], loading = false }) {
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);

  // ✅ backend stories -> UI items
  const items = useMemo(() => {
    return (Array.isArray(stories) ? stories : []).map((s, idx) => {
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
      const media = Array.isArray(rawMedia) ? rawMedia.map(clean).filter(Boolean) : [];
      const cover = media[0] || "";

      return {
        key: s?.id ?? idx,
        storyId: s?.id ?? idx,
        title: s?.title || null,

        mediaUrls: media,

        merchantId: merchant?.id || null,
        merchantName: user?.name || "Seller",
        merchantAvatar: clean(user?.imageUrl) || "",
        cover: cover || clean(user?.imageUrl) || "/placeholder-product.jpg",
      };
    });
  }, [stories]);

  const onOpen = (idx) => {
    setActiveIndex(idx);
    setOpen(true);
  };

  return (
    <>
      <div className="px-4 md:px-6">
        {loading ? (
          <div className="flex gap-3 overflow-x-auto pb-2">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="min-w-[68px]">
                <Skeleton.Avatar active size={56} shape="circle" />
              </div>
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="py-2">
            <Empty description="No stories" />
          </div>
        ) : (
          <div className="flex gap-3 overflow-x-auto scrollbar-hide pb-2">
            {items.map((s, idx) => (
              <button
                key={s.key}
                type="button"
                onClick={() => onOpen(idx)}
                className="flex flex-col items-center min-w-[68px] group"
                title={s.merchantName}
              >
                {/* ring */}
                <div className="p-[2px] rounded-full bg-gradient-to-tr from-pink-500 via-rose-500 to-yellow-400">
                  <div className="bg-white p-[2px] rounded-full">
                    <div className="w-14 h-14 rounded-full overflow-hidden bg-gray-100">
                      <img
                        src={s.cover}
                        alt={s.merchantName}
                        className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform"
                        draggable={false}
                      />
                    </div>
                  </div>
                </div>

                {/* ✅ merchant name */}
                <span className="mt-1 text-[11px] text-gray-600 max-w-[64px] truncate">
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
