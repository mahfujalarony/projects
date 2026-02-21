import React, { useEffect } from "react";
import { useNavigationType } from "react-router-dom";
import { useInfiniteQuery } from "@tanstack/react-query";
import { useInView } from "react-intersection-observer";
import { useDispatch } from "react-redux";
import { addToCart } from "./../../redux/cartSlice";
import ProductCard from "./../common/ProductCart";
import { message } from "antd";
import { API_BASE_URL } from "../../config/env";

const FLASH_PAGE_SIZE = 24;

const getFullImageUrl = (imgPath) => {
  if (!imgPath) return "https://via.placeholder.com/150";
  const cleanPath = String(imgPath).replace(/\\/g, "/").replace(/^\/+|\/+$/g, "");
  if (cleanPath.startsWith("http")) return cleanPath;
  return `${API_BASE_URL}/${cleanPath}`;
};

const FlashSales = () => {
  const navigationType = useNavigationType();
  const { ref, inView } = useInView();
  const dispatch = useDispatch();

  useEffect(() => {
    if (navigationType !== "POP") {
      window.scrollTo(0, 0);
    }
  }, [navigationType]);

  const fetchFlashProducts = async ({ pageParam = 1 }) => {
    const response = await fetch(
      `${API_BASE_URL}/api/products/home?days=7&limit=30&flashPage=${pageParam}&flashLimit=${FLASH_PAGE_SIZE}`
    );
    const data = await response.json();

    if (!response.ok || !data?.success) {
      throw new Error(data?.message || "Failed to load flash sale products");
    }

    const list = Array.isArray(data.flash) ? data.flash : [];
    const meta = data.flashMeta || {};

    return {
      data: list,
      total: Number(meta.total || list.length || 0),
      nextPage: meta.hasNext ? pageParam + 1 : undefined,
    };
  };

  const { data, status, error, fetchNextPage, hasNextPage, isFetchingNextPage } =
    useInfiniteQuery({
      queryKey: ["flash-sales-infinite"],
      queryFn: fetchFlashProducts,
      initialPageParam: 1,
      getNextPageParam: (lastPage) => lastPage.nextPage,
      staleTime: 1000 * 60 * 5,
      gcTime: 1000 * 60 * 30,
      refetchOnMount: false,
      refetchOnWindowFocus: false,
    });

  useEffect(() => {
    if (inView && hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  }, [inView, hasNextPage, isFetchingNextPage, fetchNextPage]);

  const handleAddToCartClick = (product, qty) => {
    const numericQty = Number(qty || 1);

    fetch(`${API_BASE_URL}/api/track/add-to-cart/${product.id}`, {
      method: "POST",
    }).catch(() => {});

    dispatch(
      addToCart({
        id: product.id,
        name: product.name,
        price: Number(product.price),
        imageUrl: product.images?.[0],
        merchantId: product.merchantId ?? product.merchant?.id,
        qty: numericQty,
      })
    );

    message.success(`${numericQty} ${product.name} added to cart`);
  };

  if (status === "pending") {
    return <div className="h-screen flex justify-center items-center">Loading flash sales...</div>;
  }

  if (status === "error") {
    return (
      <div className="h-screen flex justify-center items-center text-red-600">
        {error?.message || "Failed to load flash sale products"}
      </div>
    );
  }

  const flashProducts = data?.pages?.flatMap((p) => p.data || []) || [];
  const totalCount = data?.pages?.[0]?.total || flashProducts.length;

  return (
    <div className="container mx-auto px-2 py-6 pb-20">
      <h2 className="text-xl font-bold mb-4 px-1 text-gray-800">
        Flash Sales
        <span className="text-sm font-normal text-gray-500 ml-2">({totalCount} items)</span>
      </h2>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2 md:gap-3 mb-6">
        {flashProducts.length === 0 ? (
          <p className="col-span-full text-center text-gray-500 py-8">No flash sale products available right now</p>
        ) : (
          flashProducts.map((product) => (
            <ProductCard
              key={product.id}
              product={{
                ...product,
                images: (product.images || []).map(getFullImageUrl),
              }}
              onAddToCart={handleAddToCartClick}
            />
          ))
        )}
      </div>

      <div ref={ref} className="flex justify-center py-6 h-16">
        {isFetchingNextPage && (
          <div className="flex items-center space-x-2 text-blue-600">
            <span className="w-2 h-2 bg-blue-600 rounded-full animate-bounce"></span>
            <span className="w-2 h-2 bg-blue-600 rounded-full animate-bounce delay-75"></span>
            <span className="w-2 h-2 bg-blue-600 rounded-full animate-bounce delay-150"></span>
          </div>
        )}
        {!hasNextPage && flashProducts.length > 0 && (
          <span className="text-xs text-gray-400 font-medium">All flash sale products loaded</span>
        )}
      </div>
    </div>
  );
};

export default FlashSales;
