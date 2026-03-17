import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { Spin, Alert, message, Avatar, Rate, Typography, Empty, Input, Select } from "antd";
import { UserOutlined, ShopOutlined, EnvironmentOutlined, CalendarOutlined, CheckCircleFilled, SearchOutlined } from "@ant-design/icons";
import { useInfiniteQuery, keepPreviousData } from "@tanstack/react-query";
import { useInView } from "react-intersection-observer";
import ProductCard from "./ProductCart";
import { useDispatch } from "react-redux";
import { addToCart } from "../../redux/cartSlice";
import { canAddToCart } from "../../utils/cartAddGuard";
import { normalizeImageUrl } from "../../utils/imageUrl";
import { API_BASE_URL } from "../../config/env";

const { Title, Text, Paragraph } = Typography;
const PAGE_SIZE = 24;
const API_BASE = API_BASE_URL;

const Saller = () => {
  const { merchantId } = useParams();
  const dispatch = useDispatch();
  const { ref, inView } = useInView();

  // typing state (no fetch on keystroke)
  const [searchInput, setSearchInput] = useState("");
  // committed state (Enter triggers fetch)
  const [searchTerm, setSearchTerm] = useState("");

  const [sortBy, setSortBy] = useState("newest");

  // stable ref so products never visually vanish between queries
  const stableProductsRef = useRef([]);
  const stableMerchantRef = useRef(null);
  const stableMetaRef = useRef({ total: 0, page: 1, totalPages: 1, limit: PAGE_SIZE });
  const productSectionRef = useRef(null);

  const scrollToProducts = useCallback(() => {
    productSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  // commit search only on Enter
  const submitSearch = useCallback(() => {
    const next = searchInput.trim();
    if (next === searchTerm) return;
    scrollToProducts();
    setSearchTerm(next);
  }, [searchInput, searchTerm]);

  // clear search (x press / input empty)
  const clearCommittedSearch = useCallback(() => {
    if (!searchTerm) return;
    scrollToProducts();
    setSearchTerm("");
  }, [searchTerm]);

  const fetchStorefront = useCallback(
    async ({ pageParam = 1 }) => {
      const params = new URLSearchParams({
        page: pageParam,
        limit: PAGE_SIZE,
        sort: sortBy,
      });

      if (searchTerm) params.set("search", searchTerm);

      const res = await fetch(
        `${API_BASE}/api/merchant/${merchantId}/storefront?${params.toString()}`
      );

      const contentType = res.headers.get("content-type") || "";
      if (!contentType.includes("application/json")) {
        throw new Error(`Server returned ${res.status} ${res.statusText} (invalid API response)`);
      }

      const json = await res.json();
      if (!res.ok || json?.success === false) {
        throw new Error(json?.message || "Failed to load store");
      }

      const products = Array.isArray(json.products) ? json.products : [];
      const meta = json.meta || {};
      const currentPage = Number(meta.page || pageParam);
      const totalPages = Number(meta.totalPages || 1);

      return {
        merchant: json.merchant || null,
        products,
        meta: {
          total: Number(meta.total || 0),
          page: currentPage,
          limit: Number(meta.limit || PAGE_SIZE),
          totalPages,
        },
        nextPage: currentPage < totalPages ? currentPage + 1 : undefined,
      };
    },
    [merchantId, searchTerm, sortBy]
  );

  const {
    data,
    status,
    error,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isFetching,
    isPlaceholderData,
  } = useInfiniteQuery({
    queryKey: ["merchant-storefront", merchantId, searchTerm, sortBy],
    queryFn: fetchStorefront,
    initialPageParam: 1,
    getNextPageParam: (lastPage) => lastPage.nextPage,
    enabled: !!merchantId,
    staleTime: 1000 * 60 * 2,
    gcTime: 1000 * 60 * 30,
    placeholderData: keepPreviousData,
    refetchOnWindowFocus: false,
  });

  useEffect(() => {
    if (merchantId) window.scrollTo(0, 0);
  }, [merchantId]);

  useEffect(() => {
    if (inView && hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  }, [inView, hasNextPage, isFetchingNextPage, fetchNextPage]);

  const handleAddToCart = (product, qty) => {
    if (!canAddToCart(product?.id)) {
      message.info("Already added. Please wait a moment.");
      return false;
    }
    const priceNum = Number(product?.price);
    if (!Number.isFinite(priceNum) || priceNum < 0) {
      message.error("Invalid product price. Please refresh and try again.");
      return false;
    }
    dispatch(
      addToCart({
        id: product.id,
        name: product.name,
        price: priceNum,
        merchantId: product.merchantId,
        imageUrl: product.images?.[0],
        stock: product.stock,
        qty,
      })
    );
    message.success(`${qty} x ${product.name} added to cart`);
    return true;
  };

  const merchant = data?.pages?.[0]?.merchant || stableMerchantRef.current;
  const meta = data?.pages?.[0]?.meta || stableMetaRef.current;

  // keep stableRefs updated when fresh data arrives
  useEffect(() => {
    if (data?.pages?.[0]?.merchant) stableMerchantRef.current = data.pages[0].merchant;
    if (data?.pages?.[0]?.meta) stableMetaRef.current = data.pages[0].meta;
  }, [data]);

  const products = useMemo(() => {
    const map = new Map();
    for (const page of data?.pages || []) {
      for (const p of page?.products || []) {
        if (!p?.id) continue;
        if (!map.has(p.id)) map.set(p.id, p);
      }
    }
    const fresh = Array.from(map.values());
    if (fresh.length > 0) {
      stableProductsRef.current = fresh;
    }
    return fresh.length > 0 ? fresh : stableProductsRef.current;
  }, [data]);

  const processProduct = (p) => {
    let imgs = p.images;
    if (typeof imgs === "string") {
      try {
        imgs = JSON.parse(imgs);
      } catch {
        imgs = [imgs];
      }
    }
    const imgArray = Array.isArray(imgs) ? imgs : [];
    return {
      ...p,
      images: imgArray.map((img) => normalizeImageUrl(img)),
    };
  };

  if (status === "pending") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Spin size="large" tip="Loading store..." />
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="p-8 max-w-4xl mx-auto min-h-screen">
        <Alert type="error" message="Error" description={error?.message || "Failed to load store"} showIcon />
      </div>
    );
  }

  if (!merchant) {
    return (
      <div className="p-8 max-w-4xl mx-auto min-h-screen">
        <Alert type="warning" message="Merchant not found" showIcon />
      </div>
    );
  }

  const profile = merchant.merchantProfile || {};
  const joinedDate = new Date(merchant.createdAt).toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const avgRating = Number(profile.averageRating || 0);
  const totalReviews = Number(profile.totalReviews || 0);
  const merchantName = merchant.name || "Merchant";

  return (
    <div className="min-h-screen bg-slate-50 pb-12">
      {/* Shimmer progress bar keyframe */}
      <style>{`
        @keyframes shimmerSlide {
          0%   { left: -33%; }
          100% { left: 100%; }
        }
      `}</style>

      {/* Hero / Cover Area */}
      <div className="relative h-48 md:h-64 w-full bg-gradient-to-r from-slate-800 via-slate-700 to-slate-900 overflow-hidden">
        <div className="absolute inset-0 opacity-20 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')]"></div>
        <div className="absolute inset-0 bg-gradient-to-t from-slate-900/60 to-transparent"></div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 -mt-20 relative z-10">
        <div className="bg-white rounded-2xl shadow-xl border border-slate-100 overflow-hidden">
          <div className="p-6 md:p-8">
            <div className="flex flex-col md:flex-row gap-6 items-start">
              {/* Avatar */}
              <div className="relative shrink-0 mx-auto md:mx-0">
                <div className="h-32 w-32 md:h-40 md:w-40 rounded-full p-1 bg-white shadow-md">
                  <Avatar
                    size={{ xs: 118, sm: 118, md: 150, lg: 150, xl: 150, xxl: 150 }}
                    src={normalizeImageUrl(merchant.imageUrl)}
                    icon={<UserOutlined />}
                    className="w-full h-full object-cover rounded-full border border-slate-100 bg-slate-50"
                  />
                </div>
                <div
                  className="absolute bottom-2 right-2 bg-blue-500 text-white p-1.5 rounded-full border-4 border-white shadow-sm"
                  title="Verified Merchant"
                >
                  <CheckCircleFilled className="text-lg" />
                </div>
              </div>

              {/* Info */}
              <div className="flex-1 text-center md:text-left w-full">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div>
                    <h1 className="text-2xl md:text-3xl font-bold text-slate-900 flex items-center justify-center md:justify-start gap-2">
                      {merchantName}
                      <CheckCircleFilled className="text-blue-500 text-xl" />
                    </h1>
                    <div className="flex items-center justify-center md:justify-start gap-2 mt-2 text-sm text-slate-600">
                      <span className="flex items-center gap-1">
                        <ShopOutlined /> Merchant Store
                      </span>
                      <span className="w-1 h-1 rounded-full bg-slate-300"></span>
                      <span>ID: #{merchant.id}</span>
                    </div>
                  </div>

                  <div className="flex flex-col items-center md:items-end gap-1">
                    <div className="flex items-center gap-1.5 bg-amber-50 px-3 py-1.5 rounded-lg border border-amber-100">
                      <span className="text-amber-500 font-bold text-lg">{avgRating.toFixed(1)}</span>
                      <Rate disabled allowHalf value={avgRating} style={{ fontSize: 14, color: "#f59e0b" }} />
                      <span className="text-xs text-slate-500 ml-1">({totalReviews} reviews)</span>
                    </div>
                  </div>
                </div>

                <div className="mt-6 flex flex-wrap items-center justify-center md:justify-start gap-4 text-sm text-slate-600">
                  {profile.YourAddress && (
                    <div className="flex items-center gap-1.5 bg-slate-50 px-3 py-1.5 rounded-full border border-slate-200">
                      <EnvironmentOutlined className="text-slate-400" />
                      {profile.YourAddress}
                    </div>
                  )}
                  <div className="flex items-center gap-1.5 bg-slate-50 px-3 py-1.5 rounded-full border border-slate-200">
                    <CalendarOutlined className="text-slate-400" />
                    Joined {joinedDate}
                  </div>
                  <div className="flex items-center gap-1.5 bg-slate-50 px-3 py-1.5 rounded-full border border-slate-200">
                    <ShopOutlined className="text-slate-400" />
                    {meta.total} Products
                  </div>
                </div>

                {profile.description && (
                  <div className="mt-6 border-t border-slate-100 pt-4">
                    <Paragraph
                      className="text-slate-600 max-w-4xl mx-auto md:mx-0 mb-0 text-sm leading-relaxed"
                      ellipsis={{ rows: 3, expandable: true, symbol: "more" }}
                    >
                      {profile.description}
                    </Paragraph>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div ref={productSectionRef} className="max-w-7xl mx-auto px-4 py-8 scroll-mt-4">
        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm p-4 md:p-5 mb-5">
          <div className="flex flex-col gap-3">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <div>
                <Title level={4} style={{ margin: 0 }}>
                  All Products
                </Title>
                <Text type="secondary" className="text-xs md:text-sm">
                  Browse products from this seller
                </Text>
              </div>
              <div className="inline-flex items-center gap-2 rounded-full bg-slate-50 px-3 py-1.5 border border-slate-200 text-xs md:text-sm">
                <span className="text-slate-500">Loaded</span>
                <span className="font-semibold text-slate-900">{products.length}</span>
                <span className="text-slate-300">/</span>
                <span className="font-semibold text-slate-900">{meta.total}</span>
              </div>
            </div>

            {/* Search + Sort */}
            <div className="flex flex-col sm:flex-row gap-2">
              <Input
                allowClear
                prefix={<SearchOutlined className="text-slate-400" />}
                placeholder={`Search in ${merchantName}'s store...`}
                value={searchInput}
                onChange={(e) => {
                  const v = e.target.value;
                  setSearchInput(v);

                  // ✅ user clear (X) / empty input => reset committed search (smooth)
                  if (v === "") {
                    clearCommittedSearch();
                  }
                }}
                onPressEnter={submitSearch} // ✅ only Enter triggers fetch
                className="flex-1"
                size="middle"
              />
              <Select
                value={sortBy}
                onChange={(v) => {
                  scrollToProducts();
                  setSortBy(v);
                }}
                size="middle"
                style={{ minWidth: 148 }}
                options={[
                  { value: "newest",     label: "Newest first" },
                  { value: "popular",    label: "Most popular" },
                  { value: "rating",     label: "Top rated" },
                  { value: "price_low",  label: "Price: low → high" },
                  { value: "price_high", label: "Price: high → low" },
                  { value: "oldest",     label: "Oldest first" },
                ]}
              />
            </div>

            {searchTerm && (
              <p className="text-xs text-slate-500 m-0">
                {isFetching && !isFetchingNextPage
                  ? "Searching..."
                  : `${meta.total} result${meta.total !== 1 ? "s" : ""} for "`}
                <strong>{searchTerm}</strong>
                {!isFetching || isFetchingNextPage ? `"` : ""}
              </p>
            )}
          </div>
        </div>

        {/* Shimmer progress bar while searching / sorting */}
        {isFetching && !isFetchingNextPage && products.length > 0 && (
          <div className="relative h-1 mb-4 rounded-full overflow-hidden bg-slate-100">
            <div
              className="absolute inset-y-0 left-0 w-1/3 rounded-full bg-gradient-to-r from-blue-400 to-blue-600"
              style={{ animation: "shimmerSlide 1.2s ease-in-out infinite" }}
            />
          </div>
        )}

        {products.length === 0 && !isFetching ? (
          <div className="py-12 bg-white rounded-2xl border border-dashed border-slate-300 flex justify-center">
            <Empty description={searchTerm ? `No products found for "${searchTerm}"` : "No products found in this store."} />
          </div>
        ) : (
          <>
            <div
              className={`grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 md:gap-4 transition-opacity duration-300 ${
                isFetching && !isFetchingNextPage && !isPlaceholderData ? "opacity-50" : "opacity-100"
              }`}
            >
              {products.map((p) => (
                <ProductCard
                  key={p.id}
                  product={processProduct(p)}
                  onAddToCart={(_, qty) => handleAddToCart(p, qty)}
                />
              ))}
            </div>

            <div ref={ref} className="mt-8 flex justify-center py-4 h-16">
              {isFetchingNextPage && (
                <div className="flex items-center space-x-2 text-blue-600">
                  <span className="w-2 h-2 bg-blue-600 rounded-full animate-bounce"></span>
                  <span className="w-2 h-2 bg-blue-600 rounded-full animate-bounce delay-75"></span>
                  <span className="w-2 h-2 bg-blue-600 rounded-full animate-bounce delay-150"></span>
                </div>
              )}
              {!hasNextPage && products.length > 0 && (
                <span className="text-xs text-gray-400 font-medium">All products loaded</span>
              )}
              {isFetching && !isFetchingNextPage && hasNextPage && (
                <span className="text-xs text-gray-400 font-medium">Loading updates...</span>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default Saller;
