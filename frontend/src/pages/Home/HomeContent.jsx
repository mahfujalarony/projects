import React, { useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { InputNumber, Rate, Button, message, Alert } from "antd";
import { ShoppingCartOutlined } from "@ant-design/icons";
import { useQuery } from "@tanstack/react-query";
import Footer from "./../../components/common/Footer";
import { useDispatch } from "react-redux";
import { addToCart } from "../../redux/cartSlice";
import ProductCard from "../../components/common/ProductCart";
import Story from "../../components/ui/Story";
import { API_BASE_URL } from "../../config/env";
import { MoveRight } from "lucide-react";


const getFullImageUrl = (imgPath) => {
  if (!imgPath) return "/placeholder-product.jpg";
  const cleanPath = String(imgPath).replace(/\\/g, "/").replace(/^\/+|\/+$/g, "");
  if (cleanPath.startsWith("http")) return cleanPath;
  return `${API_BASE_URL}/${cleanPath}`;
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

const fetchJson = async (url, fallbackMessage) => {
  const res = await fetch(url);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data?.message || fallbackMessage || "Request failed");
  }
  return data;
};

const HomeContent = () => {
  const navigate = useNavigate();
  const dispatch = useDispatch();

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
  });

  const productsQuery = useQuery({
    queryKey: ["home-products-preview"],
    queryFn: async () => {
      const data = await fetchJson(`${API_BASE_URL}/api/products?page=1&limit=40`, "Products load failed");
      return Array.isArray(data.data) ? data.data : [];
    },
    staleTime: 1000 * 60 * 2,
    gcTime: 1000 * 60 * 30,
    refetchOnWindowFocus: false,
  });

  const offersQuery = useQuery({
    queryKey: ["home-offers-preview"],
    queryFn: async () => {
      const d = await fetchJson(`${API_BASE_URL}/api/offers?type=carousel&limit=20`, "Offers load failed");
      if (!d?.success) throw new Error(d?.message || "Offers load failed");
      return Array.isArray(d.offers) ? d.offers : [];
    },
    staleTime: 1000 * 60 * 2,
    gcTime: 1000 * 60 * 30,
    refetchOnWindowFocus: false,
  });

  const stories = storiesQuery.data || [];
  const flashProducts = flashQuery.data || [];
  const allProducts = productsQuery.data || [];
  const offers = offersQuery.data || [];

  const storyLoading = storiesQuery.isPending;
  const flashLoading = flashQuery.isPending;
  const productsLoading = productsQuery.isPending;
  const offersLoading = offersQuery.isPending;

  const errMsg = flashQuery.error?.message || productsQuery.error?.message || "";
  const offersErr = offersQuery.error?.message || "";

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
  };

  const handleSearch = (event) => {
    event.preventDefault();
    const query = event.target.search.value?.trim();
    if (!query) return;
    navigate(`/search/${encodeURIComponent(query)}`);
  };

  return (
    <div className="pb-12 bg-gray-50 min-h-screen">
      {(errMsg || offersErr) ? (
        <div className="px-4 md:px-6 pt-4 space-y-2">
          {errMsg ? <Alert type="warning" showIcon message={errMsg} /> : null}
          {offersErr ? <Alert type="info" showIcon message={offersErr} /> : null}
        </div>
      ) : null}

      <div className="bg-white pt-4 pb-2 mb-4 shadow-sm">
        <Story stories={stories} loading={storyLoading} />
      </div>

      <div className="px-4 md:px-6">
        <div className="flex justify-between items-end mb-5">
          <div>
            <h2 className="text-2xl font-bold text-gray-800 tracking-tight">Flash Sale</h2>
            <p className="text-xs text-gray-500 mt-1">High discount products</p>
          </div>

          <Link
            to="/flash-sales"
            className="text-sm font-medium text-blue-600 hover:text-blue-800 transition-colors"
          >
            View All ->
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
                  className="min-w-[180px] w-[180px] bg-white rounded-xl shadow-sm hover:shadow-lg transition-all duration-300 flex flex-col snap-start border border-gray-100 overflow-hidden group cursor-pointer"
                >
                  <div className="h-40 w-full bg-gray-50 relative overflow-hidden">
                    <img
                      src={getFullImageUrl(product.images?.[0])}
                      alt={product.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                    <span className="absolute top-2 left-2 bg-rose-500 text-white text-[10px] font-bold px-2 py-0.5 rounded shadow-sm">
                      FLASH
                    </span>
                  </div>

                  <div className="p-3 flex flex-col flex-grow">
                    <p className="text-[10px] text-gray-400 uppercase tracking-wider mb-1">
                      {product.category || "Item"}
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
                          className="flex-grow bg-gray-900 hover:bg-black border-none shadow-none rounded-md flex justify-center items-center"
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
            <h2 className="text-2xl font-bold text-gray-800 tracking-tight">Special Offers</h2>
            <p className="text-xs text-gray-500 mt-1">Exclusive deals for you</p>
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
                  className="min-w-[280px] md:min-w-[350px] h-[160px] md:h-[200px] rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-all duration-300 snap-center relative group"
                  title={o.title}
                >
                  <img
                    src={getFullImageUrl(o.imageUrl)}
                    alt={o.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                  <div className="absolute inset-0 bg-black/10 group-hover:bg-transparent transition-colors"></div>
                  <div className="absolute left-3 bottom-3 bg-black/60 text-white px-3 py-1 rounded-lg text-xs font-medium">
                    {o.title}
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      <div className="px-4 md:px-6 my-8">
        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
          <div className="text-center mb-6">
            <h2 className="text-2xl font-bold text-gray-800 mb-2">Find Your Perfect Product</h2>
            <p className="text-sm text-gray-500">Search from thousands of products at the best prices</p>
          </div>

          <form onSubmit={handleSearch} className="max-w-2xl mx-auto">
            <div className="relative">
              <div className="absolute inset-y-0 left-0 flex items-center pl-4 pointer-events-none">
                <svg className="w-5 h-5 text-gray-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <path stroke="currentColor" strokeLinecap="round" strokeWidth="2" d="m21 21-3.5-3.5M17 10a7 7 0 1 1-14 0 7 7 0 0 1 14 0Z" />
                </svg>
              </div>

              <input
                type="search"
                name="search"
                className="block w-full py-4 pl-12 pr-32 text-gray-800 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all placeholder:text-gray-400 text-sm"
                placeholder="Search for products, brands, categories..."
              />

              <button
                type="submit"
                className="absolute right-2 top-1/2 -translate-y-1/2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg text-sm px-6 py-2.5 transition-colors shadow-sm"
              >
                Search
              </button>
            </div>
          </form>
        </div>
      </div>

      <div className="px-4 md:px-6">
        <div className="flex justify-between items-end mb-4">
          <span className="text-lg font-semibold text-gray-800">Our Products</span>
          <Link to="/products" className="text-sm font-medium text-blue-600 hover:text-blue-800 transition-colors">
            View All <MoveRight />
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
                />
              ))
            )}
          </div>
        )}

        <div className="flex justify-center">
          <Link to="/products" className="text-sm font-medium text-blue-600 hover:text-blue-800 transition-colors">
            View All Products <MoveRight />
          </Link>
        </div>
      </div>

      <Footer />
    </div>
  );
};

export default HomeContent;
