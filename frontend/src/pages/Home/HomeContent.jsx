import React, { useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button, Alert, Grid, Carousel, message, Modal, Drawer } from "antd";
import { ShoppingCartOutlined, LeftOutlined, RightOutlined } from "@ant-design/icons";
import { useQuery } from "@tanstack/react-query";
import Footer from "./../../components/common/Footer";
import { useDispatch } from "react-redux";
import { addToCart } from "../../redux/cartSlice";
import ProductCard from "../../components/common/ProductCart";
import Story from "../../components/ui/Story";
import { API_BASE_URL } from "../../config/env";
import { MoveRight } from "lucide-react";
import { normalizeImageUrl } from "../../utils/imageUrl";
import { canAddToCart } from "../../utils/cartAddGuard";
import { animateAddToCart, bumpCartBadge } from "../../utils/cartAnimation";
const { useBreakpoint } = Grid;
const HOME_CACHE_TTL = 1000 * 60 * 15;

const SHIMMER_CSS = `
@keyframes shimmer {
  0%   { transform: translateX(-100%); }
  100% { transform: translateX(100%); }
}
@keyframes skeletonFadeIn {
  from { opacity: 0; transform: translateY(8px); }
  to   { opacity: 1; transform: translateY(0); }
}
.shimmer-block {
  position: relative;
  overflow: hidden;
  background: linear-gradient(135deg, #f0f0f0 0%, #e5e7eb 100%);
  border-radius: 6px;
}
.shimmer-block::after {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.65) 40%, rgba(255,255,255,0.65) 60%, transparent 100%);
  animation: shimmer 1.6s ease-in-out infinite;
}
.skeleton-card {
  animation: skeletonFadeIn 0.4s ease-out both;
}
`;

const getFullImageUrl = (imgPath) => {
  return normalizeImageUrl(imgPath) || "/placeholder-product.jpg";
};

/* Generic lazy image — shows shimmer until loaded, fades in smoothly */
const LazyImg = ({ src, alt, className = "", imgClassName = "", hoverScale = false }) => {
  const [loaded, setLoaded] = React.useState(false);
  const [failed, setFailed] = React.useState(false);
  return (
    <div className={`relative overflow-hidden bg-gray-100 ${className}`}>
      {!loaded && !failed && <div className="shimmer-block absolute inset-0" />}
      {failed ? (
        <div className="absolute inset-0 grid place-items-center text-gray-400 text-[11px] font-medium bg-gray-100">
          No image
        </div>
      ) : (
        <img
          src={src}
          alt={alt}
          loading="lazy"
          onLoad={() => setLoaded(true)}
          onError={() => { setFailed(true); setLoaded(false); }}
          className={`w-full h-full object-cover transition-opacity duration-500 ${
            loaded ? "opacity-100" : "opacity-0"
          } ${
            hoverScale ? "group-hover:scale-105 transition-transform duration-500" : ""
          } ${imgClassName}`}
        />
      )}
    </div>
  );
};

/* ── Skeleton for horizontal scroll cards (Trending / New Arrivals) ── */
const HorizontalCardSkeleton = ({ index = 0, accentColor = "#e5e7eb" }) => (
  <div
    className="skeleton-card min-w-[170px] w-[170px] bg-white rounded-xl border border-gray-100 overflow-hidden flex flex-col flex-shrink-0"
    style={{ animationDelay: `${index * 80}ms` }}
  >
    <div className="shimmer-block w-full h-40" style={{ borderRadius: 0 }} />
    <div className="p-3 flex flex-col flex-grow gap-1.5">
      <div className="shimmer-block h-2 w-12 rounded-full" />
      <div className="shimmer-block h-2 w-16 rounded-full" />
      <div className="flex flex-col gap-1 mt-0.5">
        <div className="shimmer-block h-3 w-full rounded-full" />
        <div className="shimmer-block h-3 w-3/5 rounded-full" />
      </div>
      <div className="mt-auto flex justify-between items-center pt-1.5">
        <div className="shimmer-block h-4 w-14 rounded-full" />
        <div className="shimmer-block h-4 w-12 rounded" />
      </div>
      <div className="shimmer-block h-7 w-full rounded-lg mt-1" />
    </div>
  </div>
);

