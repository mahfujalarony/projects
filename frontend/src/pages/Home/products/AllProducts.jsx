import React, { useEffect, useRef, useState, useMemo } from "react";
import { useNavigationType, useSearchParams, useLocation } from "react-router-dom";
import { useInfiniteQuery } from "@tanstack/react-query";
import { useInView } from "react-intersection-observer";
import { useDispatch } from "react-redux";
import { addToCart } from "../../../redux/cartSlice";
import ProductCard from "../../../components/common/ProductCart";
import { message, Skeleton } from "antd";
import  { API_BASE_URL } from "../../../config/env";
import { canAddToCart } from "../../../utils/cartAddGuard";

const API_BASE = `${API_BASE_URL}`;
const getItemsPerPage = () => (window.innerWidth < 768 ? 40 : 60);

const fetchProducts = async ({ pageParam = 1, queryKey }) => {
  const [, sort, mode, itemsPerPage, snapshotAt] = queryKey;
  const safeMode = mode === "all" ? "all" : "unique";
  const url = `${API_BASE}/api/products?page=${pageParam}&limit=${Number(itemsPerPage) || 60}&sort=${encodeURIComponent(sort)}&mode=${safeMode}${snapshotAt ? `&snapshotAt=${snapshotAt}` : ""}`;
  const response = await fetch(url);

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err?.message || "Failed to load products");
  }

  const j = await response.json();

  return {
    data: j.data || [],
    total: j?.meta?.total || 0,
    nextPage: j?.meta?.hasNext ? pageParam + 1 : undefined,
  };
};

