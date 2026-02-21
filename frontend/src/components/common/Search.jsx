import React, { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { useInfiniteQuery } from "@tanstack/react-query";
import { useInView } from "react-intersection-observer";
import { useDispatch } from "react-redux";
import { addToCart } from "../../redux/cartSlice";
import ProductCard from "./ProductCart";
import { message, Skeleton } from "antd";
import axios from "axios";
import { API_BASE_URL } from "../../config/env";

const API_BASE = API_BASE_URL;
const ITEMS_PER_PAGE = 24;

const fetchSearchProducts = async ({ pageParam = 1, queryKey }) => {
  const [, routeQuery, sort] = queryKey;

  const res = await axios.get(`${API_BASE}/api/products/search`, {
    params: {
      query: routeQuery,
      sort,
      page: pageParam,
      limit: ITEMS_PER_PAGE,
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
  const normalizedQuery = (routeQuery || "").trim();
  const dispatch = useDispatch();
  const { ref, inView } = useInView();
  const [sort, setSort] = useState("smart");

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
    queryKey: ["products-search-infinite", normalizedQuery, sort],
    queryFn: fetchSearchProducts,
    initialPageParam: 1,
    getNextPageParam: (lastPage) => lastPage.nextPage,
    staleTime: 1000 * 60 * 5,
    gcTime: 1000 * 60 * 30,
    refetchOnWindowFocus: false,
    enabled: normalizedQuery.length > 0,
    placeholderData: (previousData) => previousData,
  });

  useEffect(() => {
    if (inView && hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
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
        merchantId: product.merchantId,
        imageUrl: product.images?.[0],
        qty: numericQty,
      })
    );
    message.success(`${numericQty} ${product.name} added to cart`);
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

  const totalItems = data?.pages?.[0]?.total || 0;

  if (!normalizedQuery) {
    return (
      <div className="container mx-auto px-2 py-6 pb-20 min-h-screen bg-gray-50">
        <div className="bg-white border border-gray-200 rounded-2xl p-8 text-center mx-1">
          <p className="text-gray-900 font-semibold text-lg">Type something to search</p>
          <p className="text-gray-500 text-sm mt-1">Try product name, category, or brand keyword.</p>
        </div>
      </div>
    );
  }

  if (status === "pending") {
    return (
      <div className="container mx-auto px-2 py-6 pb-20 min-h-screen bg-gray-50">
        <div className="mb-4 px-1">
          <Skeleton.Input active size="small" className="!w-56" />
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2 md:gap-3">
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
      <div className="container mx-auto px-2 py-6 pb-20 min-h-screen bg-gray-50">
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
    <div className="container mx-auto px-2 py-6 pb-20 min-h-screen bg-gray-50">
      <div className="flex flex-wrap items-end justify-between gap-3 mb-4 px-1">
        <div>
          <h2 className="text-xs font-bold text-gray-800">Search Results</h2>
          <div className="text-xs text-gray-600 mt-1">
            <span className="font-normal text-gray-500">({totalItems} items)</span>
            <span className="ml-2">
              for <span className="font-semibold text-gray-800">"{normalizedQuery}"</span>
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <label htmlFor="search-sort" className="text-sm text-gray-600">
            Sort by
          </label>
          <select
            id="search-sort"
            value={sort}
            onChange={(e) => setSort(e.target.value)}
            className="h-9 rounded-md border border-gray-300 px-3 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="smart">Best Match</option>
            <option value="newest">Newest</option>
            <option value="price_low">Price: Low to High</option>
            <option value="price_high">Price: High to Low</option>
            <option value="rating">Top Rated</option>
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

      {products.length > 0 ? (
        <>
          <div
            className={`grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2 md:gap-3 mb-6 transition-opacity duration-300 ${
              isFetching && !isFetchingNextPage ? "opacity-70" : "opacity-100"
            }`}
          >
            {products.map((product) => (
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
        <div className="bg-white border border-gray-200 rounded-2xl p-8 text-center mx-1">
          <p className="text-gray-900 font-semibold text-lg">No products found</p>
          <p className="text-gray-500 text-sm mt-1">No match found for "{normalizedQuery}".</p>
          <div className="mt-4 text-sm text-gray-600">
            <p className="font-medium text-gray-800">Try:</p>
            <ul className="mt-2 space-y-1">
              <li>- Check spelling</li>
              <li>- Use shorter keywords</li>
              <li>- Search by category or product type</li>
            </ul>
          </div>
        </div>
      )}
    </div>
  );
};

export default Search;
