import React, { useEffect, useMemo, useState, useRef } from "react";
import { useNavigate, useParams, useNavigationType, useLocation } from "react-router-dom";
import { useInfiniteQuery } from "@tanstack/react-query";
import { useInView } from "react-intersection-observer";
import { useDispatch, useSelector } from "react-redux";
import { addToCart } from "../../redux/cartSlice";
import ProductCard from "./ProductCart";
import { message, Skeleton } from "antd";
import { SearchOutlined } from "@ant-design/icons";
import axios from "axios";
import { API_BASE_URL } from "../../config/env";
import { canAddToCart } from "../../utils/cartAddGuard";

const API_BASE = API_BASE_URL;
const ROOT_WRAP_CLASS = "container mx-auto px-2 py-6 pb-16 bg-gray-50 min-h-[70vh]";
const getItemsPerPage = () => (window.innerWidth < 768 ? 40 : 60);

const normalizeText = (value = "") =>
  String(value || "")
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const suggestionScore = (keyword = "", query = "") => {
  const k = normalizeText(keyword);
  const q = normalizeText(query);
  if (!k || !q) return 0;
  if (k === q) return 100;
  if (k.includes(q)) return 80;

  const qTokens = q.split(" ").filter(Boolean);
  const kTokens = k.split(" ").filter(Boolean);
  let score = 0;

  for (const qt of qTokens) {
    if (!qt) continue;
    if (k.includes(qt)) score += 12;
    for (const kt of kTokens) {
      if (kt.startsWith(qt) || qt.startsWith(kt)) score += 6;
    }
  }

  return score;
};

const fetchSearchProducts = async ({ pageParam = 1, queryKey }) => {
  const [, routeQuery, sort, itemsPerPage, snapshotAt] = queryKey;

  const res = await axios.get(`${API_BASE}/api/products/search`, {
    params: {
      query: routeQuery,
      sort,
      page: pageParam,
      limit: Number(itemsPerPage) || 60,
      ...(snapshotAt ? { snapshotAt } : {}),
    },
  });

  const body = res.data || {};

  return {
    data: Array.isArray(body.data) ? body.data : Array.isArray(body.products) ? body.products : [],
    total: Number(body?.meta?.total || 0),
    nextPage: body?.meta?.hasNext ? pageParam + 1 : undefined,
  };
};

