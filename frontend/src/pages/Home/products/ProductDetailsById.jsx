import React, { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  Card,
  Typography,
  Space,
  Button,
  Tag,
  Image,
  Rate,
  Alert,
  InputNumber,
  message,
} from "antd";
import { MessageOutlined } from "@ant-design/icons";
import ProductReviews from "../../../components/common/ProductReviews.jsx"; 
import { useDispatch, useSelector } from "react-redux";
import { addToCart, updateQty } from "./../../../redux/cartSlice.js";
import axios from "axios";
import { normalizeImageUrl } from "../../../utils/imageUrl";
import { API_BASE_URL } from "../../../config/env";
import "./ProductDetailsById.css";

const { Title, Text } = Typography;
const API_BASE = `${API_BASE_URL}`;
const fallbackImg = "https://via.placeholder.com/320";

const ProductDetailsById = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const cartItems = useSelector((state) => state.cart.items);
  const { token } = useSelector((state) => state.auth);

  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeImg, setActiveImg] = useState(null);
  const [relatedProducts, setRelatedProducts] = useState([]);
  const [relatedLoading, setRelatedLoading] = useState(false);

  const cartItem = useMemo(
    () => cartItems.find((item) => String(item.id) === String(id)),
    [cartItems, id]
  );

  const [qty, setQty] = useState(cartItem ? cartItem.qty : 1);

  //  when cart qty changes from anywhere, sync here
  useEffect(() => {
    setQty(cartItem ? cartItem.qty : 1);
  }, [cartItem]);

  useEffect(() => {
    const fetchProduct = async () => {
      try {
        setLoading(true);
        setError(null);

        const res = await axios.get(`${API_BASE}/api/products/${id}`);

        if (res.data?.success) {
          const p = res.data.product;
          setProduct(p);

          const firstImg = p?.images?.[0] || null;
          setActiveImg(firstImg);

          // track view
          fetch(`${API_BASE}/api/track/view/${id}`, { method: "POST" }).catch(
            () => {}
          );
        } else {
          setError(res.data?.message || "Product not found");
        }
      } catch (err) {
        console.error("Product fetch error:", err);
        setError(err.response?.data?.message || "Failed to load product");
      } finally {
        setLoading(false);
      }
    };

    fetchProduct();
    window.scrollTo(0, 0);
  }, [id]);

  useEffect(() => {
    let ignore = false;

    const fetchRelated = async () => {
      try {
        setRelatedLoading(true);
        const res = await axios.get(`${API_BASE}/api/products/${id}/related?limit=8`);
        if (ignore) return;
        if (res.data?.success) {
          setRelatedProducts(Array.isArray(res.data.products) ? res.data.products : []);
        } else {
          setRelatedProducts([]);
        }
      } catch (err) {
        if (!ignore) {
          console.error("Related products fetch error:", err);
          setRelatedProducts([]);
        }
      } finally {
        if (!ignore) setRelatedLoading(false);
      }
    };

    if (id) fetchRelated();
    return () => {
      ignore = true;
    };
  }, [id]);

  const cleanImage = (url) => normalizeImageUrl(url) || fallbackImg;

  const images = Array.isArray(product?.images) ? product.images : [];
  const mainImg = activeImg || images[0] || null;

  const handleQtyChange = (value) => {
    const v = Math.max(1, Number(value || 1));
    setQty(v);

    //  only update cart qty if item already in cart
    if (cartItem && product && v > 0 && v <= product.stock) {
      dispatch(updateQty({ id: product.id, qty: v }));
    }
  };

  const handleIncrease = () => {
    if (!product) return;
    if (qty < product.stock) {
      const newQty = qty + 1;
      setQty(newQty);
      if (cartItem) dispatch(updateQty({ id: product.id, qty: newQty }));
    }
  };

  const handleDecrease = () => {
    if (qty > 1) {
      const newQty = qty - 1;
      setQty(newQty);
      if (cartItem) dispatch(updateQty({ id: product.id, qty: newQty }));
    }
  };

  const handleAdd = () => {
    if (!product) return;

    if (product.stock <= 0) {
      message.error("Out of stock");
      return;
    }

    if (qty > product.stock) {
      message.error("Quantity exceeds available stock");
      return;
    }

    fetch(`${API_BASE}/api/track/add-to-cart/${product.id}`, { method: "POST" }).catch(
      () => {}
    );

    dispatch(
      addToCart({
        id: product.id,
        name: product.name,
        price: product.price,
        merchantId: product.merchantId ?? product.merchant?.id,
        imageUrl: cleanImage(product.images?.[0]),
        qty,
      })
    );

    message.success(cartItem ? "Cart updated!" : "Product added to cart!");
  };

  const goToMerchant = () => {
    const mid = product?.merchant?.id || product?.merchantId;
    if (mid) navigate(`/saller/${mid}`);
    else message.info("Merchant info not available");
  };

  const handleMessage = async () => {
    try {
      if (!token) {
        message.info("Please login first");
        return;
      }

      const res = await axios.post(
        "http://localhost:4000/api/chat/conversations/open",
        {},
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      const conversationId = res.data?.conversation?.id;
      if (res.data?.success && conversationId) {
        navigate(`/chats/${conversationId}`);
      } else {
        message.error("Failed to start chat");
      }
    } catch (err) {
      console.error("Failed to open conversation:", err);
      message.error("Failed to start chat");
    }
  };

  if (loading) {
    return (
      <div className="mx-auto w-full max-w-7xl px-3 py-3 sm:px-4 sm:py-4">
        <div className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
            <div className="w-full lg:w-auto">
              <div className="h-[320px] w-full max-w-[420px] animate-pulse rounded-xl bg-slate-200" />
              <div className="mt-2 flex gap-2">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="h-14 w-14 animate-pulse rounded-md bg-slate-200" />
                ))}
              </div>
            </div>
            <div className="w-full space-y-3">
              <div className="h-8 w-3/4 animate-pulse rounded bg-slate-200" />
              <div className="h-5 w-40 animate-pulse rounded bg-slate-200" />
              <div className="h-6 w-28 animate-pulse rounded bg-slate-200" />
              <div className="h-24 animate-pulse rounded-xl bg-slate-200" />
              <div className="h-10 w-44 animate-pulse rounded-xl bg-slate-200" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error || !product) {
    return (
      <div style={{ padding: 24 }}>
        <Alert
          type="error"
          message="Error"
          description={error || "Product not found"}
          showIcon
        />
      </div>
    );
  }

  const ratingValue = Number(product.averageRating ?? product.rating ?? 0);
  const reviewCount = Number(product.totalReviews ?? 0);

  return (
    <div className="mx-auto w-full max-w-7xl px-3 py-3 sm:px-4 sm:py-4">
      <Card bodyStyle={{ padding: 16 }}>
        <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
          {/* Images */}
          <div className="w-full lg:w-auto">
            <Image
              src={cleanImage(mainImg)}
              alt={product.name}
              width="100%"
              style={{
                width: "100%",
                maxWidth: 420,
                aspectRatio: "1 / 1",
                objectFit: "cover",
                borderRadius: 12,
              }}
              fallback={fallbackImg}
            />

            <div
              style={{
                display: "flex",
                gap: 8,
                flexWrap: "nowrap",
                overflowX: "auto",
                marginTop: 8,
                paddingBottom: 4,
                maxWidth: 420,
              }}
            >
              {images.map((src, idx) => {
                const clean = cleanImage(src);
                const isActive = String(src) === String(mainImg);
                return (
                  <Image
                    key={idx}
                    src={clean}
                    preview={false}
                    alt={`${product.name} ${idx + 1}`}
                    width={64}
                    height={64}
                    style={{
                      objectFit: "cover",
                      borderRadius: 8,
                      border: isActive ? "2px solid #f97316" : "1px solid #eee",
                      cursor: "pointer",
                    }}
                    onClick={() => setActiveImg(src)}
                    fallback="https://via.placeholder.com/64"
                  />
                );
              })}
            </div>
          </div>

          {/* Info */}
          <div className="w-full min-w-0" style={{ maxWidth: 620 }}>
            <Title level={3} style={{ marginBottom: 4 }}>
              {product.name}
            </Title>

            <Space size="small" wrap>
              {product.category && <Tag>{product.category}</Tag>}
              {product.subCategory && <Tag color="geekblue">{product.subCategory}</Tag>}
              {product.stock > 0 ? (
                <Tag color="green">In stock</Tag>
              ) : (
                <Tag color="red">Out of stock</Tag>
              )}
            </Space>

            <Space align="center">
              <Rate disabled allowHalf value={ratingValue} />
              <Text type="secondary">
                {ratingValue ? ratingValue.toFixed(1) : "N/A"}
                {reviewCount ? ` (${reviewCount})` : ""}
              </Text>
            </Space>

            <Title level={4} style={{ margin: 0, color: "#f97316" }}>
              ৳{Number(product.price).toFixed(2)}
            </Title>

            <div style={{ marginBottom: 8 }} className="product-description">
              <div
                dangerouslySetInnerHTML={{
                  __html: product.description || "No description available.",
                }}
              />
            </div>

            {/* Quantity + Cart */}
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: "16px",
                alignItems: "center",
                justifyContent: "flex-start",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  flexWrap: "wrap",
                  minWidth: "200px",
                  flex: "1",
                }}
              >
                <Text strong style={{ marginRight: 8 }}>
                  Quantity:
                </Text>
                <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  <Button size="small" onClick={handleDecrease} disabled={qty <= 1}>
                    -
                  </Button>
                  <InputNumber
                    min={1}
                    max={product.stock}
                    value={qty}
                    onChange={handleQtyChange}
                    style={{ width: 70 }}
                  />
                  <Button
                    size="small"
                    onClick={handleIncrease}
                    disabled={qty >= product.stock}
                  >
                    +
                  </Button>
                </div>
              </div>

              <Button
                type="primary"
                size="large"
                disabled={product.stock <= 0}
                onClick={handleAdd}
                style={{ flex: "1 1 220px", minWidth: 160, maxWidth: 320 }}
              >
                {cartItem ? "Update Cart" : "Add to Cart"}
              </Button>

              <Button
                size="large"
                icon={<MessageOutlined />}
                onClick={handleMessage}
                style={{ flex: "1 1 140px" }}
              >
                Support
              </Button>

              <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                {product.stock > 0 && (
                  <Text type="secondary">Available: {product.stock}</Text>
                )}
                {cartItem && <Tag color="blue">In cart: {cartItem.qty}</Tag>}
              </div>
            </div>
          </div>
        </div>
      </Card>

      {/* Merchant */}
      <Card style={{ marginTop: 24 }}>
        <Title level={4}>Merchant</Title>
        {product.merchant ? (
          <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
            <Image
              src={cleanImage(product.merchant.imageUrl || product.merchant.logo)}
              alt={product.merchant.name}
              width={64}
              height={64}
              style={{ objectFit: "cover", borderRadius: "50%" }}
              fallback="https://via.placeholder.com/64"
            />
            <div>
              <Text strong>{product.merchant.name}</Text>
              <br />
              <Space>
                <Button type="link" onClick={goToMerchant} style={{ padding: 0 }}>
                  View Profile
                </Button>
              </Space>
            </div>
          </div>
        ) : (
          <Space direction="vertical">
            <Text type="secondary">Merchant information not available.</Text>
            <Button type="link" onClick={goToMerchant} style={{ padding: 0 }}>
              Try merchant profile
            </Button>
          </Space>
        )}
      </Card>

      {/* Related Products */}
      {(relatedLoading || relatedProducts.length > 0) && (
        <Card style={{ marginTop: 24 }}>
          <div className="flex items-center justify-between gap-3 mb-4">
            <Title level={4} style={{ margin: 0 }}>
              Related Products
            </Title>
            {relatedLoading ? <Text type="secondary">Loading...</Text> : null}
          </div>

          {relatedLoading ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="rounded-lg border border-gray-200 p-2">
                  <div className="aspect-square w-full animate-pulse rounded bg-gray-100" />
                  <div className="mt-2 h-3 w-3/4 animate-pulse rounded bg-gray-100" />
                  <div className="mt-2 h-3 w-1/2 animate-pulse rounded bg-gray-100" />
                </div>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {relatedProducts.map((rp) => (
                <button
                  key={rp.id}
                  type="button"
                  onClick={() => navigate(`/products/${rp.id}`)}
                  className="overflow-hidden rounded-xl border border-gray-200 bg-white text-left transition hover:shadow-md"
                >
                  <div className="aspect-square w-full bg-gray-50">
                    <img
                      src={cleanImage(rp.images?.[0])}
                      alt={rp.name}
                      className="h-full w-full object-cover"
                    />
                  </div>
                  <div className="p-3">
                    <div className="mb-1 line-clamp-2 min-h-[2.5rem] text-sm font-medium text-gray-800">
                      {rp.name}
                    </div>
                    <div className="mb-2 flex flex-wrap gap-1">
                      {rp.category ? <Tag className="m-0">{rp.category}</Tag> : null}
                      {rp.subCategory ? (
                        <Tag color="blue" className="m-0">
                          {rp.subCategory}
                        </Tag>
                      ) : null}
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-semibold text-orange-600">
                        ৳{Number(rp.price || 0).toFixed(2)}
                      </span>
                      <span className="text-xs text-gray-500">
                        {Number(rp.averageRating || 0) > 0
                          ? `${Number(rp.averageRating).toFixed(1)}★`
                          : "New"}
                      </span>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </Card>
      )}

      {/* Reviews */}
      <ProductReviews
        productId={id}
        product={product}
        onStatsUpdate={(stats) => {
          setProduct((p) => ({
            ...p,
            averageRating: stats.averageRating,
            rating: stats.averageRating,
            totalReviews: stats.totalReviews,
          }));
        }}
      />
    </div>
  );
};

export default ProductDetailsById;
