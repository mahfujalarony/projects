import React, { useEffect, useState } from "react";
import { useNavigationType } from "react-router-dom";
import { useInfiniteQuery } from "@tanstack/react-query";
import { useInView } from "react-intersection-observer";
import { useDispatch } from "react-redux";
import { addToCart } from "../../../redux/cartSlice";
import ProductCard from "../../../components/common/ProductCart";
import { message, Skeleton } from "antd";
import  { API_BASE_URL } from "../../../config/env";

const API_BASE = `${API_BASE_URL}`;
const getItemsPerPage = () => (window.innerWidth < 768 ? 40 : 60);

const fetchProducts = async ({ pageParam = 1, queryKey }) => {
  const [, sort, itemsPerPage] = queryKey;
  const url = `${API_BASE}/api/products?page=${pageParam}&limit=${Number(itemsPerPage) || 60}&sort=${encodeURIComponent(sort)}&mode=all`;
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
  const { ref, inView } = useInView();
  const dispatch = useDispatch();
  const [sort, setSort] = useState("smart");
  const [itemsPerPage, setItemsPerPage] = useState(getItemsPerPage());

  useEffect(() => {
    const onResize = () => setItemsPerPage(getItemsPerPage());
    window.addEventListener("resize", onResize, { passive: true });
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isFetching, status, error } =
    useInfiniteQuery({
      queryKey: ["public-products-infinite", sort, "all", itemsPerPage],
      queryFn: fetchProducts,
      initialPageParam: 1,
      getNextPageParam: (lastPage) => lastPage.nextPage,
      staleTime: 1000 * 60 * 5,
      gcTime: 1000 * 60 * 30,
      refetchOnMount: true,
      refetchOnWindowFocus: false,
      placeholderData: (previousData) => previousData,
    });

  useEffect(() => {
    if (navigationType !== "POP") window.scrollTo(0, 0);
  }, [navigationType]);

  useEffect(() => {
    if (inView && hasNextPage && !isFetchingNextPage) fetchNextPage();
  }, [inView, hasNextPage, isFetchingNextPage, fetchNextPage]);

  const handleAddToCartClick = (product, qty) => {
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
        qty: numericQty,
      })
    );

    message.success(`${numericQty} ${product.name} added to cart`);
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
        {data?.pages.map((group, i) => (
          <React.Fragment key={i}>
            {group.data.map((product) => (
              <ProductCard
                key={product.id}
                product={product}
                onAddToCart={handleAddToCartClick}
              />
            ))}
          </React.Fragment>
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