const AllProducts = () => {
  const navigationType = useNavigationType();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const { ref, inView } = useInView();
  const dispatch = useDispatch();
  const initialSort = searchParams.get("sort") || "smart";
  const [sort, setSort] = useState(() => initialSort);

  // Storage keys
  const getSnapshotKey = (s) => `products-snapshot:${s}`;
  const getItemsPerPageKey = () => "products-itemsPerPage";
  const getScrollKey = () => `scroll:${location.pathname}${location.search}`;
  const getPagesKey = (s) => `products-pages:${s}`;

  // Always try to restore from sessionStorage first - only create new if not exists
  const [snapshotAt, setSnapshotAt] = useState(() => {
    const saved = sessionStorage.getItem(getSnapshotKey(initialSort));
    if (saved) {
      return Number(saved);
    }
    const ts = Date.now();
    sessionStorage.setItem(getSnapshotKey(initialSort), String(ts));
    return ts;
  });

  // Persist itemsPerPage - always restore if exists
  const [itemsPerPage, setItemsPerPage] = useState(() => {
    const saved = sessionStorage.getItem(getItemsPerPageKey());
    if (saved) return Number(saved);
    const val = getItemsPerPage();
    sessionStorage.setItem(getItemsPerPageKey(), String(val));
    return val;
  });

  // Get saved pages count for restoration
  const getSavedPagesCount = () => {
    const saved = sessionStorage.getItem(getPagesKey(sort));
    return saved ? Number(saved) : 1;
  };

  const scrollKeyRef = useRef(getScrollKey());
  const scrollRestoreDoneRef = useRef(false);
  const isBackNavRef = useRef(navigationType === "POP");
  const [pagesRestored, setPagesRestored] = useState(!isBackNavRef.current);

  // reset snapshot when sort changes so we get a fresh ranking
  const prevSortRef = useRef(sort);
  useEffect(() => {
    if (prevSortRef.current !== sort) {
      prevSortRef.current = sort;
      const newTs = Date.now();
      sessionStorage.setItem(getSnapshotKey(sort), String(newTs));
      setSnapshotAt(newTs);
      // Reset scroll restoration for new sort
      scrollRestoreDoneRef.current = false;
      isBackNavRef.current = false;
      setPagesRestored(true);
      // Clear saved pages for new sort
      sessionStorage.removeItem(getPagesKey(sort));
    }
  }, [sort]);

  // sync sort when URL changes (e.g. navigating from home page "View All" links)
  useEffect(() => {
    const urlSort = searchParams.get("sort") || "smart";
    if (urlSort !== sort) setSort(urlSort);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  // keep URL in sync when sort changes — always store sort in URL
  useEffect(() => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (sort) next.set("sort", sort);
      else next.delete("sort");
      return next;
    }, { replace: true });
  }, [sort]);

  useEffect(() => {
    const onResize = () => {
      const val = getItemsPerPage();
      setItemsPerPage(val);
      sessionStorage.setItem(getItemsPerPageKey(), String(val));
    };
    window.addEventListener("resize", onResize, { passive: true });
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isFetching, status, error } =
    useInfiniteQuery({
      queryKey: ["public-products-infinite", sort, "all", itemsPerPage, snapshotAt],
      queryFn: fetchProducts,
      initialPageParam: 1,
      getNextPageParam: (lastPage) => lastPage.nextPage,
      staleTime: 1000 * 60 * 5,
      gcTime: 1000 * 60 * 30,
      refetchOnMount: false,
      refetchOnWindowFocus: false,
      placeholderData: (previousData) => previousData,
    });

  const currentPagesCount = data?.pages?.length || 0;

  const allProducts = useMemo(() => {
    const map = new Map();
    for (const group of data?.pages || []) {
      for (const product of group.data || []) {
        if (product?.id && !map.has(product.id)) map.set(product.id, product);
      }
    }
    return Array.from(map.values());
  }, [data]);

  // Save pages count whenever it changes (for scroll restoration on back nav)
  useEffect(() => {
    if (currentPagesCount > 0 && !isBackNavRef.current) {
      sessionStorage.setItem(getPagesKey(sort), String(currentPagesCount));
    }
  }, [currentPagesCount, sort]);

  // On back navigation, restore all pages that were previously loaded
  useEffect(() => {
    if (!isBackNavRef.current || pagesRestored) return;
    if (status !== "success") return;
    if (isFetchingNextPage) return;

    const savedPagesCount = getSavedPagesCount();
    
    if (currentPagesCount < savedPagesCount && hasNextPage) {
      // Need to load more pages to restore state
      fetchNextPage();
    } else {
      // All pages restored
      setPagesRestored(true);
    }
  }, [status, currentPagesCount, hasNextPage, isFetchingNextPage, fetchNextPage, pagesRestored]);

  // Scroll restoration - must happen AFTER all pages are restored
  useEffect(() => {
    const key = getScrollKey();
    scrollKeyRef.current = key;

    if (status !== "success" || allProducts.length === 0) return;

    // For back navigation, wait until pages are restored
    if (isBackNavRef.current && !pagesRestored) return;

    // Check if we should restore scroll (back navigation)
    const savedScroll = sessionStorage.getItem(key);
    const shouldRestore = isBackNavRef.current && savedScroll && !scrollRestoreDoneRef.current;

    if (shouldRestore) {
      const y = Number(savedScroll);
      if (Number.isFinite(y) && y > 0) {
        // Smart scroll restoration - retry until we reach target or give up
        let attempts = 0;
        const maxAttempts = 20;
        
        const tryScroll = () => {
          attempts++;
          window.scrollTo({ top: y, behavior: "instant" });
          
          // Check if we reached near the target (within 100px tolerance)
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
  }, [status, allProducts.length, location.pathname, location.search, pagesRestored]);

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

  useEffect(() => {
    // Only trigger infinite scroll for normal navigation, not during back nav page restoration
    if (isBackNavRef.current && !pagesRestored) return;
    if (inView && hasNextPage && !isFetchingNextPage) fetchNextPage();
  }, [inView, hasNextPage, isFetchingNextPage, fetchNextPage, pagesRestored]);

  const handleAddToCartClick = (product, qty) => {
    if (!canAddToCart(product?.id)) {
      message.info("Already added. Please wait a moment.");
      return false;
    }
    const numericQty = Number(qty || 1);
      fetch(`${API_BASE}/api/track/add-to-cart/${product.id}`, {
    method: "POST",
  }).catch(() => {});

    dispatch(
      addToCart({
        id: product.id,
        name: product.name,
        price: product.price,
        imageUrl: product.images?.[0],
        merchantId: product.merchantId,
        stock: product.stock,
        qty: numericQty,
      })
    );

    message.success(`${numericQty} ${product.name} added to cart`);
    return true;
  };

  if (status === "pending") {
    return (
      <div className="container mx-auto px-2 py-6 pb-20">
        <div className="mb-4 px-1">
          <Skeleton.Input active size="small" className="!w-44" />
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2 md:gap-3 mb-6">
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="bg-white rounded-lg border border-gray-100 p-2">
              <Skeleton.Image active className="!w-full !h-28 md:!h-32" />
              <div className="mt-2">
                <Skeleton active paragraph={{ rows: 2 }} title={false} />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="h-screen flex justify-center items-center text-red-600">
        {error?.message || "Something went wrong"}
      </div>
    );
  }

  const totalItems = data?.pages?.[0]?.total || 0;
  return (
    <div className="container mx-auto px-2 py-6 pb-20">
      <div className="flex flex-wrap items-end justify-between gap-3 mb-4 px-1">

        <div className="flex items-center gap-2">
          <label htmlFor="product-sort" className="text-sm text-gray-600">
            Sort by
          </label>
          <select
            id="product-sort"
            value={sort}
            onChange={(e) => setSort(e.target.value)}
            className="h-9 rounded-md border border-gray-300 px-3 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="smart">Best Match</option>
            <option value="trending">Trending</option>
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
            <div className="h-full w-1/3 bg-blue-500 animate-pulse" />
          </div>
        </div>
      )}

      <div
        className={`grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2 md:gap-3 mb-6 transition-opacity duration-300 ${
          isFetching && !isFetchingNextPage ? "opacity-70" : "opacity-100"
        }`}
      >
        {allProducts.map((product) => (
          <ProductCard
            key={product.id}
            product={product}
            onAddToCart={handleAddToCartClick}
          />
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

        {!hasNextPage && (
          <span className="text-xs text-gray-400 font-medium">
            No more products
          </span>
        )}
      </div>
    </div>
  );
};

export default AllProducts;
