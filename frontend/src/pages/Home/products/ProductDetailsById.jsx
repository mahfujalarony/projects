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
  Spin,
} from "antd";
import { MessageOutlined } from "@ant-design/icons";
import ProductReviews from "../../../components/common/ProductReviews.jsx"; 
import { useDispatch, useSelector } from "react-redux";
import { addToCart, updateQty } from "./../../../redux/cartSlice.js";
import axios from "axios";
import { normalizeImageUrl } from "../../../utils/imageUrl";
import { API_BASE_URL } from "../../../config/env";

const { Title, Text, Paragraph } = Typography;
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
      <div className="h-screen flex items-center justify-center">
        <Spin size="large" tip="Loading product details...">
          <div />
        </Spin>
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
    <>
      <Card bodyStyle={{ padding: 24 }}>
        <Space align="start" size="large" wrap>
          {/* Images */}
          <Space direction="vertical" size="small">
            <Image
              src={cleanImage(mainImg)}
              alt={product.name}
              width={320}
              height={320}
              style={{ objectFit: "cover", borderRadius: 12 }}
              fallback={fallbackImg}
            />

            <Space wrap>
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
            </Space>
          </Space>

          {/* Info */}
          <Space direction="vertical" size="middle" style={{ maxWidth: 520 }}>
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

            <Paragraph style={{ marginBottom: 4 }}>
              <div
                dangerouslySetInnerHTML={{
                  __html: product.description || "No description available.",
                }}
              />
            </Paragraph>

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
                style={{ flex: "1 0 200px", minWidth: 200, maxWidth: 300 }}
              >
                {cartItem ? "Update Cart" : "Add to Cart"}
              </Button>

              <Button
                size="large"
                icon={<MessageOutlined />}
                onClick={handleMessage}
                style={{ flex: "0 0 auto" }}
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
          </Space>
        </Space>
      </Card>

      {/* Merchant */}
      <Card style={{ marginTop: 24 }}>
        <Title level={4}>Merchant</Title>
        {product.merchant ? (
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
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
    </>
  );
};

export default ProductDetailsById;
