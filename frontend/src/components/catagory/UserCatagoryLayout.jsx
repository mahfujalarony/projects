import React, { useEffect, useMemo, useState, useRef } from "react";
import { useNavigationType, useParams, useLocation } from "react-router-dom";
import { useInfiniteQuery } from "@tanstack/react-query";
import { useInView } from "react-intersection-observer";
import { useDispatch } from "react-redux";
import { addToCart } from "../../redux/cartSlice";
import ProductCard from "../common/ProductCart";
import { message } from "antd";
import { SearchOutlined } from "@ant-design/icons";
import { canAddToCart } from "../../utils/cartAddGuard";

const getItemsPerPage = () => (window.innerWidth < 768 ? 40 : 60);
const GRID_SKELETON_COUNT = 12;

const SkeletonBlock = ({ height = 12, width = "100%", rounded = "rounded-lg", delay = "0s" }) => (
  <div
    className={rounded}
    style={{
      height,
      width,
      background: "linear-gradient(90deg, #fff7ed 0%, #fed7aa 40%, #fff7ed 100%)",
      backgroundSize: "200% 100%",
      animation: "categoryShimmer 1.6s ease-in-out infinite",
      animationDelay: delay,
    }}
  />
);

const SkeletonStyles = () => (
  <style>{`
    @keyframes categoryShimmer {
      0% { background-position: 200% 0; }
      100% { background-position: -200% 0; }
    }
  `}</style>
);

const ProductGridSkeleton = ({ count = GRID_SKELETON_COUNT }) => (
  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2 md:gap-3 mb-6">
    {Array.from({ length: count }).map((_, i) => (
      <div key={`grid-skeleton-${i}`} className="bg-white rounded-xl border border-orange-100 p-2 shadow-sm">
        <SkeletonBlock height={128} rounded="rounded-lg" delay={`${i * 0.06}s`} />
        <div className="mt-2 space-y-2">
          <SkeletonBlock height={11} width="86%" delay={`${i * 0.06 + 0.1}s`} />
          <SkeletonBlock height={10} width="56%" delay={`${i * 0.06 + 0.15}s`} />
          <div className="pt-1 flex items-center justify-between">
            <SkeletonBlock height={13} width="34%" rounded="rounded-md" />
            <SkeletonBlock height={28} width={28} rounded="rounded-xl" />
          </div>
        </div>
      </div>
    ))}
  </div>
);

const fetchProducts = async ({ pageParam = 1, queryKey }) => {
  const [, categoryName, nestedPath, sort, itemsPerPage] = queryKey;
  const resolvedPageParam =
    typeof pageParam === "object" && pageParam !== null
      ? pageParam
      : { page: Number(pageParam) || 1, snapshotAt: null };
  const pageNumber = Math.max(Number(resolvedPageParam.page) || 1, 1);
  const snapshotAt = Number(resolvedPageParam.snapshotAt) || null;
  const pathSegments = String(nestedPath || "")
    .split("/")
    .map((s) => s.trim())
    .filter(Boolean);
  const effectiveSubCategory = pathSegments.length ? pathSegments[pathSegments.length - 1] : "";

  const params = new URLSearchParams();
  params.set("page", String(pageNumber));
  params.set("limit", String(Number(itemsPerPage) || 60));
  params.set("sort", sort || "smart");
  if (snapshotAt) params.set("snapshotAt", String(snapshotAt));

  if (categoryName?.trim()) params.set("category", categoryName.trim());
  if (effectiveSubCategory?.trim()) params.set("subCategory", effectiveSubCategory.trim());

  const response = await fetch(`http://localhost:3001/api/products?${params.toString()}`);

  if (!response.ok) throw new Error("Network response was not ok");

  const json = await response.json();

  return {
    data: json.data || [],
    total: json.meta?.total || 0,
    snapshotAt: Number(json.meta?.snapshotAt) || snapshotAt || Date.now(),
    nextPage: json.meta?.hasNext
      ? {
          page: pageNumber + 1,
          snapshotAt: Number(json.meta?.snapshotAt) || snapshotAt || Date.now(),
        }
      : undefined,
  };
};

