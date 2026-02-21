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

  const handleIncrease = (id, qty) => {
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
      {/* Floating Cart Button */}
      <FloatButton
        icon={
          <div style={{ position: "relative" }}>
            <ShoppingCartOutlined style={{ fontSize: 20 }} />
            {cartItems.length > 0 && (
              <span
                style={{
                  position: "absolute",
                  top: -6,
                  right: -10,
                  background: "#f97316",
                  color: "#fff",
                  borderRadius: "50%",
                  padding: "0 6px",
                  fontSize: 12,
                  fontWeight: "bold",
                }}
              >
                {cartItems.length}
              </span>
            )}
          </div>
        }
        type="primary"
        style={{ right: 24, bottom: 24, background: "#f97316" }}
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
                    src={item.imageUrl}
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
                      ৳{Number(item.price).toFixed(2)}
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
                        onClick={() =>
                          handleIncrease(item.id, item.qty)
                        }
                      />
                    </div>
                  </div>

                  <div style={{ textAlign: "right" }}>
                    <p style={{ fontWeight: "bold" }}>
                      ৳{(Number(item.price) * item.qty).toFixed(2)}
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
                  ৳{totalPrice.toFixed(2)}
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