/* ── Skeleton for Our Products grid (matches ProductCard) ── */
const ProductSkeleton = ({ className = "", imgClass = "h-28 md:h-32", index = 0 }) => (
  <div
    className={`skeleton-card bg-white rounded-lg border border-gray-100 overflow-hidden flex flex-col ${className}`}
    style={{ animationDelay: `${index * 60}ms` }}
  >
    <div className={`shimmer-block w-full ${imgClass}`} style={{ borderRadius: 0 }} />
    <div className="p-2 flex flex-col flex-grow gap-1">
      <div className="shimmer-block h-2 w-10 rounded-full" />
      <div className="shimmer-block h-2 w-16 rounded-full" />
      <div className="flex flex-col gap-1 mt-0.5">
        <div className="shimmer-block h-2.5 w-full rounded-full" />
        <div className="shimmer-block h-2.5 w-2/3 rounded-full" />
      </div>
      <div className="mt-auto flex justify-between items-center pt-1">
        <div className="shimmer-block h-3.5 w-12 rounded-full" />
        <div className="flex items-center gap-0.5">
          <div className="shimmer-block h-2.5 w-2.5 rounded-full" />
          <div className="shimmer-block h-2.5 w-6 rounded-full" />
        </div>
      </div>
      <div className="flex gap-1 mt-1.5">
        <div className="shimmer-block h-7 w-8 rounded" />
        <div className="shimmer-block h-7 flex-1 rounded" />
      </div>
    </div>
  </div>
);

/* ── Skeleton for Offers carousel ── */
const OfferSkeleton = ({ index = 0 }) => (
  <div
    className="skeleton-card relative min-w-[280px] md:min-w-[350px] h-[160px] md:h-[200px] rounded-xl overflow-hidden flex-shrink-0 border border-gray-100"
    style={{ animationDelay: `${index * 100}ms` }}
  >
    <div className="shimmer-block absolute inset-0" style={{ borderRadius: 0 }} />
    <div className="absolute inset-0 bg-gradient-to-tr from-black/10 via-transparent to-transparent" />
    <div className="absolute left-3 bottom-3 flex items-center gap-2">
      <div className="shimmer-block h-6 w-24 rounded-lg" style={{ background: 'rgba(255,255,255,0.5)' }} />
    </div>
  </div>
);

const fetchJson = async (url, fallbackMessage) => {
  try {
    const res = await fetch(url);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      console.error("[HomeContent] fetchJson failed", {
        url,
        status: res.status,
        statusText: res.statusText,
        response: data,
      });
      throw new Error(data?.message || fallbackMessage || "Request failed");
    }
    return data;
  } catch (error) {
    console.error("[HomeContent] fetchJson error", {
      url,
      message: error?.message,
      error,
    });
    throw error;
  }
};

const readHomeCache = (key) => {
  try {
    const raw = sessionStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.ts || parsed?.data === undefined) return null;
    if (Date.now() - Number(parsed.ts) > HOME_CACHE_TTL) return null;
    // support both array-data and object-data (sections)
    if (Array.isArray(parsed.data)) return { ts: Number(parsed.ts), data: parsed.data };
    if (typeof parsed.data === "object") return { ts: Number(parsed.ts), data: parsed.data };
    return null;
  } catch {
    return null;
  }
};

const writeHomeCache = (key, data) => {
  try {
    sessionStorage.setItem(
      key,
      JSON.stringify({
        ts: Date.now(),
        data: Array.isArray(data) ? data : [],
      })
    );
  } catch {
    // ignore
  }
};

const BannerHeroSkeleton = () => (
  <div className="relative h-[200px] sm:h-[290px] md:h-[370px] lg:h-[460px] xl:h-[520px] overflow-hidden">
    <div className="shimmer-block absolute inset-0" style={{ borderRadius: 0, background: 'linear-gradient(135deg, #1e293b 0%, #334155 50%, #1e293b 100%)' }} />
    <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent" />
    <div className="absolute inset-x-0 bottom-0 p-4 sm:p-6 md:p-10 space-y-2.5 md:space-y-3">
      <div className="h-5 w-20 md:w-24 rounded-full" style={{ background: 'rgba(255,255,255,0.12)' }} />
      <div className="h-7 sm:h-9 md:h-11 w-3/4 md:w-2/3 rounded-xl" style={{ background: 'rgba(255,255,255,0.10)' }} />
      <div className="h-3 md:h-4 w-1/2 rounded-full" style={{ background: 'rgba(255,255,255,0.08)' }} />
      <div className="h-9 md:h-10 w-28 md:w-36 rounded-full mt-1" style={{ background: 'rgba(255,255,255,0.12)' }} />
    </div>
  </div>
);

