import React, { useEffect, useMemo, useRef, useState } from "react";
import { Modal } from "antd";
import { useNavigate } from "react-router-dom";
import { X, ChevronLeft, ChevronRight } from "lucide-react";

const clamp = (n, a, b) => Math.max(a, Math.min(b, n));

export default function StoryViewer({
  open,
  onClose,
  stories = [],
  startIndex = 0,
  durationMs = 4500,
}) {
  const navigate = useNavigate();

  const safeStories = useMemo(() => (Array.isArray(stories) ? stories : []), [stories]);
  const totalStories = safeStories.length;

  const [storyIdx, setStoryIdx] = useState(startIndex);
  const [slideIdx, setSlideIdx] = useState(0);

  const [progress, setProgress] = useState(0);
  const [paused, setPaused] = useState(false);

  const rafRef = useRef(null);
  const startTsRef = useRef(0);
  const baseProgressRef = useRef(0);

  const activeStory = safeStories[storyIdx];
  const slides = Array.isArray(activeStory?.mediaUrls) ? activeStory.mediaUrls : [];
  const totalSlides = slides.length;
  const activeSlide = slides[slideIdx];

  // reset when open
  useEffect(() => {
    if (!open) return;
    const next = clamp(Number(startIndex || 0), 0, Math.max(0, totalStories - 1));
    setStoryIdx(next);
    setSlideIdx(0);
    setProgress(0);
    setPaused(false);
    baseProgressRef.current = 0;
    startTsRef.current = performance.now();
  }, [open, startIndex, totalStories]);

  const resetProgress = () => {
    setProgress(0);
    baseProgressRef.current = 0;
    startTsRef.current = performance.now();
  };

  const goNext = () => {
    if (slideIdx < totalSlides - 1) {
      setSlideIdx((p) => p + 1);
    } else {
      if (storyIdx >= totalStories - 1) {
        onClose?.();
        return;
      }
      setStoryIdx((p) => p + 1);
      setSlideIdx(0);
    }
    resetProgress();
  };

  const goPrev = () => {
    if (slideIdx > 0) {
      setSlideIdx((p) => p - 1);
    } else {
      if (storyIdx <= 0) return;
      setStoryIdx((p) => p - 1);
      setSlideIdx(0);
    }
    resetProgress();
  };

  // autoplay
  useEffect(() => {
    if (!open || totalStories === 0) return;

    const tick = (ts) => {
      if (!open) return;

      if (!paused) {
        const elapsed = ts - (startTsRef.current || ts);
        const inc = elapsed / durationMs;
        const nextP = clamp(baseProgressRef.current + inc, 0, 1);

        setProgress(nextP);

        if (nextP >= 1) {
          startTsRef.current = ts;
          baseProgressRef.current = 0;
          setProgress(0);
          setTimeout(() => goNext(), 0);
          return;
        }
      } else {
        startTsRef.current = ts;
      }

      rafRef.current = requestAnimationFrame(tick);
    };

    startTsRef.current = performance.now();
    rafRef.current = requestAnimationFrame(tick);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, paused, storyIdx, slideIdx, totalStories, totalSlides]);

  const holdStart = () => {
    setPaused(true);
    baseProgressRef.current = progress;
    startTsRef.current = performance.now();
  };
  const holdEnd = () => {
    setPaused(false);
    baseProgressRef.current = progress;
    startTsRef.current = performance.now();
  };

  // ✅ prevent tap navigation when clicking on buttons/links
  const shouldIgnoreTap = (target) => {
    if (!target) return false;
    return (
      !!target.closest?.("button") ||
      !!target.closest?.("[data-ignore-tap='true']") ||
      !!target.closest?.("a")
    );
  };

  const handleTap = (e) => {
    if (shouldIgnoreTap(e.target)) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const clientX = e.touches?.[0]?.clientX ?? e.clientX;
    const x = clientX - rect.left;

    if (x < rect.width * 0.35) goPrev();
    else goNext();
  };

  // ✅ merchant name click -> seller page
  const onMerchantClick = (e) => {
    e?.stopPropagation?.();
    const mid = activeStory?.merchantId;
    if (!mid) return;
    onClose?.();
    navigate(`/saller/${mid}`);
  };

  // progress bars per slide
  const bars = Array.from({ length: Math.max(totalSlides, 1) }).map((_, i) => {
    const filled = i < slideIdx ? 1 : i > slideIdx ? 0 : progress;
    return { i, filled };
  });

  const isFirst = storyIdx <= 0 && slideIdx <= 0;

  return (
    <Modal
      open={open}
      onCancel={onClose}
      footer={null}
      centered
      width="100%"
      closable={false}
      destroyOnClose
      styles={{
        content: { padding: 0, background: "transparent", boxShadow: "none" },
        body: { padding: 0, height: "100vh", overflow: "hidden" },
        mask: { background: "rgba(0,0,0,0.95)", backdropFilter: "blur(15px)" },
      }}
      style={{ top: 0, margin: 0, maxWidth: "100vw", padding: 0 }}
    >
      {/* ✅ Responsive outer container */}
      <div className="w-full h-[100dvh] flex items-center justify-center relative">
        
        {/* Desktop Close Button (Outside) */}
        <button 
          onClick={onClose}
          className="absolute top-6 right-6 z-[100] text-white/70 hover:text-white transition hidden md:flex items-center justify-center w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 backdrop-blur-md"
        >
          <X size={24} />
        </button>

        {/* Desktop Previous Arrow (Outside) */}
        {!isFirst && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              goPrev();
            }}
            className="hidden md:flex absolute left-4 lg:left-12 z-50 p-4 rounded-full bg-white/10 hover:bg-white/20 backdrop-blur-md text-white transition hover:scale-110"
          >
            <ChevronLeft size={32} />
          </button>
        )}

        {/* ✅ Responsive frame */}
        <div className="relative w-full h-full md:w-auto md:h-[85vh] md:aspect-[9/16] md:max-h-[900px] md:rounded-2xl overflow-hidden bg-black shadow-2xl ring-1 ring-white/10 mx-auto">
          {/* bars + header */}
          <div className="absolute top-0 left-0 right-0 z-20 px-3 pt-[max(12px,env(safe-area-inset-top))] md:pt-4 bg-gradient-to-b from-black/80 via-black/40 to-transparent pb-12">
            <div className="flex gap-1.5 h-1">
              {bars.map((b) => (
                <div key={b.i} className="h-full flex-1 rounded-full bg-white/30 overflow-hidden">
                  <div
                    className="h-full bg-white rounded-full transition-all duration-100 ease-linear"
                    style={{ width: `${Math.floor(b.filled * 100)}%` }}
                  />
                </div>
              ))}
            </div>

            <div className="mt-3 flex items-center justify-between">
              {/* Merchant Info */}
              <button
                type="button"
                onClick={onMerchantClick}
                className="flex items-center gap-3 min-w-0 text-left group"
                title="Go to seller"
                data-ignore-tap="true"
              >
                <div className="w-9 h-9 rounded-full overflow-hidden border border-white/20">
                  {activeStory?.merchantAvatar ? (
                    <img
                      src={activeStory.merchantAvatar}
                      alt={activeStory.merchantName}
                      className="w-full h-full object-cover"
                      draggable={false}
                    />
                  ) : <div className="w-full h-full bg-gray-700" />}
                </div>
                <div className="min-w-0">
                  <div className="text-white text-sm font-semibold truncate drop-shadow-md">
                    {activeStory?.merchantName || "Seller"}
                  </div>
                  <div className="text-white/70 text-[10px] font-medium">{paused ? "Paused" : "Sponsored"}</div>
                </div>
              </button>

              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onClose?.();
                }}
                className="md:hidden text-white/80 hover:text-white p-2 -mr-2"
                aria-label="Close"
                data-ignore-tap="true"
              >
                <X size={24} />
              </button>
            </div>
          </div>

          {/* slide image */}
          <div
            className="absolute inset-0 z-10 bg-gray-900"
            onMouseDown={holdStart}
            onMouseUp={holdEnd}
            onMouseLeave={holdEnd}
            onTouchStart={holdStart}
            onTouchEnd={holdEnd}
            onClick={handleTap}
            onTouchMove={() => {}}
            style={{
              userSelect: "none",
              WebkitUserSelect: "none",
              touchAction: "manipulation",
            }}
          >
            {activeSlide ? (
              <img src={activeSlide} alt="story" className="w-full h-full object-cover" draggable={false} />
            ) : (
              <div className="w-full h-full grid place-items-center text-white/50">
                <span className="text-xs">No media</span>
              </div>
            )}
            <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-black/60 to-transparent pointer-events-none" />
          </div>

          {/* ✅ Mobile hint area */}
          <div className="absolute bottom-0 left-0 right-0 z-20 px-4 pb-[max(14px,env(safe-area-inset-bottom))] md:hidden pointer-events-none">
            <div className="text-center text-white/50 text-[10px]">
              Tap left/right to navigate • Hold to pause
            </div>
          </div>

        </div>

        {/* Desktop Next Arrow (Outside) */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            goNext();
          }}
          className="hidden md:flex absolute right-4 lg:right-12 z-50 p-4 rounded-full bg-white/10 hover:bg-white/20 backdrop-blur-md text-white transition hover:scale-110"
        >
          <ChevronRight size={32} />
        </button>
      </div>
    </Modal>
  );
}
