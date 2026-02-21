import React, { useCallback, useEffect, useMemo } from "react";
import { useParams } from "react-router-dom";
import { Spin, Alert, message, Avatar, Rate, Typography, Empty } from "antd";
import { UserOutlined, ShopOutlined, EnvironmentOutlined, CalendarOutlined } from "@ant-design/icons";
import { useInfiniteQuery } from "@tanstack/react-query";
import { useInView } from "react-intersection-observer";
import ProductCard from "./ProductCart";
import { useDispatch } from "react-redux";
import { addToCart } from "../../redux/cartSlice";
import { API_BASE_URL } from "../../config/env";

const { Title, Text, Paragraph } = Typography;
const API_BASE = API_BASE_URL;
const PAGE_SIZE = 24;

const getFullImageUrl = (imgPath) => {
  if (!imgPath) return null;
  const str = String(imgPath);
  if (str.startsWith("http")) return str;
  const cleanPath = str.replace(/\\/g, "/").replace(/^\/+|\/+$/g, "");
  return `${API_BASE}/${cleanPath}`;
};

const Saller = () => {
  const { merchantId } = useParams();
  const dispatch = useDispatch();
  const { ref, inView } = useInView();

  const fetchStorefront = useCallback(
    async ({ pageParam = 1 }) => {
      const res = await fetch(
        `${API_BASE}/api/merchant/${merchantId}/storefront?page=${pageParam}&limit=${PAGE_SIZE}`
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
    [merchantId]
  );

  const {
    data,
    status,
    error,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isFetching,
  } = useInfiniteQuery({
    queryKey: ["merchant-storefront", merchantId],
    queryFn: fetchStorefront,
    initialPageParam: 1,
    getNextPageParam: (lastPage) => lastPage.nextPage,
    enabled: !!merchantId,
    staleTime: 1000 * 60 * 2,
    gcTime: 1000 * 60 * 30,
    refetchOnWindowFocus: true,
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
  };

  const merchant = data?.pages?.[0]?.merchant || null;
  const meta = data?.pages?.[0]?.meta || { total: 0, page: 1, totalPages: 1, limit: PAGE_SIZE };

  const products = useMemo(() => {
    const map = new Map();
    for (const page of data?.pages || []) {
      for (const p of page?.products || []) {
        if (!p?.id) continue;
        if (!map.has(p.id)) map.set(p.id, p);
      }
    }
    return Array.from(map.values());
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
      images: imgArray.map(getFullImageUrl),
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

  return (
    <div className="min-h-screen bg-gray-50 pb-12">
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 py-8">
          <div className="flex flex-col md:flex-row items-center md:items-start gap-6">
            <Avatar
              size={120}
              src={getFullImageUrl(merchant.imageUrl)}
              icon={<UserOutlined />}
              className="border-4 border-white shadow-md bg-gray-200"
            />
            <div className="text-center md:text-left flex-1">
              <Title level={2} style={{ marginBottom: 4, marginTop: 0 }}>
                {merchant.name}
              </Title>

              <div className="flex flex-wrap items-center justify-center md:justify-start gap-4 text-gray-500 mb-4 text-sm">
                <span className="flex items-center gap-1 bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full">
                  <ShopOutlined /> Merchant
                </span>
                {profile.YourAddress && (
                  <span className="flex items-center gap-1">
                    <EnvironmentOutlined /> {profile.YourAddress}
                  </span>
                )}
                <span className="flex items-center gap-1">
                  <CalendarOutlined /> Joined {joinedDate}
                </span>
              </div>

              {profile.description && (
                <Paragraph
                  className="text-gray-600 max-w-2xl mx-auto md:mx-0"
                  ellipsis={{ rows: 2, expandable: true, symbol: "more" }}
                >
                  {profile.description}
                </Paragraph>
              )}

              <div className="flex items-center justify-center md:justify-start gap-6 mt-3 border-t pt-3 md:border-none md:pt-0">
                <div className="flex flex-col md:flex-row items-center gap-1">
                  <div className="flex items-center">
                    <Rate disabled allowHalf value={Number(profile.averageRating || 0)} style={{ fontSize: 14 }} />
                    <Text strong className="ml-2">
                      {Number(profile.averageRating || 0).toFixed(1)}
                    </Text>
                  </div>
                  <Text type="secondary" className="text-xs">
                    ({profile.totalReviews || 0} Reviews)
                  </Text>
                </div>
                <div className="h-4 w-px bg-gray-300 hidden md:block"></div>
                <div>
                  <Text strong>{meta.total}</Text> <Text type="secondary">Products</Text>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <Title level={4} style={{ margin: 0 }}>
            All Products
          </Title>
          <Text type="secondary">
            Loaded {products.length} / {meta.total}
          </Text>
        </div>

        {products.length === 0 ? (
          <div className="py-12 bg-white rounded-xl border border-dashed flex justify-center">
            <Empty description="No products found in this store." />
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 md:gap-4">
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