const HomeContent = () => {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const screens = useBreakpoint();
  const isMobile = !screens.sm;
  const [selectedOffer, setSelectedOffer] = React.useState(null);
  const bannerCarouselRef = React.useRef(null);
  const cachedStoriesEntry = React.useMemo(() => readHomeCache("home:stories:v1"), []);
  const cachedHomeSectionsEntry = React.useMemo(() => readHomeCache("home:sections:v2"), []);
  const cachedOffersEntry = React.useMemo(() => readHomeCache("home:offers:v1"), []);
  const cachedBannersEntry = React.useMemo(() => readHomeCache("home:banners:v1"), []);

  const stripHtml = (html = "") =>
    String(html || "")
      .replace(/<[^>]*>/g, " ")
      .replace(/\s+/g, " ")
      .trim();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  const storiesQuery = useQuery({
    queryKey: ["home-stories"],
    queryFn: async () => {
      const d = await fetchJson(`${API_BASE_URL}/api/stories?limit=50`, "Stories load failed");
      if (!d?.success) return [];
      return Array.isArray(d.stories) ? d.stories : [];
    },
    staleTime: 1000 * 60 * 2,
    gcTime: 1000 * 60 * 30,
    refetchOnWindowFocus: false,
    initialData: () => cachedStoriesEntry?.data,
    initialDataUpdatedAt: cachedStoriesEntry?.data?.length ? cachedStoriesEntry.ts : 0,
    placeholderData: (prev) => prev,
  });

  // Single query for flash + trending + ourProducts
  const homeSectionsQuery = useQuery({
    queryKey: ["home-sections-v2"],
    queryFn: async () => {
      const data = await fetchJson(
        `${API_BASE_URL}/api/products/home?days=7&limit=30`,
        "Home sections load failed"
      );
      if (!data?.success) throw new Error(data?.message || "Load failed");
      return {
        newArrivals: Array.isArray(data.newArrivals) ? data.newArrivals : [],
        trending: Array.isArray(data.trending) ? data.trending : [],
        ourProducts: Array.isArray(data.ourProducts) ? data.ourProducts : [],
        categorySections: Array.isArray(data.categorySections) ? data.categorySections : [],
      };
    },
    staleTime: 1000 * 60 * 2,
    gcTime: 1000 * 60 * 30,
    refetchOnWindowFocus: false,
    initialData: () => {
      const e = cachedHomeSectionsEntry;
      if (!e?.data?.trending && !e?.data?.newArrivals) return undefined;
      return e.data;
    },
    initialDataUpdatedAt: cachedHomeSectionsEntry?.ts || 0,
    placeholderData: (prev) => prev,
  });

  const offersQuery = useQuery({
    queryKey: ["home-offers-preview"],
    queryFn: async () => {
      const d = await fetchJson(`${API_BASE_URL}/api/offers?type=carousel&limit=20`, "Offers load failed");
      if (!d?.success) throw new Error(d?.message || "Offers load failed");
      return Array.isArray(d.offers) ? d.offers : [];
    },
    staleTime: 1000 * 15,
    gcTime: 1000 * 60 * 30,
    refetchOnWindowFocus: false,
    refetchOnMount: "always",
    initialData: () => cachedOffersEntry?.data,
    // Empty cached list should not block a live refetch.
    initialDataUpdatedAt: cachedOffersEntry?.data?.length ? cachedOffersEntry.ts : 0,
    placeholderData: (prev) => prev,
  });

  const bannersQuery = useQuery({
    queryKey: ["home-banners"],
    queryFn: async () => {
      const d = await fetchJson(`${API_BASE_URL}/api/offers?type=banner&limit=10`, "Banner load failed");
      if (!d?.success) throw new Error(d?.message || "Banner load failed");
      return Array.isArray(d.offers) ? d.offers : [];
    },
    staleTime: 1000 * 15,
    gcTime: 1000 * 60 * 30,
    refetchOnWindowFocus: false,
    refetchOnMount: "always",
    initialData: () => cachedBannersEntry?.data,
    // Empty cached list should not block a live refetch.
    initialDataUpdatedAt: cachedBannersEntry?.data?.length ? cachedBannersEntry.ts : 0,
    placeholderData: (prev) => prev,
  });

  const stories = storiesQuery.data || [];
  const homeSections = homeSectionsQuery.data || {};
  const newArrivals = homeSections.newArrivals || [];
  const trendingProducts = homeSections.trending || [];
  const ourProducts = homeSections.ourProducts || [];
  const offers = offersQuery.data || [];
  const banners = bannersQuery.data || [];

  useEffect(() => {
    if (stories.length > 0) writeHomeCache("home:stories:v1", stories);
  }, [stories]);

  useEffect(() => {
    if (newArrivals.length > 0 || trendingProducts.length > 0 || ourProducts.length > 0) {
      try {
        sessionStorage.setItem(
          "home:sections:v2",
          JSON.stringify({ ts: Date.now(), data: homeSections })
        );
      } catch { /* ignore */ }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [homeSections]);

  useEffect(() => {
    if (offers.length > 0) writeHomeCache("home:offers:v1", offers);
  }, [offers]);

  useEffect(() => {
    if (banners.length > 0) writeHomeCache("home:banners:v1", banners);
  }, [banners]);

  const storyLoading = storiesQuery.isPending;
  const sectionsLoading = homeSectionsQuery.isPending;
  const newArrivalsLoading = sectionsLoading;
  const productsLoading = sectionsLoading;
  const offersLoading = offersQuery.isPending;
  const bannersLoading = bannersQuery.isPending;
  const isBackgroundRefreshing =
    storiesQuery.isFetching ||
    homeSectionsQuery.isFetching ||
    offersQuery.isFetching ||
    bannersQuery.isFetching;
  const hasAnyHomeContent =
    stories.length > 0 ||
    newArrivals.length > 0 ||
    trendingProducts.length > 0 ||
    ourProducts.length > 0 ||
    offers.length > 0 ||
    banners.length > 0;

  const errMsg = homeSectionsQuery.error?.message || "";
  const offersErr = offersQuery.error?.message || "";
  const bannersErr = bannersQuery.error?.message || "";

  const homeBanners = React.useMemo(() => {
    const toBanner = (o) => ({
      id: o.id,
      title: o.title || "Featured Banner",
      subtitle: o.subtitle || stripHtml(o.description || ""),
      image: getFullImageUrl(o.imageUrl),
      linkUrl: o.linkUrl || "/products",
    });

    const fromBannerType = banners.map(toBanner).filter((x) => x.image);
    if (fromBannerType.length > 0) return fromBannerType;

    const fromCarouselType = offers.map(toBanner).filter((x) => x.image).slice(0, 5);
    return fromCarouselType;
  }, [banners, offers]);

  const handleAddToCartClick = (product, qty = 1, sourceEl = null) => {
    if (!canAddToCart(product?.id)) {
      message.info("Already added. Please wait a moment.");
      return false;
    }
    fetch(`${API_BASE_URL}/api/track/add-to-cart/${product.id}`, {
      method: "POST",
    }).catch(() => {});

    dispatch(
      addToCart({
        id: product.id,
        name: product.name,
        price: parseFloat(product.price),
        merchantId: product.merchantId,
        imageUrl: product.images?.[0],
        stock: product.stock,
        qty,
      })
    );
    message.success(`${qty} x ${product.name} added to cart`);
    animateAddToCart({
      sourceEl,
      imageUrl: product.images?.[0],
    });
    bumpCartBadge();
    return true;
  };

  const handleProductCardOpen = (product) => {
    if (!product?.id) return;
    fetch(`${API_BASE_URL}/api/track/view/${product.id}`, {
      method: "POST",
    }).catch(() => {});
  };

  const handleSearch = (event) => {
    event.preventDefault();
    const query = event.target.search.value?.trim();
    if (!query) return;
    navigate(`/search/${encodeURIComponent(query)}`);
  };

  return (
    <div className="relative pb-12 min-h-screen bg-gradient-to-b from-orange-50 via-rose-50 to-sky-50 overflow-hidden">
      <style dangerouslySetInnerHTML={{ __html: SHIMMER_CSS }} />
      {isBackgroundRefreshing && hasAnyHomeContent ? (
        <div className="pointer-events-none fixed top-0 left-0 right-0 z-50">
          <div className="h-0.5 w-full bg-gradient-to-r from-cyan-500 via-sky-500 to-emerald-500 animate-pulse" />
        </div>
      ) : null}
      <div className="pointer-events-none absolute -top-20 -left-20 h-64 w-64 rounded-full bg-pink-200/40 blur-3xl" />
      <div className="pointer-events-none absolute top-48 -right-16 h-72 w-72 rounded-full bg-cyan-200/40 blur-3xl" />
      <div className="pointer-events-none absolute bottom-20 left-1/3 h-56 w-56 rounded-full bg-amber-200/40 blur-3xl" />
      <div className="relative">
      {(errMsg || offersErr || bannersErr) ? (
        <div className="px-4 md:px-6 pt-4 space-y-2">
          {errMsg ? <Alert type="warning" showIcon title={errMsg} /> : null}
          {offersErr ? <Alert type="info" showIcon title={offersErr} /> : null}
          {bannersErr ? <Alert type="info" showIcon title={bannersErr} /> : null}
        </div>
      ) : null}

      <div className="mt-4 mb-4">
        <Story stories={stories} loading={storyLoading} />
      </div>

      <div className="px-4 md:px-6">
        <div className="mb-5 overflow-hidden rounded-2xl shadow-lg border border-white/60">
          {bannersLoading ? (
            <BannerHeroSkeleton />
          ) : homeBanners.length > 0 ? (
            <div className="relative group/banner">
              <Carousel
                ref={bannerCarouselRef}
                autoplay
                autoplaySpeed={3500}
                dots={{ className: "banner-dots" }}
                pauseOnHover
                draggable
                swipeToSlide
                fade
              >
                {homeBanners.map((b) => (
                  <div key={b.id}>
                    <div className="relative h-[200px] sm:h-[290px] md:h-[370px] lg:h-[460px] xl:h-[520px] overflow-hidden">
                      <LazyImg
                        src={b.image}
                        alt={b.title}
                        className="absolute inset-0 w-full h-full"
                        imgClassName="group-hover/banner:scale-105 transition-transform duration-[8s] ease-out"
                      />
                      {/* layered gradient: subtle at top, strong at bottom */}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/25 to-black/10" />
                      {/* content */}
                      <div className="absolute inset-0 p-4 sm:p-6 md:p-10 flex flex-col justify-end text-white">
                        <span className="inline-flex items-center w-fit gap-1.5 rounded-full bg-white/20 backdrop-blur-sm border border-white/30 px-3 py-0.5 text-[10px] md:text-xs font-semibold uppercase tracking-widest mb-2 md:mb-3">
                          ✦ Featured
                        </span>
                        <h1 className="text-lg sm:text-2xl md:text-4xl font-extrabold leading-tight max-w-xl drop-shadow-md">
                          {b.title}
                        </h1>
                        {b.subtitle && (
                          <p className="text-xs sm:text-sm md:text-base opacity-90 mt-1 md:mt-2 line-clamp-2 max-w-lg font-light">
                            {b.subtitle}
                          </p>
                        )}
                        <div className="mt-3 md:mt-5">
                          <Link
                            to={b.linkUrl || "/products"}
                            className="inline-flex items-center gap-2 rounded-full bg-white text-gray-900 px-4 md:px-6 py-2 md:py-2.5 text-xs md:text-sm font-bold shadow-lg hover:bg-orange-50 hover:scale-105 transition-all duration-200 active:scale-95"
                          >
                            Shop Now <MoveRight size={16} />
                          </Link>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </Carousel>

              {/* nav arrows — visible on hover */}
              <button
                type="button"
                onClick={() => bannerCarouselRef.current?.prev?.()}
                className="absolute left-2 md:left-4 top-1/2 -translate-y-1/2 h-8 w-8 md:h-11 md:w-11 rounded-full bg-black/30 text-white backdrop-blur-md border border-white/20 flex items-center justify-center opacity-0 group-hover/banner:opacity-100 hover:bg-black/60 transition-all duration-200 shadow-lg"
                aria-label="Previous banner"
              >
                <LeftOutlined className="text-sm" />
              </button>
              <button
                type="button"
                onClick={() => bannerCarouselRef.current?.next?.()}
                className="absolute right-2 md:right-4 top-1/2 -translate-y-1/2 h-8 w-8 md:h-11 md:w-11 rounded-full bg-black/30 text-white backdrop-blur-md border border-white/20 flex items-center justify-center opacity-0 group-hover/banner:opacity-100 hover:bg-black/60 transition-all duration-200 shadow-lg"
                aria-label="Next banner"
              >
                <RightOutlined className="text-sm" />
              </button>
            </div>
          ) : (
            <div className="h-[200px] sm:h-[290px] md:h-[370px] lg:h-[460px] bg-gradient-to-br from-slate-800 via-slate-700 to-slate-600 text-white grid place-items-center">
              <div className="text-center space-y-2">
                <p className="text-xs uppercase tracking-[0.2em] opacity-60 font-medium">Welcome</p>
                <h3 className="text-2xl font-extrabold">Discover Products</h3>
                <Link to="/products" className="inline-flex items-center gap-1.5 mt-2 bg-white/15 hover:bg-white/25 border border-white/20 rounded-full px-4 py-1.5 text-sm font-semibold transition-colors">
                  Browse All <MoveRight size={15} />
                </Link>
              </div>
            </div>
          )}
        </div>

      </div>

      {/* ── Trending / Best Selling ── */}
      <div className="px-4 md:px-6 mt-8">
        <div className="flex justify-between items-end mb-4">
          <div>
            <h2 className="text-2xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-amber-500 to-orange-600 tracking-tight flex items-center gap-2">
              🔥 Trending Now
            </h2>
            <p className="text-xs text-gray-600 mt-1">Best selling products this week</p>
          </div>
          <Link to="/products?sort=trending" className="text-sm font-medium text-blue-600 hover:text-blue-800 transition-colors inline-flex items-center gap-1">
            View All <MoveRight size={18} />
          </Link>
        </div>

        {newArrivalsLoading ? (
          <div className="flex gap-4 overflow-x-auto pb-6 scrollbar-hide">
            {Array.from({ length: 6 }).map((_, i) => (
              <HorizontalCardSkeleton key={i} index={i} accentColor="#fef3c7" />
            ))}
          </div>
        ) : trendingProducts.length === 0 ? null : (
          <div className="flex overflow-x-auto gap-4 pb-6 scrollbar-hide snap-x">
            {trendingProducts.map((product, idx) => (
              <div
                key={product.id}
                onClick={() => navigate(`/products/${product.id}`)}
                className="min-w-[170px] w-[170px] bg-white/95 rounded-xl shadow-sm hover:shadow-lg transition-all duration-300 flex flex-col snap-start border border-amber-100 overflow-hidden group cursor-pointer relative"
              >
                {/* Rank badge */}
                {idx < 3 && (
                  <div className="absolute top-2 left-2 z-10 w-6 h-6 rounded-full text-white text-[11px] font-black flex items-center justify-center shadow"
                    style={{ background: idx === 0 ? "#f59e0b" : idx === 1 ? "#94a3b8" : "#c2763a" }}>
                    {idx + 1}
                  </div>
                )}
                <LazyImg
                  src={getFullImageUrl(product.images?.[0])}
                  alt={product.name}
                  className="h-40 w-full"
                  hoverScale
                />
                <div className="p-3 flex flex-col flex-grow">
                  <p className="text-[10px] text-gray-400 uppercase tracking-wider mb-0.5">{product.category || "Item"}</p>
                  <p className="text-[10px] text-sky-700 font-medium mb-1 truncate">
                    {product.merchant?.name ? `Seller: ${product.merchant.name}` : ""}
                  </p>
                  <h3 className="text-sm font-semibold text-gray-800 line-clamp-2 leading-tight mb-1 h-10" title={product.name}>
                    {product.name}
                  </h3>
                  <div className="mt-auto flex items-center justify-between gap-1">
                    <span className="text-base font-bold text-gray-900">${Number(product.price || 0).toLocaleString()}</span>
                    <span className="text-[10px] bg-amber-100 text-amber-700 font-semibold px-1.5 py-0.5 rounded">
                      {Number(product.trending?.soldQty || 0) > 0 ? `${product.trending.soldQty} sold` : "Trending"}
                    </span>
                  </div>
                  <div className="mt-2" onClick={(e) => e.stopPropagation()}>
                    <Button
                      size="small"
                      type="primary"
                      block
                      icon={<ShoppingCartOutlined />}
                      onClick={(e) => handleAddToCartClick(product, 1, e.currentTarget)}
                      className="!bg-gradient-to-r !from-amber-500 !to-orange-500 border-none shadow-none"
                    >
                      Add
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── New Arrivals ── */}
      <div className="px-4 md:px-6 mt-8">
        <div className="flex justify-between items-end mb-4">
          <div>
            <h2 className="text-2xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-emerald-500 to-teal-600 tracking-tight flex items-center gap-2">
              ✨ New Arrivals
            </h2>
            <p className="text-xs text-gray-600 mt-1">Fresh products from our sellers</p>
          </div>
          <Link to="/products?sort=newest" className="text-sm font-medium text-blue-600 hover:text-blue-800 transition-colors inline-flex items-center gap-1">
            View All <MoveRight size={18} />
          </Link>
        </div>

        {newArrivalsLoading ? (
          <div className="flex gap-4 overflow-x-auto pb-6 scrollbar-hide">
            {Array.from({ length: 6 }).map((_, i) => (
              <HorizontalCardSkeleton key={i} index={i} accentColor="#d1fae5" />
            ))}
          </div>
        ) : newArrivals.length === 0 ? null : (
          <div className="flex overflow-x-auto gap-4 pb-6 scrollbar-hide snap-x">
            {newArrivals.map((product) => (
              <div
                key={product.id}
                onClick={() => navigate(`/products/${product.id}`)}
                className="min-w-[170px] w-[170px] bg-white/95 rounded-xl shadow-sm hover:shadow-lg transition-all duration-300 flex flex-col snap-start border border-emerald-100 overflow-hidden group cursor-pointer relative"
              >
                <span className="absolute top-2 left-2 z-10 bg-emerald-500 text-white text-[9px] font-bold px-2 py-0.5 rounded-full shadow">
                  NEW
                </span>
                <LazyImg
                  src={getFullImageUrl(product.images?.[0])}
                  alt={product.name}
                  className="h-40 w-full"
                  hoverScale
                />
                <div className="p-3 flex flex-col flex-grow">
                  <p className="text-[10px] text-gray-400 uppercase tracking-wider mb-0.5">{product.category || "Item"}</p>
                  <p className="text-[10px] text-sky-700 font-medium mb-1 truncate">
                    {product.merchant?.name ? `Seller: ${product.merchant.name}` : ""}
                  </p>
                  <h3 className="text-sm font-semibold text-gray-800 line-clamp-2 leading-tight mb-1 h-10" title={product.name}>
                    {product.name}
                  </h3>
                  <div className="mt-auto flex items-center justify-between gap-1">
                    <span className="text-base font-bold text-gray-900">${Number(product.price || 0).toLocaleString()}</span>
                    {product.averageRating > 0 ? (
                      <span className="text-[10px] text-amber-500 font-semibold">★ {Number(product.averageRating).toFixed(1)}</span>
                    ) : null}
                  </div>
                  <div className="mt-2" onClick={(e) => e.stopPropagation()}>
                    <Button
                      size="small"
                      type="primary"
                      block
                      icon={<ShoppingCartOutlined />}
                      onClick={(e) => handleAddToCartClick(product, 1, e.currentTarget)}
                      className="!bg-gradient-to-r !from-emerald-500 !to-teal-500 border-none shadow-none"
                    >
                      Add
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="px-4 md:px-6 my-8">
        <div className="flex justify-between items-end mb-5">
          <div>
            <h2 className="text-2xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-fuchsia-600 to-cyan-500 tracking-tight">Special Offers</h2>
            <p className="text-xs text-gray-600 mt-1">Exclusive deals for you</p>
          </div>

          <button type="button" className="text-sm font-medium text-gray-500 cursor-default" title="Preview only">
            Preview
          </button>
        </div>

        {offersLoading ? (
          <div className="flex overflow-x-auto gap-4 pb-2 scrollbar-hide">
            {Array.from({ length: 5 }).map((_, i) => (
              <OfferSkeleton key={i} index={i} />
            ))}
          </div>
        ) : (
          <div className="flex overflow-x-auto gap-4 pb-2 scrollbar-hide snap-x">
            {offers.length === 0 ? (
              <p className="text-gray-500">No offers yet</p>
            ) : (
              offers.map((o) => (
                <div
                  key={o.id}
                  onClick={() => setSelectedOffer(o)}
                  className="min-w-[280px] md:min-w-[350px] h-[160px] md:h-[200px] rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-all duration-300 snap-center relative group border border-cyan-100"
                  title={o.title}
                >
                  <LazyImg
                    src={getFullImageUrl(o.imageUrl)}
                    alt={o.title}
                    className="absolute inset-0 w-full h-full"
                    hoverScale
                  />
                  <div className="absolute inset-0 bg-gradient-to-tr from-black/35 via-transparent to-transparent group-hover:from-black/20 transition-colors" />
                  <div className="absolute left-3 bottom-3 bg-white/85 text-gray-900 px-3 py-1 rounded-lg text-xs font-semibold">
                    {o.title}
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      <div className="px-4 md:px-6">
        <div className="rounded-2xl border border-white/80 bg-white/75 backdrop-blur p-3 md:p-4 shadow-sm">
          <div className="flex justify-between items-end mb-4">
            <div>
              <span className="text-xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-sky-600 to-emerald-500">
                🛍️ Our Products
              </span>
              <p className="text-xs text-gray-500 mt-0.5">Handpicked products from various categories</p>
            </div>
            <Link
              to="/products"
              className="text-sm font-medium text-blue-600 hover:text-blue-800 transition-colors inline-flex items-center gap-1"
            >
              View All <MoveRight size={18} />
            </Link>
          </div>

          {productsLoading ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2 md:gap-3 mb-6">
              {Array.from({ length: 12 }).map((_, i) => (
                <ProductSkeleton key={i} index={i} imgClass="h-28 md:h-32" />
              ))}
            </div>
          ) : ourProducts.length === 0 ? (
            <p className="text-center text-gray-500 py-8">No products available yet</p>
          ) : (
            (() => {
              // group by category for display
              const grouped = {};
              for (const p of ourProducts) {
                const cat = p.category || "General";
                if (!grouped[cat]) grouped[cat] = [];
                grouped[cat].push(p);
              }
              return (
                <div className="space-y-8">
                  {Object.entries(grouped).map(([cat, catProducts]) => (
                    <div key={cat}>
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <span className="w-1 h-5 rounded-full bg-gradient-to-b from-sky-500 to-emerald-500 inline-block" />
                          <span className="text-base font-bold text-gray-800 capitalize">{cat}</span>
                          <span className="text-xs text-gray-400">({catProducts.length})</span>
                        </div>
                        <Link
                          to={`/${cat.toLowerCase().replace(/\s+/g, "-")}`}
                          className="text-xs text-blue-500 hover:text-blue-700 flex items-center gap-0.5"
                        >
                          See all <MoveRight size={14} />
                        </Link>
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2 md:gap-3">
                        {catProducts.map((p) => (
                          <ProductCard
                            key={p.id}
                            product={{
                              ...p,
                              images: (p.images || []).map(getFullImageUrl),
                              price: parseFloat(p.price),
                              oldPrice: p.oldPrice ? parseFloat(p.oldPrice) : undefined,
                            }}
                            onAddToCart={(_, qty) => handleAddToCartClick(p, qty)}
                            onProductClick={() => handleProductCardOpen(p)}
                          />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              );
            })()
          )}

          <div className="flex justify-center mt-6">
            <Link to="/products" className="text-sm font-medium text-blue-600 hover:text-blue-800 transition-colors gap-1">
              View All Products
            </Link>
          </div>
        </div>
      </div>

      <Footer />

      <Modal
        open={!!selectedOffer && !isMobile}
        onCancel={() => setSelectedOffer(null)}
        footer={null}
        width={900}
        centered
        destroyOnHidden
        styles={{ body: { padding: 0, maxHeight: "85vh", overflow: "hidden" } }}
      >
        {selectedOffer ? (
          <div className="flex flex-col max-h-[85vh]">
            <div className="p-4 border-b border-gray-100">
              <div className="text-lg font-semibold">{selectedOffer.title || "Offer"}</div>
              {selectedOffer.description ? (
                <div className="text-sm text-gray-500 mt-1 line-clamp-2">
                  {stripHtml(selectedOffer.description)}
                </div>
              ) : null}
            </div>
            <div className="overflow-y-auto">
              <div className="bg-gray-50 p-2">
                <img
                  src={getFullImageUrl(selectedOffer.imageUrl)}
                  alt={selectedOffer.title || "Offer"}
                  className="w-full max-h-[60vh] object-contain rounded-xl"
                />
              </div>
              {selectedOffer.description ? (
                <div className="p-4 border-t border-gray-100">
                  <div
                    className="prose prose-sm max-w-none"
                    dangerouslySetInnerHTML={{ __html: selectedOffer.description }}
                  />
                </div>
              ) : null}
            </div>
          </div>
        ) : null}
      </Modal>

      <Drawer
        open={!!selectedOffer && isMobile}
        onClose={() => setSelectedOffer(null)}
        placement="bottom"
        size="86vh"
        closable={false}
        title={null}
        styles={{ header: { display: "none" }, body: { padding: 0, overflow: "hidden" } }}
      >
        {selectedOffer ? (
          <div className="h-full flex flex-col bg-white">
            <div className="flex justify-center pt-2 pb-1 shrink-0">
              <div className="h-1.5 w-12 rounded-full bg-gray-300" />
            </div>
            <div className="p-4 border-b border-gray-100 shrink-0">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-lg font-semibold">{selectedOffer.title || "Offer"}</div>
                  {selectedOffer.description ? (
                    <div className="text-sm text-gray-500 mt-1 line-clamp-2">
                      {stripHtml(selectedOffer.description)}
                    </div>
                  ) : null}
                </div>
                <button
                  type="button"
                  className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm"
                  onClick={() => setSelectedOffer(null)}
                >
                  Close
                </button>
              </div>
            </div>
            <div className="overflow-y-auto">
              <div className="bg-gray-50 p-2">
                <img
                  src={getFullImageUrl(selectedOffer.imageUrl)}
                  alt={selectedOffer.title || "Offer"}
                  className="w-full max-h-[40vh] object-contain rounded-xl"
                />
              </div>
              {selectedOffer.description ? (
                <div className="p-4 border-t border-gray-100">
                  <div
                    className="prose prose-sm max-w-none"
                    dangerouslySetInnerHTML={{ __html: selectedOffer.description }}
                  />
                </div>
              ) : null}
            </div>
          </div>
        ) : null}
      </Drawer>
      </div>
    </div>
  );
};

export default HomeContent;