const Search = () => {
  const { query: routeQuery = "" } = useParams();
  const navigate = useNavigate();
  const navigationType = useNavigationType();
  const location = useLocation();
  const normalizedQuery = (routeQuery || "").trim();
  const dispatch = useDispatch();
  const cartItems = useSelector((state) => state.cart.items || []);
  const { ref, inView } = useInView();
  const [sort, setSort] = useState("smart");
  const [adminSuggestions, setAdminSuggestions] = useState([]);
  // holds the last successfully loaded products so the grid never flashes empty
  const stableProductsRef = useRef([]);
  const stableTotalRef = useRef(0);

  // Storage keys
  const getSnapshotKey = () => `search-snapshot:${normalizedQuery}:${sort}`;
  const getItemsPerPageKey = () => "search-itemsPerPage";
  const getScrollKey = () => `scroll:${location.pathname}`;
  const getPagesKey = () => `search-pages:${normalizedQuery}:${sort}`;

  // Persist snapshotAt - restore if exists
  const [snapshotAt, setSnapshotAt] = useState(() => {
    const saved = sessionStorage.getItem(getSnapshotKey());
    if (saved) return Number(saved);
    const ts = Date.now();
    sessionStorage.setItem(getSnapshotKey(), String(ts));
    return ts;
  });

  // Persist itemsPerPage - restore if exists
  const [itemsPerPage, setItemsPerPage] = useState(() => {
    const saved = sessionStorage.getItem(getItemsPerPageKey());
    if (saved) return Number(saved);
    const val = getItemsPerPage();
    sessionStorage.setItem(getItemsPerPageKey(), String(val));
    return val;
  });

  // Get saved pages count for restoration
  const getSavedPagesCount = () => {
    const saved = sessionStorage.getItem(getPagesKey());
    return saved ? Number(saved) : 1;
  };

  const scrollKeyRef = useRef(getScrollKey());
  const scrollRestoreDoneRef = useRef(false);
  const isBackNavRef = useRef(navigationType === "POP");
  const [pagesRestored, setPagesRestored] = useState(!isBackNavRef.current);

  // Reset snapshot when query or sort changes
  const prevQueryKeyRef = useRef(`${normalizedQuery}__${sort}`);
  const currentQueryKey = `${normalizedQuery}__${sort}`;
  useEffect(() => {
    if (prevQueryKeyRef.current !== currentQueryKey) {
      prevQueryKeyRef.current = currentQueryKey;
      const newTs = Date.now();
      sessionStorage.setItem(getSnapshotKey(), String(newTs));
      setSnapshotAt(newTs);
      // Reset restoration flags
      scrollRestoreDoneRef.current = false;
      isBackNavRef.current = false;
      setPagesRestored(true);
      sessionStorage.removeItem(getPagesKey());
    }
  }, [currentQueryKey]);

  useEffect(() => {
    const onResize = () => {
      const val = getItemsPerPage();
      setItemsPerPage(val);
      sessionStorage.setItem(getItemsPerPageKey(), String(val));
    };
    window.addEventListener("resize", onResize, { passive: true });
    return () => window.removeEventListener("resize", onResize);
  }, []);

  useEffect(() => {
    let ignore = false;
    (async () => {
      try {
        const response = await fetch(`${API_BASE}/api/settings`);
        const json = await response.json().catch(() => ({}));
        if (!response.ok || !json?.success || ignore) return;

        const raw = json?.data?.searchSuggestions;
        const next = Array.isArray(raw)
          ? raw
          : String(raw || "")
              .split(/\r?\n|,/)
              .map((x) => String(x || "").trim())
              .filter(Boolean);

        if (!ignore) setAdminSuggestions([...new Set(next)].slice(0, 200));
      } catch {
        if (!ignore) setAdminSuggestions([]);
      }
    })();

    return () => {
      ignore = true;
    };
  }, []);

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isFetching,
    status,
    error,
    refetch,
  } = useInfiniteQuery({
    queryKey: ["products-search-infinite", normalizedQuery, sort, itemsPerPage, snapshotAt],
    queryFn: fetchSearchProducts,
    initialPageParam: 1,
    getNextPageParam: (lastPage) => lastPage.nextPage,
    staleTime: 1000 * 60 * 5,
    gcTime: 1000 * 60 * 30,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    enabled: normalizedQuery.length > 0,
    placeholderData: (previousData) => previousData,
  });

  const currentPagesCount = data?.pages?.length || 0;

  // Save pages count whenever it changes (for scroll restoration on back nav)
  useEffect(() => {
    if (currentPagesCount > 0 && !isBackNavRef.current) {
      sessionStorage.setItem(getPagesKey(), String(currentPagesCount));
    }
  }, [currentPagesCount]);

  // On back navigation, restore all pages that were previously loaded
  useEffect(() => {
    if (!isBackNavRef.current || pagesRestored) return;
    if (status !== "success") return;
    if (isFetchingNextPage) return;

    const savedPagesCount = getSavedPagesCount();
    
    if (currentPagesCount < savedPagesCount && hasNextPage) {
      fetchNextPage();
    } else {
      setPagesRestored(true);
    }
  }, [status, currentPagesCount, hasNextPage, isFetchingNextPage, fetchNextPage, pagesRestored]);

  useEffect(() => {
    // Only trigger infinite scroll for normal navigation, not during back nav page restoration
    if (isBackNavRef.current && !pagesRestored) return;
    if (inView && hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  }, [inView, hasNextPage, isFetchingNextPage, fetchNextPage, pagesRestored]);

  const handleAddToCartClick = (product, qty) => {
    if (!canAddToCart(product?.id)) {
      message.info("Already added. Please wait a moment.");
      return false;
    }
    const priceNum = Number(product?.price);
    if (!Number.isFinite(priceNum) || priceNum < 0) {
      message.error("Invalid product price. Please refresh and try again.");
      return false;
    }
    const requestedQty = Math.max(1, Number(qty || 1));
    const maxStock = Number(product?.stock);
    const hasStock = Number.isFinite(maxStock) && maxStock > 0;
    const existingQty = Number(
      cartItems.find((it) => String(it.id) === String(product?.id))?.qty || 0
    );

    if (existingQty > 0) {
      message.info(`Already in cart (${existingQty}). Quantity change from cart page.`);
      return false;
    }

    if (hasStock && existingQty >= maxStock) {
      message.warning(`Maximum stock reached (In cart: ${existingQty}/${maxStock})`);
      return false;
    }

    const allowedQty = hasStock
      ? Math.min(requestedQty, Math.max(0, maxStock - existingQty))
      : requestedQty;

    if (allowedQty <= 0) {
      message.warning("Quantity exceeds available stock");
      return false;
    }

    fetch(`${API_BASE}/api/track/add-to-cart/${product.id}`, {
      method: "POST",
    }).catch(() => {});

    dispatch(
      addToCart({
        id: product.id,
        name: product.name,
        price: priceNum,
        merchantId: product.merchantId,
        imageUrl: product.images?.[0],
        stock: product.stock,
        qty: allowedQty,
      })
    );
    if (allowedQty < requestedQty) {
      message.success(`${allowedQty} x ${product.name} added (stock limit applied)`);
    } else {
      message.success(`${allowedQty} x ${product.name} added to cart`);
    }
    return true;
  };

  const products = useMemo(() => {
    const map = new Map();
    for (const page of data?.pages || []) {
      for (const product of page?.data || []) {
        if (!product?.id) continue;
        if (!map.has(product.id)) map.set(product.id, product);
      }
    }
    return Array.from(map.values());
  }, [data]);

  // Scroll restoration - must happen AFTER all pages are restored
  useEffect(() => {
    const key = getScrollKey();
    scrollKeyRef.current = key;

    if (status !== "success" || products.length === 0) return;

    // For back navigation, wait until pages are restored
    if (isBackNavRef.current && !pagesRestored) return;

    // Check if we should restore scroll (back navigation)
    const savedScroll = sessionStorage.getItem(key);
    const shouldRestore = isBackNavRef.current && savedScroll && !scrollRestoreDoneRef.current;

    if (shouldRestore) {
      const y = Number(savedScroll);
      if (Number.isFinite(y) && y > 0) {
        let attempts = 0;
        const maxAttempts = 20;
        
        const tryScroll = () => {
          attempts++;
          window.scrollTo({ top: y, behavior: "instant" });
          
          const currentY = window.scrollY;
          const reachedTarget = Math.abs(currentY - y) < 100;
          
          if (!reachedTarget && attempts < maxAttempts) {
            setTimeout(tryScroll, 80);
          }
        };
        
        requestAnimationFrame(tryScroll);
        scrollRestoreDoneRef.current = true;
        return;
      }
    }

    // For non-back navigation, scroll to top (only once)
    if (!isBackNavRef.current && !scrollRestoreDoneRef.current) {
      window.scrollTo(0, 0);
      scrollRestoreDoneRef.current = true;
    }
  }, [status, products.length, location.pathname, pagesRestored]);

  // Save scroll position on scroll
  useEffect(() => {
    let t = null;
    const onScroll = () => {
      if (t) return;
      t = window.setTimeout(() => {
        t = null;
        const key = scrollKeyRef.current;
        if (key) sessionStorage.setItem(key, String(window.scrollY || 0));
      }, 120);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      const key = scrollKeyRef.current;
      if (key) sessionStorage.setItem(key, String(window.scrollY || 0));
      if (t) window.clearTimeout(t);
    };
  }, []);

  // update stable ref whenever real (non-placeholder) results are available
  if (!isFetching || isFetchingNextPage) {
    if (products.length > 0) {
      stableProductsRef.current = products;
      stableTotalRef.current = data?.pages?.[0]?.total || 0;
    }
  }

  // displayProducts: show current results when ready, fall back to previous
  // so the grid NEVER goes blank while a new query is loading
  const displayProducts = products.length > 0 ? products : stableProductsRef.current;
  const totalItems = products.length > 0
    ? (data?.pages?.[0]?.total || 0)
    : stableTotalRef.current;
  const relatedSuggestions = useMemo(() => {
    if (!normalizedQuery || !adminSuggestions.length) return [];
    return adminSuggestions
      .map((item) => ({ item, score: suggestionScore(item, normalizedQuery) }))
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 6)
      .map((x) => x.item);
  }, [adminSuggestions, normalizedQuery]);

  if (!normalizedQuery) {
    return (
      <div className={ROOT_WRAP_CLASS}>
        <div className="w-full min-h-[62vh] md:min-h-[68vh] mt-2 mb-2 bg-gradient-to-br from-white via-sky-50 to-cyan-50 px-4 py-10 md:px-8 md:py-14 text-center flex items-center justify-center">
          <div className="max-w-xl">
            <div className="mx-auto mb-4 flex h-14 w-14 md:h-16 md:w-16 items-center justify-center rounded-2xl bg-white text-sky-600 shadow-sm">
              <SearchOutlined style={{ fontSize: 26 }} />
            </div>
            <p className="text-gray-900 font-semibold text-xl md:text-2xl">Type something to search</p>
            <p className="text-gray-600 text-sm md:text-base mt-2 leading-relaxed">
              Try product name, category, or brand keyword.
            </p>
            <div className="mt-5 inline-flex flex-wrap items-center justify-center gap-2 text-xs">
              <span className="rounded-full bg-white px-3 py-1 text-gray-700 border border-sky-100">mobile</span>
              <span className="rounded-full bg-white px-3 py-1 text-gray-700 border border-sky-100">laptop</span>
              <span className="rounded-full bg-white px-3 py-1 text-gray-700 border border-sky-100">groceries</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Show skeleton ONLY on the very first load with no previous results at all
  if (status === "pending" && !data && displayProducts.length === 0) {
    return (
      <div className={ROOT_WRAP_CLASS}>
        <div className="mb-4 px-1">
          <div className="h-1 w-full rounded-full bg-gray-100 overflow-hidden mb-4">
            <div className="h-full bg-gradient-to-r from-orange-400 via-pink-400 to-orange-400 animate-[shimmerBar_1.2s_ease_infinite]" style={{width:'60%'}} />
          </div>
          <style>{`@keyframes shimmerBar{0%{transform:translateX(-100%)}100%{transform:translateX(200%)}}`}</style>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2 md:gap-3">
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="bg-white rounded-lg border border-gray-100 overflow-hidden">
              <div className="relative w-full h-28 md:h-32 bg-gray-100 overflow-hidden">
                <div className="absolute inset-0" style={{background:'linear-gradient(90deg,transparent,rgba(255,255,255,.7),transparent)',animation:'shimmerBar 1.4s linear infinite'}} />
              </div>
              <div className="p-2 space-y-2">
                <div className="relative h-2.5 w-3/4 rounded-full bg-gray-100 overflow-hidden"><div className="absolute inset-0" style={{background:'linear-gradient(90deg,transparent,rgba(255,255,255,.7),transparent)',animation:'shimmerBar 1.4s linear infinite .1s'}} /></div>
                <div className="relative h-2.5 w-1/2 rounded-full bg-gray-100 overflow-hidden"><div className="absolute inset-0" style={{background:'linear-gradient(90deg,transparent,rgba(255,255,255,.7),transparent)',animation:'shimmerBar 1.4s linear infinite .2s'}} /></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className={ROOT_WRAP_CLASS}>
        <div className="bg-white border border-red-200 rounded-xl p-4 mx-1">
          <p className="font-semibold text-red-600">Something went wrong</p>
          <p className="text-sm text-gray-600 mt-1">{error?.message || "Failed to load products. Try again."}</p>
          <button
            onClick={() => refetch()}
            className="text-sm px-3 py-2 mt-3 rounded-lg bg-red-600 text-white hover:bg-red-700 transition"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={ROOT_WRAP_CLASS}>
      <div className="mb-4 flex justify-end px-1">
        <div className="flex items-center gap-2">
          <label htmlFor="search-sort" className="text-xs font-medium text-gray-600 sm:text-sm">
            Sort by
          </label>
          <select
            id="search-sort"
            value={sort}
            onChange={(e) => setSort(e.target.value)}
            className="h-9 min-w-[158px] rounded-md border border-gray-300 bg-white px-3 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="smart">Best Match</option>
            <option value="newest">Newest</option>
            <option value="price_low">Price: Low to High</option>
            <option value="price_high">Price: High to Low</option>
            <option value="rating">Top Rated</option>
          </select>
        </div>
      </div>

      {/* thin shimmer progress bar — shows for both initial and re-query loads */}
      {isFetching && !isFetchingNextPage && (
        <div className="px-1 mb-3">
          <div className="h-1 w-full rounded-full bg-gray-100 overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-orange-400 via-pink-400 to-orange-400"
              style={{ width: '60%', animation: 'shimmerBar 1.2s ease infinite' }}
            />
          </div>
          <style>{`@keyframes shimmerBar{0%{transform:translateX(-100%)}100%{transform:translateX(200%)}}`}</style>
        </div>
      )}

      {displayProducts.length > 0 ? (
        <>
        <div
            className={`grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2 md:gap-3 mb-6 transition-opacity duration-300 ${
              isFetching && !isFetchingNextPage ? "opacity-60" : "opacity-100"
            }`}
          >
            {displayProducts.map((product) => (
              <ProductCard key={product.id} product={product} onAddToCart={handleAddToCartClick} />
            ))}
          </div>

          <div ref={ref} className="flex justify-center py-6 h-16">
            {isFetchingNextPage && (
              <div className="flex items-center space-x-2 text-blue-600">
                <span className="w-2 h-2 bg-blue-600 rounded-full animate-bounce"></span>
                <span className="w-2 h-2 bg-blue-600 rounded-full animate-bounce delay-75"></span>
                <span className="w-2 h-2 bg-blue-600 rounded-full animate-bounce delay-150"></span>
              </div>
            )}
            {!hasNextPage && <span className="text-xs text-gray-400 font-medium">No more products</span>}
          </div>
        </>
      ) : (
        displayProducts.length === 0 && !isFetching ? (
          <div className="w-full min-h-[62vh] md:min-h-[68vh] mt-2 mb-2 rounded-none border-0 bg-gradient-to-br from-white via-sky-50 to-cyan-50 px-4 py-10 md:px-8 md:py-14 text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 md:h-16 md:w-16 items-center justify-center rounded-2xl bg-white text-orange-500 shadow-sm">
              <SearchOutlined style={{ fontSize: 28 }} />
            </div>
          <p className="text-gray-900 font-semibold text-lg md:text-xl">No products found</p>
          <p className="text-gray-600 text-sm mt-2 leading-relaxed">
            We could not find any match for{" "}
            <span className="font-semibold text-gray-800">"{normalizedQuery}"</span>
          </p>

          {relatedSuggestions.length > 0 ? (
            <p className="mt-5 text-xs font-medium text-sky-700">Suggested searches</p>
          ) : null}
          <div className="mt-5 inline-flex flex-wrap items-center justify-center gap-2 text-xs">
            {relatedSuggestions.length > 0 ? (
              relatedSuggestions.map((item) => (
                <button
                  key={`suggestion-${item}`}
                  type="button"
                  onClick={() => navigate(`/search/${encodeURIComponent(item)}`)}
                  className="rounded-full bg-white px-3 py-1 text-gray-700 border border-sky-100 hover:bg-sky-50 transition"
                >
                  {item}
                </button>
              ))
            ) : (
              <>
                <span className="rounded-full bg-white px-3 py-1 text-gray-600 border border-sky-100">Check spelling</span>
                <span className="rounded-full bg-white px-3 py-1 text-gray-600 border border-sky-100">Use shorter keywords</span>
                <span className="rounded-full bg-white px-3 py-1 text-gray-600 border border-sky-100">Try category name</span>
              </>
            )}
          </div>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
            <button
              type="button"
              onClick={() => navigate("/")}
              className="rounded-lg bg-orange-500 px-4 py-2 text-sm font-medium text-white hover:bg-orange-600 transition"
            >
              Go to Home
            </button>
            <button
              type="button"
              onClick={() => navigate("/search")}
              className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition"
            >
              Clear Search
            </button>
          </div>
        </div>
        ) : null
      )}
    </div>
  );
};

export default Search;
