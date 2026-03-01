import React, { useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { InputNumber, Rate, Button, message, Alert, Modal, Drawer, Grid, Carousel } from "antd";
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
const { useBreakpoint } = Grid;
const HOME_CACHE_TTL = 1000 * 60 * 15;


const getFullImageUrl = (imgPath) => {
  return normalizeImageUrl(imgPath) || "/placeholder-product.jpg";
};

const ProductSkeleton = ({ className = "", imgClass = "h-40" }) => (
  <div className={`bg-white rounded-xl border border-gray-100 overflow-hidden animate-pulse flex flex-col ${className}`}>
    <div className={`w-full bg-gray-200 ${imgClass}`} />
    <div className="p-3 flex flex-col gap-2 flex-grow">
      <div className="h-3 bg-gray-200 rounded w-3/4" />
      <div className="h-3 bg-gray-200 rounded w-1/2" />
      <div className="mt-auto flex justify-between items-center pt-2">
        <div className="h-4 bg-gray-200 rounded w-1/3" />
        <div className="h-6 bg-gray-200 rounded w-8" />
      </div>
    </div>
  </div>
);

const FlashSaleCardImage = ({ src, alt }) => {
  const [loaded, setLoaded] = React.useState(false);
  const [failed, setFailed] = React.useState(false);

  return (
    <div className="h-40 w-full bg-gray-50 relative overflow-hidden">
      {!loaded && !failed ? (
        <div className="absolute inset-0 animate-pulse bg-gradient-to-br from-gray-100 via-gray-200 to-gray-100" />
      ) : null}

      {failed ? (
        <div className="absolute inset-0 grid place-items-center bg-gray-100 text-gray-400 text-xs font-medium">
          Image unavailable
        </div>
      ) : (
        <img
          src={src}
          alt={alt}
          onLoad={() => setLoaded(true)}
          onError={() => {
            setFailed(true);
            setLoaded(false);
          }}
          className={`w-full h-full object-cover group-hover:scale-105 transition-all duration-500 ${
            loaded ? "opacity-100" : "opacity-0"
          }`}
        />
      )}
    </div>
  );
};

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
    if (!parsed?.ts || !Array.isArray(parsed?.data)) return null;
    if (Date.now() - Number(parsed.ts) > HOME_CACHE_TTL) return null;
    return { ts: Number(parsed.ts), data: parsed.data };
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
  <div className="relative h-[220px] sm:h-[280px] md:h-[340px] lg:h-[380px] overflow-hidden bg-slate-200 animate-pulse">
    <div className="absolute inset-0 bg-gradient-to-r from-slate-300/90 via-slate-200/70 to-slate-300/90" />
    <div className="absolute inset-x-0 bottom-0 p-4 md:p-6">
      <div className="h-3 w-28 rounded bg-white/60 mb-3" />
      <div className="h-8 md:h-10 w-2/3 rounded bg-white/70 mb-3" />
      <div className="h-3 w-1/2 rounded bg-white/60 mb-4" />
      <div className="h-8 w-28 rounded-full bg-white/70" />
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
  const cachedFlashEntry = React.useMemo(() => readHomeCache("home:flash:v1"), []);
  const cachedProductsEntry = React.useMemo(() => readHomeCache("home:products:v1"), []);
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

  const flashQuery = useQuery({
    queryKey: ["home-flash-products"],
    queryFn: async () => {
      const data = await fetchJson(`${API_BASE_URL}/api/products/home?days=7&limit=50`, "Flash sale load failed");
      if (!data?.success) throw new Error(data?.message || "Flash sale load failed");
      return Array.isArray(data.flash) ? data.flash : [];
    },
    staleTime: 1000 * 60 * 2,
    gcTime: 1000 * 60 * 30,
    refetchOnWindowFocus: false,
    initialData: () => cachedFlashEntry?.data,
    initialDataUpdatedAt: cachedFlashEntry?.data?.length ? cachedFlashEntry.ts : 0,
    placeholderData: (prev) => prev,
  });

  const productsQuery = useQuery({
    queryKey: ["home-products-preview"],
    queryFn: async () => {
      const data = await fetchJson(
        `${API_BASE_URL}/api/products?page=1&limit=40&sort=smart&mode=all`,
        "Products load failed"
      );
      return Array.isArray(data.data) ? data.data : [];
    },
    staleTime: 1000 * 60 * 2,
    gcTime: 1000 * 60 * 30,
    refetchOnWindowFocus: false,
    initialData: () => cachedProductsEntry?.data,
    initialDataUpdatedAt: cachedProductsEntry?.data?.length ? cachedProductsEntry.ts : 0,
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
  const flashProducts = flashQuery.data || [];
  const allProducts = productsQuery.data || [];
  const offers = offersQuery.data || [];
  const banners = bannersQuery.data || [];

  useEffect(() => {
    if (stories.length > 0) {
      writeHomeCache("home:stories:v1", stories);
    }
  }, [stories]);

  useEffect(() => {
    if (flashProducts.length > 0) {
      writeHomeCache("home:flash:v1", flashProducts);
    }
  }, [flashProducts]);

  useEffect(() => {
    if (allProducts.length > 0) {
      writeHomeCache("home:products:v1", allProducts);
    }
  }, [allProducts]);

  useEffect(() => {
    if (offers.length > 0) {
      writeHomeCache("home:offers:v1", offers);
    }
  }, [offers]);

  useEffect(() => {
    if (banners.length > 0) {
      writeHomeCache("home:banners:v1", banners);
    }
  }, [banners]);

  const storyLoading = storiesQuery.isPending;
  const flashLoading = flashQuery.isPending;
  const productsLoading = productsQuery.isPending;
  const offersLoading = offersQuery.isPending;
  const bannersLoading = bannersQuery.isPending;
  const isBackgroundRefreshing =
    storiesQuery.isFetching ||
    flashQuery.isFetching ||
    productsQuery.isFetching ||
    offersQuery.isFetching ||
    bannersQuery.isFetching;
  const hasAnyHomeContent =
    stories.length > 0 ||
    flashProducts.length > 0 ||
    allProducts.length > 0 ||
    offers.length > 0 ||
    banners.length > 0;

  const errMsg = flashQuery.error?.message || productsQuery.error?.message || "";
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

  const handleAddToCartClick = (product, qty = 1) => {
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
        qty,
      })
    );
    message.success(`${qty} x ${product.name} added to cart`);
    setTimeout(() => {
      productsQuery.refetch();
    }, 250);
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
        <div className="mb-5 overflow-hidden rounded-2xl shadow-md border border-white/70">
          {bannersLoading ? (
            <BannerHeroSkeleton />
          ) : homeBanners.length > 0 ? (
            <div className="relative">
              <Carousel
                ref={bannerCarouselRef}
                autoplay
                autoplaySpeed={2800}
                dots
                pauseOnHover
                draggable
                swipeToSlide
              >
                {homeBanners.map((b) => (
                  <div key={b.id}>
                    <div className="relative h-[220px] sm:h-[280px] md:h-[340px] lg:h-[380px]">
                      <img src={b.image} alt={b.title} className="h-full w-full object-cover" />
                      <div className="absolute inset-0 bg-gradient-to-r from-black/60 via-black/35 to-black/10" />
                      <div className="absolute inset-0 p-4 md:p-6 flex flex-col justify-end text-white">
                        <p className="text-[11px] uppercase tracking-[0.16em] font-semibold opacity-90">Trending Now</p>
                        <h1 className="mt-1 text-xl md:text-3xl font-extrabold leading-tight max-w-2xl">{b.title}</h1>
                        <p className="text-xs md:text-sm opacity-95 mt-1 line-clamp-2">{b.subtitle}</p>
                        <div className="mt-3">
                          <Link
                            to={b.linkUrl || "/products"}
                            className="inline-flex items-center gap-1 rounded-full bg-white/20 px-3 py-1.5 text-xs font-semibold hover:bg-white/30 transition-colors"
                          >
                            Shop Now <MoveRight size={16} />
                          </Link>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </Carousel>

              <button
                type="button"
                onClick={() => bannerCarouselRef.current?.prev?.()}
                className="absolute left-2 md:left-4 top-1/2 -translate-y-1/2 h-8 w-8 md:h-10 md:w-10 rounded-full bg-black/35 text-white backdrop-blur flex items-center justify-center hover:bg-black/55 transition-colors"
                aria-label="Previous banner"
              >
                <LeftOutlined />
              </button>
              <button
                type="button"
                onClick={() => bannerCarouselRef.current?.next?.()}
                className="absolute right-2 md:right-4 top-1/2 -translate-y-1/2 h-8 w-8 md:h-10 md:w-10 rounded-full bg-black/35 text-white backdrop-blur flex items-center justify-center hover:bg-black/55 transition-colors"
                aria-label="Next banner"
              >
                <RightOutlined />
              </button>
            </div>
          ) : (
            <div className="h-[220px] sm:h-[280px] md:h-[340px] lg:h-[380px] bg-gradient-to-r from-slate-700 to-slate-500 text-white grid place-items-center">
              <div className="text-center">
                <p className="text-xs uppercase tracking-[0.16em] opacity-80">Banner</p>
                <h3 className="text-xl font-bold mt-1">No active banner yet</h3>
              
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-between items-end mb-5">
          <div>
            <h2 className="text-2xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-rose-600 to-orange-500 tracking-tight">Flash Sale</h2>
            <p className="text-xs text-gray-600 mt-1">High discount products</p>
          </div>

          <Link
            to="/flash-sales"
            className="text-sm font-medium text-blue-600 hover:text-blue-800 transition-colors"
          >
            View All <MoveRight size={18} />
          </Link>
        </div>

        {flashLoading ? (
          <div className="flex gap-4 overflow-x-auto pb-6 scrollbar-hide">
            {Array.from({ length: 6 }).map((_, i) => (
              <ProductSkeleton key={i} className="min-w-[180px] w-[180px]" imgClass="h-40" />
            ))}
          </div>
        ) : (
          <div className="flex overflow-x-auto gap-4 pb-6 scrollbar-hide snap-x">
            {flashProducts.length === 0 ? (
              <p className="text-gray-500">No flash sale products yet</p>
            ) : (
              flashProducts.map((product) => (
                <div
                  key={product.id}
                  onClick={() => navigate(`/products/${product.id}`)}
                  className="min-w-[180px] w-[180px] bg-white/95 rounded-xl shadow-sm hover:shadow-lg transition-all duration-300 flex flex-col snap-start border border-rose-100 overflow-hidden group cursor-pointer"
                >
                  <div className="relative">
                    <FlashSaleCardImage src={getFullImageUrl(product.images?.[0])} alt={product.name} />
                    <span className="absolute top-2 left-2 bg-gradient-to-r from-rose-500 to-orange-500 text-white text-[10px] font-bold px-2 py-0.5 rounded shadow-sm">
                      FLASH
                    </span>
                  </div>

                  <div className="p-3 flex flex-col flex-grow">
                    <p className="text-[10px] text-gray-400 uppercase tracking-wider mb-1">
                      {product.category || "Item"}
                    </p>

                    <p
                      className="text-[10px] text-sky-700 font-medium mb-1 truncate"
                      title={product.merchant?.name || (product.merchantId ? `Seller #${product.merchantId}` : "")}
                    >
                      {product.merchant?.name
                        ? `Seller: ${product.merchant.name}`
                        : product.merchantId
                          ? `Seller #${product.merchantId}`
                          : ""}
                    </p>

                    <h3
                      className="text-sm font-semibold text-gray-800 line-clamp-2 leading-tight mb-1 h-10"
                      title={product.name}
                    >
                      {product.name}
                    </h3>

                    <div className="flex items-center mb-2">
                      <Rate
                        disabled
                        allowHalf
                        value={Number(product.rating || product.averageRating || 0)}
                        style={{ fontSize: 10 }}
                      />
                      <span className="text-[10px] text-gray-400 ml-1">({product.totalReviews || 0})</span>
                    </div>

                    <div className="mt-auto">
                      <div className="flex items-center justify-between mb-3">
                        <p className="text-lg font-bold text-gray-900">${product.price}</p>
                        {product.oldPrice ? (
                          <p className="text-xs text-gray-400 line-through">${product.oldPrice}</p>
                        ) : null}
                      </div>

                      <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                        <InputNumber
                          min={1}
                          max={10}
                          defaultValue={1}
                          size="small"
                          className="w-14"
                          controls={false}
                        />
                        <Button
                          type="primary"
                          size="small"
                          icon={<ShoppingCartOutlined />}
                          onClick={() => handleAddToCartClick(product, 1)}
                          className="flex-grow !bg-gradient-to-r !from-rose-500 !to-orange-500 hover:!from-rose-600 hover:!to-orange-600 border-none shadow-none rounded-md flex justify-center items-center"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
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
              <div
                key={i}
                className="min-w-[280px] md:min-w-[350px] h-[160px] md:h-[200px] rounded-xl bg-gray-200 animate-pulse border border-gray-100"
              />
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
                  <img
                    src={getFullImageUrl(o.imageUrl)}
                    alt={o.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
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
          <span className="text-lg font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-sky-600 to-emerald-500">Our Products</span>
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
              <ProductSkeleton key={i} imgClass="h-28 md:h-32" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2 md:gap-3 mb-6">
            {allProducts.length === 0 ? (
              <p className="col-span-full text-center text-gray-500 py-8">No products available yet</p>
            ) : (
              allProducts.map((p) => (
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
              ))
            )}
          </div>
        )}

        <div className="flex justify-center">
          <Link to="/products" className="text-sm font-medium  text-blue-600 hover:text-blue-800 transition-colors  gap-1">
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
