import React, { useEffect, useState } from "react";
import { useNavigationType, useParams } from "react-router-dom";
import { useInfiniteQuery } from "@tanstack/react-query";
import { useInView } from "react-intersection-observer";
import { useDispatch } from "react-redux";
import { addToCart } from "../../redux/cartSlice";
import ProductCard from "../common/ProductCart";
import { message, Skeleton } from "antd";

const ITEMS_PER_PAGE = 24;

const fetchProducts = async ({ pageParam = 1, queryKey }) => {
  const [, categoryName, subCategoryName, sort] = queryKey;

  const params = new URLSearchParams();
  params.set("page", String(pageParam));
  params.set("limit", String(ITEMS_PER_PAGE));
  params.set("sort", sort || "smart");

  if (categoryName?.trim()) params.set("category", categoryName.trim());
  if (subCategoryName?.trim()) params.set("subCategory", subCategoryName.trim());

  const response = await fetch(`http://localhost:3001/api/products?${params.toString()}`);

  if (!response.ok) throw new Error("Network response was not ok");

  const json = await response.json();

  return {
    data: json.data || [],
    total: json.meta?.total || 0,
    nextPage: json.meta?.hasNext ? pageParam + 1 : undefined,
  };
};

const UserCatagoryLayout = () => {
  const navigationType = useNavigationType();
  const { categoryName = "", subCategoryName = "" } = useParams();
  const { ref, inView } = useInView();
  const dispatch = useDispatch();
  const [sort, setSort] = useState("smart");

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
    queryKey: ["products-infinite", categoryName, subCategoryName, sort],
    queryFn: fetchProducts,
    initialPageParam: 1,
    getNextPageParam: (lastPage) => lastPage.nextPage,
    staleTime: 1000 * 60 * 5,
    gcTime: 1000 * 60 * 30,
    refetchOnMount: false,
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
        qty,
      })
    );
    message.success(`${qty} ${product.name} added to cart`);
  };

  if (isLoading) {
    return (
      <div className="container mx-auto px-2 py-6 pb-20">
        <div className="mb-4 px-1">
          <Skeleton.Input active size="small" className="!w-40" />
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

  if (isError) {
    return (
      <div className="p-4 text-red-600 text-sm">
        Error: {error?.message || "Something went wrong"}
      </div>
    );
  }

  const totalItems = data?.pages?.[0]?.total || 0;
  const title = subCategoryName ? `${categoryName} / ${subCategoryName}` : categoryName;

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
            <div className="h-full w-1/3 bg-blue-500 animate-pulse" />
          </div>
        </div>
      )}

      <div
        className={`grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2 md:gap-3 mb-6 transition-opacity duration-300 ${
          isFetching && !isFetchingNextPage ? "opacity-70" : "opacity-100"
        }`}
      >
        {data?.pages?.map((group, i) => (
          <React.Fragment key={i}>
            {group.data?.map((product) => (
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
        {!hasNextPage && !isLoading && (
          <span className="text-xs text-gray-400 font-medium">No more products</span>
        )}
      </div>
    </div>
  );
};

export default UserCatagoryLayout;
