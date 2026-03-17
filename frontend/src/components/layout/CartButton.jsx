import React, { useState, useMemo } from "react";
import { useSelector, useDispatch } from "react-redux";
import { Drawer, Button, FloatButton } from "antd";
import {
  DeleteOutlined,
  PlusOutlined,
  MinusOutlined,
  ShoppingCartOutlined,
} from "@ant-design/icons";
import { removeFromCart, updateQty, clearCart } from "../../redux/cartSlice";
import { useNavigate } from "react-router-dom";
import { normalizeImageUrl } from "../../utils/imageUrl";

const CartButton = () => {
  const [open, setOpen] = useState(false);
  const dispatch = useDispatch();
  const navigate = useNavigate();

  const cartItems = useSelector((state) => state.cart.items);

  // ✅ Safe total price calculation
  const totalPrice = useMemo(() => {
    return cartItems.reduce(
      (sum, item) => sum + Number(item.price || 0) * item.qty,
      0
    );
  }, [cartItems]);

  const handleIncrease = (id, qty, stock) => {
    const maxStock = Number(stock);
    if (Number.isFinite(maxStock) && maxStock > 0 && qty >= maxStock) return;
    dispatch(updateQty({ id, qty: qty + 1 }));
  };

  const handleDecrease = (id, qty) => {
    if (qty > 1) {
      dispatch(updateQty({ id, qty: qty - 1 }));
    }
  };

  const handleRemove = (id) => {
    dispatch(removeFromCart({ id }));
  };

  const handleCheckout = () => {
    navigate("/checkout", {
      state: {
        cartItems,
        totals: {
          subtotal: totalPrice,
          shipping: 0,
          discount: 0,
          payable: totalPrice,
        },
      },
    });
    setOpen(false);
  };

  return (
    <>
      <style>{`
        .cart-bump { animation: cartBump 320ms ease-out; }
        @keyframes cartBump {
          0% { transform: scale(1); }
          50% { transform: scale(1.25); }
          100% { transform: scale(1); }
        }
        .cart-fab .ant-float-btn-body {
          background: linear-gradient(135deg, #fb923c 0%, #f97316 45%, #ea580c 100%);
          box-shadow: 0 12px 28px rgba(234, 88, 12, 0.35), 0 6px 12px rgba(15, 23, 42, 0.12);
          border: 1px solid rgba(255, 255, 255, 0.35);
          transition: transform 180ms ease, box-shadow 180ms ease, filter 180ms ease;
        }
        .cart-fab:hover .ant-float-btn-body {
          transform: translateY(-2px) scale(1.02);
          filter: brightness(1.04);
          box-shadow: 0 16px 32px rgba(234, 88, 12, 0.4), 0 8px 16px rgba(15, 23, 42, 0.14);
        }
        .cart-fab .ant-float-btn-icon {
          color: #fff;
          font-size: 20px;
        }
        .cart-fab-ring {
          position: absolute;
          inset: -6px;
          border-radius: 999px;
          border: 1px dashed rgba(249, 115, 22, 0.35);
          animation: cartRing 5s linear infinite;
          pointer-events: none;
        }
        @keyframes cartRing {
          0% { transform: rotate(0deg); opacity: 0.6; }
          50% { opacity: 1; }
          100% { transform: rotate(360deg); opacity: 0.6; }
        }
      `}</style>
      {/* Floating Cart Button */}
      <FloatButton
        className="cart-fab"
        icon={
          <div style={{ position: "relative" }} data-cart-target>
            <span className="cart-fab-ring" />
            <ShoppingCartOutlined style={{ fontSize: 20 }} />
            {cartItems.length > 0 && (
              <span
                data-cart-badge
                style={{
                  position: "absolute",
                  top: -8,
                  right: -10,
                  background: "linear-gradient(135deg, #ef4444, #f97316)",
                  color: "#fff",
                  borderRadius: "50%",
                  padding: "0 6px",
                  fontSize: 11,
                  fontWeight: 800,
                  border: "2px solid #fff",
                  boxShadow: "0 6px 12px rgba(15,23,42,0.2)",
                }}
              >
                {cartItems.length}
              </span>
            )}
          </div>
        }
        type="primary"
        style={{ right: 24, bottom: 24 }}
        onClick={() => setOpen(true)}
      />

      {/* Cart Drawer */}
      <Drawer
        title={`Your Cart (${cartItems.length} items)`}
        open={open}
        onClose={() => setOpen(false)}
        size="default"
        styles={{
          body: { padding: 0 },
        }}
      >
        {cartItems.length === 0 ? (
          <div style={{ textAlign: "center", padding: 40, color: "#999" }}>
            🛒 Your cart is empty
          </div>
        ) : (
          <>
            {/* Cart Items */}
            <div style={{ maxHeight: "60vh", overflowY: "auto" }}>
              {cartItems.map((item) => (
                <div
                  key={item.id}
                  style={{
                    display: "flex",
                    gap: 12,
                    padding: 12,
                    borderBottom: "1px solid #f0f0f0",
                  }}
                >
                  <img
                    src={normalizeImageUrl(item.imageUrl)}
                    alt={item.name}
                    style={{
                      width: 60,
                      height: 60,
                      objectFit: "cover",
                      borderRadius: 8,
                    }}
                  />

                  <div style={{ flex: 1 }}>
                    <h4 style={{ margin: 0 }}>{item.name}</h4>
                    <p style={{ color: "#f97316", fontWeight: "bold" }}>
                      ${Number(item.price).toFixed(2)}
                    </p>

                    <div style={{ display: "flex", gap: 8 }}>
                      <Button
                        size="small"
                        icon={<MinusOutlined />}
                        disabled={item.qty <= 1}
                        onClick={() =>
                          handleDecrease(item.id, item.qty)
                        }
                      />
                      <span>{item.qty}</span>
                      <Button
                        size="small"
                        icon={<PlusOutlined />}
                        disabled={Number.isFinite(Number(item.stock)) && Number(item.stock) > 0 && item.qty >= Number(item.stock)}
                        onClick={() => handleIncrease(item.id, item.qty, item.stock)}
                      />
                    </div>
                  </div>

                  <div style={{ textAlign: "right" }}>
                    <p style={{ fontWeight: "bold" }}>
                      ${Number(item.price * item.qty).toFixed(2)}
                    </p>
                    <Button
                      type="text"
                      danger
                      icon={<DeleteOutlined />}
                      onClick={() => handleRemove(item.id)}
                    />
                  </div>
                </div>
              ))}
            </div>

            {/* Footer */}
            <div style={{ padding: 16, borderTop: "1px solid #f0f0f0" }}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  fontSize: 18,
                  fontWeight: "bold",
                }}
              >
                <span>Total</span>
                <span style={{ color: "#f97316" }}>
                  ${totalPrice.toFixed(2)}
                </span>
              </div>

              <Button
                type="primary"
                block
                size="large"
                style={{
                  marginTop: 12,
                  background: "#f97316",
                  borderColor: "#f97316",
                }}
                onClick={handleCheckout}
              >
                Checkout
              </Button>

              <Button
                danger
                block
                style={{ marginTop: 8 }}
                onClick={() => dispatch(clearCart())}
              >
                Clear Cart
              </Button>
            </div>
          </>
        )}
      </Drawer>
    </>
  );
};

export default CartButton;