const UserCatagoryLayout = () => {
  const navigationType = useNavigationType();
  const location = useLocation();
  const { categoryName = "", "*": nestedPath = "" } = useParams();
  const { ref, inView } = useInView();
  const dispatch = useDispatch();
  const [sort, setSort] = useState("smart");
  const pathSegments = String(nestedPath || "")
    .split("/")
    .map((s) => s.trim())
    .filter(Boolean);

  // Storage keys
  const categoryKey = `${categoryName}:${nestedPath}:${sort}`;
  const getSnapshotKey = () => `category-snapshot:${categoryKey}`;
  const getItemsPerPageKey = () => "category-itemsPerPage";
  const getScrollKey = () => `scroll:${location.pathname}`;
  const getPagesKey = () => `category-pages:${categoryKey}`;

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

  // Reset snapshot when category/sort changes
  const prevCategoryKeyRef = useRef(categoryKey);
  useEffect(() => {
    if (prevCategoryKeyRef.current !== categoryKey) {
      prevCategoryKeyRef.current = categoryKey;
      const newTs = Date.now();
      sessionStorage.setItem(getSnapshotKey(), String(newTs));
      setSnapshotAt(newTs);
      // Reset restoration flags
      scrollRestoreDoneRef.current = false;
      isBackNavRef.current = false;
      setPagesRestored(true);
      sessionStorage.removeItem(getPagesKey());
    }
  }, [categoryKey]);

  useEffect(() => {
    const onResize = () => {
      const val = getItemsPerPage();
      setItemsPerPage(val);
      sessionStorage.setItem(getItemsPerPageKey(), String(val));
    };
    window.addEventListener("resize", onResize, { passive: true });
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isFetching,
    isLoading,
    isError,
    error,
  } = useInfiniteQuery({
    queryKey: ["products-infinite", categoryName, nestedPath, sort, itemsPerPage, snapshotAt],
    queryFn: fetchProducts,
    initialPageParam: { page: 1, snapshotAt },
    getNextPageParam: (lastPage) => lastPage.nextPage,
    staleTime: 1000 * 60 * 5,
    gcTime: 1000 * 60 * 30,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
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
    if (isLoading) return;
    if (isFetchingNextPage) return;

    const savedPagesCount = getSavedPagesCount();
    
    if (currentPagesCount < savedPagesCount && hasNextPage) {
      fetchNextPage();
    } else {
      setPagesRestored(true);
    }
  }, [isLoading, currentPagesCount, hasNextPage, isFetchingNextPage, fetchNextPage, pagesRestored]);

  useEffect(() => {
    // Only trigger infinite scroll for normal navigation, not during back nav page restoration
    if (isBackNavRef.current && !pagesRestored) return;
    if (inView && hasNextPage && !isFetchingNextPage) fetchNextPage();
  }, [inView, hasNextPage, isFetchingNextPage, fetchNextPage, pagesRestored]);

  const uniqueProducts = useMemo(() => {
    const seen = new Set();
    const rows = [];
    const pages = Array.isArray(data?.pages) ? data.pages : [];

    for (const page of pages) {
      const items = Array.isArray(page?.data) ? page.data : [];
      for (const product of items) {
        const pid = String(product?.id ?? "");
        if (!pid || seen.has(pid)) continue;
        seen.add(pid);
        rows.push(product);
      }
    }
    return rows;
  }, [data]);

  // Scroll restoration - must happen AFTER all pages are restored
  useEffect(() => {
    const key = getScrollKey();
    scrollKeyRef.current = key;

    if (isLoading || uniqueProducts.length === 0) return;

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
  }, [isLoading, uniqueProducts.length, location.pathname, pagesRestored]);

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

  const handleAddToCartClick = (product, qty) => {
    if (!canAddToCart(product?.id)) {
      message.info("Already added. Please wait a moment.");
      return false;
    }
    fetch(`http://localhost:3001/api/track/add-to-cart/${product.id}`, {
      method: "POST",
    }).catch(() => {});

    dispatch(
      addToCart({
        id: product.id,
        name: product.name,
        price: product.price,
        merchantId: product.merchantId,
        imageUrl: product.images?.[0] || product.imageUrl?.[0] || product.imageUrl,
        stock: product.stock,
        qty,
      })
    );
    message.success(`${qty} ${product.name} added to cart`);
    return true;
  };

  if (isLoading) {
    return (
      <div className="container mx-auto px-2 py-6 pb-20">
        <SkeletonStyles />
        <div className="mb-4 px-1">
          <div className="space-y-2">
            <SkeletonBlock height={18} width="240px" rounded="rounded-xl" />
            <SkeletonBlock height={10} width="140px" />
          </div>
        </div>
        <ProductGridSkeleton count={GRID_SKELETON_COUNT} />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="p-4 text-red-600 text-sm">
        Error: {error?.message || "Something went wrong"}
      </div>
    );
  }

  const totalItems = data?.pages?.[0]?.total || 0;
  const title = [categoryName, ...pathSegments].filter(Boolean).join(" / ");
  const hasProducts = uniqueProducts.length > 0;

  return (
    <div className="container mx-auto px-2 py-6 pb-20">
      <div className="flex flex-wrap items-end justify-between gap-3 mb-4 px-1">
        <h2 className="text-xs md:text-lg font-bold text-gray-800">
          {title}
          <span className="text-sm font-normal text-gray-500 ml-2">({totalItems} items)</span>
        </h2>

        <div className="flex items-center gap-2">
          <label htmlFor="category-sort" className="text-sm text-gray-600">
            Sort by
          </label>
          <select
            id="category-sort"
            value={sort}
            onChange={(e) => setSort(e.target.value)}
            className="h-9 rounded-md border border-gray-300 px-3 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="smart">Best Match</option>
            <option value="popular">Most Popular</option>
            <option value="rating">Top Rated</option>
            <option value="discount">Best Discount</option>
            <option value="newest">Newest</option>
            <option value="price_low">Price: Low to High</option>
            <option value="price_high">Price: High to Low</option>
          </select>
        </div>
      </div>

      {isFetching && !isFetchingNextPage && (
        <div className="px-1 mb-3">
          <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden">
            <div className="h-full w-1/3 bg-gradient-to-r from-orange-400 via-rose-400 to-amber-400 animate-pulse" />
          </div>
        </div>
      )}

      {hasProducts ? (
        <div
          className={`grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2 md:gap-3 mb-6 transition-opacity duration-300 ${
            isFetching && !isFetchingNextPage ? "opacity-70" : "opacity-100"
          }`}
        >
          {uniqueProducts.map((product) => (
            <ProductCard
              key={product.id}
              product={product}
              onAddToCart={handleAddToCartClick}
            />
          ))}
        </div>
      ) : (
        <div className="mx-1 mt-2 mb-4 min-h-[46vh] rounded-2xl border border-sky-100 bg-gradient-to-br from-white via-sky-50 to-cyan-50 px-5 py-10 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-white text-sky-600 shadow-sm">
            <SearchOutlined style={{ fontSize: 24 }} />
          </div>
          <p className="text-lg font-semibold text-gray-800">No products in this category</p>
          <p className="mt-2 text-sm text-gray-600">
            {title || "Selected category"} currently has no available items.
          </p>
        </div>
      )}

      {isFetching && !isFetchingNextPage ? (
        <>
          <SkeletonStyles />
          <ProductGridSkeleton count={6} />
        </>
      ) : null}

      {isFetchingNextPage ? (
        <>
          <SkeletonStyles />
          <ProductGridSkeleton count={6} />
        </>
      ) : null}

      {hasProducts ? (
        <div className="flex justify-between items-center px-1 text-xs text-gray-500 mb-2">
          <span>Loaded: {uniqueProducts.length}</span>
          <span>Total: {totalItems}</span>
        </div>
      ) : null}

      <div ref={ref} className="flex justify-center py-6 h-16">
        {isFetchingNextPage && (
          <div className="flex items-center space-x-2 text-blue-600">
            <span className="w-2 h-2 bg-blue-600 rounded-full animate-bounce"></span>
            <span className="w-2 h-2 bg-blue-600 rounded-full animate-bounce delay-75"></span>
            <span className="w-2 h-2 bg-blue-600 rounded-full animate-bounce delay-150"></span>
          </div>
        )}
        {!hasNextPage && !isLoading && hasProducts && (
          <span className="text-xs text-gray-400 font-medium">No more products</span>
        )}
      </div>
    </div>
  );
};

export default UserCatagoryLayout;
