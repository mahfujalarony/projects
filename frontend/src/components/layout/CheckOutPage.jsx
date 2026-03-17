import React, { useMemo, useState } from "react";
import { 
  Card,
  Radio,
  Button,
  Space,
  Form,
  Input,
  Modal,
  Divider,
  message,
  Typography,
  Tag,
  List,
  Popconfirm,
  Alert,
  Spin,
  Grid,
} from "antd";
import { MinusOutlined, PlusOutlined, DeleteOutlined } from "@ant-design/icons";
import { useSelector, useDispatch } from "react-redux";
import { updateQty, removeFromCart, clearCart } from "./../../redux/cartSlice";
import { useNavigate } from "react-router-dom";
import { API_BASE_URL } from "../../config/env";
import { normalizeImageUrl } from "../../utils/imageUrl";

const { Title, Text } = Typography;
const { useBreakpoint } = Grid;

const API_BASE = API_BASE_URL;

const round2 = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? Number(n.toFixed(2)) : 0;
};

const CheckoutPage = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const cartItems = useSelector((state) => state.cart.items);

  const [addresses, setAddresses] = useState([]);
  const [selectedAddress, setSelectedAddress] = useState(null);

  const [deliveryCharge, setDeliveryCharge] = useState(60); // default fallback

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [balLoading, setBalLoading] = useState(false);
  const [balance, setBalance] = useState(0);
  const [stockMap, setStockMap] = useState({}); // { [productId]: currentStock }
  const [confirmCooldown, setConfirmCooldown] = useState(false);
  const lastConfirmRef = React.useRef(0);

  const [form] = Form.useForm();
  const screens = useBreakpoint();
  const isMobile = !screens.md;

  const hasAddress = addresses.length > 0;

  const computedSubtotal = round2(
    cartItems.reduce((sum, item) => sum + Number(item.price) * Number(item.qty), 0)
  );

  // ✅ Fetch global settings (delivery charge)
  React.useEffect(() => {
    window.scrollTo(0, 0);
    fetch(`${API_BASE}/api/settings`)
      .then((res) => res.json())
      .then((data) => {
        if (data?.success && data?.data?.deliveryCharge !== undefined) {
          setDeliveryCharge(Number(data.data.deliveryCharge));
        }
      })
      .catch((err) => message.error("Failed to load settings"));
  }, []);

  const totals = useMemo(
    () => ({
      subtotal: computedSubtotal,
      shipping: round2(deliveryCharge),
      discount: 0,
      payable: round2(computedSubtotal + deliveryCharge),
    }),
    [computedSubtotal, deliveryCharge]
  );

  const getToken = () => {
    try {
      return JSON.parse(localStorage.getItem("userInfo"))?.token || null;
    } catch {
      return null;
    }
  };

  // ✅ realtime balance fetch
  const fetchBalance = async () => {
    const token = getToken();
    if (!token) return;

    try {
      setBalLoading(true);
      const r = await fetch(`${API_BASE}/api/auth/me/balance`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const j = await r.json().catch(() => null);
      if (r.ok) {
        const b = Number(j?.data?.balance ?? 0);
        setBalance(Number.isFinite(b) ? b : 0);
      }
    } finally {
      setBalLoading(false);
    }
  };

  
  // load addresses
  React.useEffect(() => {
    const fetchAddresses = async () => {
      try {
        const token = getToken();
        if (!token) return;

        const response = await fetch(`${API_BASE}/api/auth/me/address`, {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
        });

        if (response.ok) {
          const data = await response.json().catch(() => null);
          const arr = data?.addresses || [];
          setAddresses(arr);
          if (arr.length > 0) setSelectedAddress(arr[0].id);
        }
      } catch (error) {
        message.error("Failed to load addresses");
      }
    };

    fetchAddresses();
    fetchBalance();
  }, []);

  // cart items এর realtime stock fetch করা হচ্ছে
  React.useEffect(() => {
    if (cartItems.length === 0) return;
    const token = getToken();
    Promise.all(
      cartItems.map((item) =>
        fetch(`${API_BASE}/api/products/${item.id}`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        })
          .then((r) => r.json())
          .catch(() => null)
      )
    ).then((results) => {
      const map = {};
      results.forEach((d, i) => {
        const stock = d?.product?.stock;
        if (stock !== undefined) map[cartItems[i].id] = Number(stock);
      });
      setStockMap(map);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Add new address
  const handleAddAddress = () => {
    form
      .validateFields()
      .then(async (values) => {
        try {
          const token = getToken();
          if (!token) return message.error("Please login first");

          const response = await fetch(`${API_BASE}/api/auth/me/address`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify(values),
          });

          const data = await response.json().catch(() => null);

          if (response.ok) {
            setAddresses((prev) => [...prev, data.address]);
            setSelectedAddress(data.address.id);
            setIsAddModalOpen(false);
            form.resetFields();
            message.success("Address added successfully");
          } else {
            message.error(data?.message || "Failed to add address");
          }
        } catch (error) {
          message.error("Something went wrong!");
        }
      })
      .catch(() => {});
  };

  const handleIncrease = (id, currentQty) => {
    const maxStock = stockMap[id];
    if (maxStock !== undefined && currentQty >= maxStock) {
      message.warning(`Height stock: ${maxStock}`);
      return;
    }
    dispatch(updateQty({ id, qty: currentQty + 1 }));
  };

  const handleDecrease = (id, currentQty) => {
    if (currentQty > 1) dispatch(updateQty({ id, qty: currentQty - 1 }));
  };

  const handleRemove = (id) => {
    dispatch(removeFromCart({ id }));
  };

  const handleDeleteAddress = async (id) => {
    const token = getToken();
    if (!token) return message.error("Please login first");

    try {
      const res = await fetch(`${API_BASE}/api/auth/me/address/${id}`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        message.error(data?.message || "Failed to delete address");
        return;
      }

      setAddresses((prev) => {
        const nextList = prev.filter((a) => a.id !== id);
        if (String(selectedAddress) === String(id)) {
          setSelectedAddress(nextList[0]?.id ?? null);
        }
        return nextList;
      });
      message.success("Address deleted");
    } catch {
      message.error("Failed to delete address");
    }
  };

  const insufficient = round2(balance) < round2(totals.payable);

  const ensureLoggedIn = () => {
    const token = getToken();
    if (!token) {
      Modal.confirm({
        title: "Login required",
        content: "You need to login to continue. Do you want to login now?",
        okText: "Login",
        cancelText: "Cancel",
        onOk: () => navigate("/login"),
      });
      return false;
    }
    return true;
  };

  const submitOrder = async (payload, token, now) => {
    if (confirmCooldown || (now - lastConfirmRef.current < 60000)) {
      message.info("Please wait a minute for the next order.");
      return;
    }

    try {
      lastConfirmRef.current = now;
      setConfirmCooldown(true);
      setTimeout(() => setConfirmCooldown(false), 60000);
      setLoading(true);

      const res = await fetch(`${API_BASE}/api/orders`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        const msg = data?.message || "Failed to place order";
        message.error(msg);
        if (data?.balance != null && data?.required != null) {
          message.info(
            `Balance: $${Number(data.balance).toFixed(2)}, Required: $${Number(data.required).toFixed(2)}`
          );
        }
        return;
      }

      message.success("Order placed successfully!");
      dispatch(clearCart());

      // ✅ update balance UI instantly if backend returns it
      if (typeof data?.balanceAfter === "number") {
        setBalance(Number(data.balanceAfter));
      } else {
        fetchBalance();
      }

      navigate("/orders");
    } catch (e) {
      message.error("Something went wrong!");
    } finally {
      setLoading(false);
    }
  };

  // ✅ Place Order (Balance required always)
  const handlePlaceOrder = async () => {
    const now = Date.now();
    if (confirmCooldown || (now - lastConfirmRef.current < 60000)) {
      message.info("Please wait a minute for the next order.");
      return;
    }
    if (!selectedAddress) return message.error("Please select an address");
    if (cartItems.length === 0) return message.error("Your cart is empty");

    const token = getToken();
    if (!token) return message.error("Please login first");

    const matchMerchantId = cartItems?.[0]?.merchantId;

    // ✅ realtime balance re-check before placing order
    await fetchBalance();

    const latestBalance = round2(balance);
    if (latestBalance < round2(totals.payable)) {
      message.error("Insufficient balance. Please add balance first.");
      return;
    }

    const payload = {
      addressId: Number(selectedAddress),
      matchMerchantId: matchMerchantId ? Number(matchMerchantId) : undefined,

      // ✅ fixed
      paymentMethod: "balance",
      paymentStatus: "paid",
      deliveryCharge: deliveryCharge,

      items: cartItems.map((item) => ({
        productId: Number(item.id),
        name: item.name,
        quantity: Number(item.qty),
        imageUrl: item.imageUrl || null,
      })),
    };

    const balanceAfter = round2(latestBalance - totals.payable);

    Modal.confirm({
      title: "Confirm Order",
      okText: `Pay $${Number(totals.payable).toFixed(2)}`,
      cancelText: "Cancel",
      content: (
        <div style={{ display: "grid", gap: 6 }}>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span>Items Total</span>
            <b>${Number(totals.subtotal).toFixed(2)}</b>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span>Delivery Charge</span>
            <b>${Number(totals.shipping).toFixed(2)}</b>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span>Total Payable</span>
            <b>${Number(totals.payable).toFixed(2)}</b>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6 }}>
            <span>Current Balance</span>
            <b>${Number(latestBalance).toFixed(2)}</b>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span>Balance After</span>
            <b>${Number(balanceAfter).toFixed(2)}</b>
          </div>
        </div>
      ),
      onOk: () => submitOrder(payload, token, now),
    });
  };

  const cartSummary = (
    <Card title="Your Items">
      {cartItems.length === 0 ? (
        <Text type="secondary">Cart empty</Text>
      ) : (
        <List
          itemLayout="vertical"
          dataSource={cartItems}
          renderItem={(item) => {
            const lineTotal = Number(item.price) * Number(item.qty);
            const stock = stockMap[item.id];
            return (
              <List.Item style={{ border: "none", padding: 0, marginBottom: 12 }}>
                <Card
                  size="small"
                  bodyStyle={{ padding: 12, border: "1px solid #fde68a" }}
                  hoverable
                  onClick={() => navigate(`/products/${item.id}`)}
                  style={{ cursor: "pointer" }}
                >
                  <div
                    style={{
                      display: "flex",
                      flexDirection: isMobile ? "column" : "row",
                      gap: 12,
                      width: "100%",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        gap: 12,
                        minWidth: 0,
                        alignItems: "flex-start",
                      }}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <img
                        src={normalizeImageUrl(item.imageUrl)}
                        alt={item.name}
                        style={{
                          width: isMobile ? 72 : 64,
                          height: isMobile ? 72 : 64,
                          objectFit: "cover",
                          borderRadius: 10,
                          border: "1px solid #f1f5f9",
                          flexShrink: 0,
                        }}
                      />
                      <div style={{ minWidth: 0 }}>
                        <Text
                          strong
                          style={{
                            fontSize: 15,
                            lineHeight: 1.3,
                            display: "-webkit-box",
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: "vertical",
                            overflow: "hidden",
                          }}
                        >
                          {item.name}
                        </Text>
                        <div>
                          <Text type="secondary">Unit price: ${Number(item.price).toFixed(2)}</Text>
                        </div>
                        {stock !== undefined ? (
                          <div>
                            <Text type="secondary">In stock: {Number(stock)}</Text>
                          </div>
                        ) : null}
                      </div>
                    </div>

                    <div
                      style={{
                        display: "flex",
                        flexDirection: isMobile ? "row" : "column",
                        alignItems: isMobile ? "center" : "flex-end",
                        justifyContent: isMobile ? "space-between" : "flex-start",
                        gap: 8,
                      }}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Space key="qtyctrl" size={4} wrap>
                        <Button
                          size="small"
                          icon={<MinusOutlined />}
                          onClick={() => handleDecrease(item.id, item.qty)}
                          disabled={item.qty <= 1}
                        />
                        <Text style={{ minWidth: 20, textAlign: "center" }}>
                          {Number(item.qty).toFixed(0)}
                        </Text>
                        <Button
                          size="small"
                          icon={<PlusOutlined />}
                          onClick={() => handleIncrease(item.id, item.qty)}
                          disabled={stockMap[item.id] !== undefined && item.qty >= stockMap[item.id]}
                        />
                      </Space>
                      <Text strong>${Number(lineTotal).toFixed(2)}</Text>
                      <Popconfirm
                        title="Remove this item?"
                        onConfirm={() => handleRemove(item.id)}
                      >
                        <Button type="text" danger icon={<DeleteOutlined />} />
                      </Popconfirm>
                    </div>
                  </div>

                  <Divider style={{ margin: "10px 0" }} />
                  <Text type="secondary">
                    You added {Number(item.qty)} item{Number(item.qty) > 1 ? "s" : ""}, total price is ${Number(lineTotal).toFixed(2)}.
                  </Text>
                </Card>
              </List.Item>
            );
          }}
        />
      )}
    </Card>
  );

  return (
    <Space
      direction="vertical"
      size="large"
      style={{
        width: "100%",
        maxWidth: 980,
        margin: "0 auto",
        paddingInline: isMobile ? 12 : 16,
      }}
    >
      <Title level={3}>Checkout</Title>

      {cartSummary}

      <Card
        title="Order Summary"
        extra={<Tag color="orange">Pay ${Number(totals.payable).toFixed(2)}</Tag>}
      >
        <Space direction="vertical" style={{ width: "100%" }}>
          <Space style={{ width: "100%", justifyContent: "space-between" }}>
            <Text>Subtotal</Text>
            <Text>${Number(totals.subtotal).toFixed(2)}</Text>
          </Space>
          <Space style={{ width: "100%", justifyContent: "space-between" }}>
            <Text>Shipping</Text>
            <Text>${Number(totals.shipping).toFixed(2)}</Text>
          </Space>
          <Space style={{ width: "100%", justifyContent: "space-between" }}>
            <Text>Discount</Text>
            <Text type="success">- ${Number(totals.discount).toFixed(2)}</Text>
          </Space>
          <Divider style={{ margin: "8px 0" }} />
          <Space style={{ width: "100%", justifyContent: "space-between" }}>
            <Title level={5} style={{ margin: 0 }}>
              Payable
            </Title>
            <Title level={5} style={{ margin: 0 }}>
              ${Number(totals.payable).toFixed(2)}
            </Title>
          </Space>

          {/* ✅ Balance-only payment block */}
          <div>
            <Divider style={{ margin: "12px 0" }} />
            <Space style={{ width: "100%", justifyContent: "space-between" }}>
              <Text>Payment</Text>
              <Tag color="blue">Balance</Tag>
            </Space>

            <Space style={{ width: "100%", justifyContent: "space-between" }}>
              <Text>Current Balance</Text>
              <Text strong>${Number(balance).toFixed(2)}</Text>
            </Space>

            {balLoading ? (
              <div style={{ marginTop: 10 }}>
                <Spin />
              </div>
            ) : insufficient ? (
              <Alert
                style={{ marginTop: 10 }}
                type="error"
                showIcon
                message="Insufficient balance"
                description="Please add balance to pay from wallet/balance."
              />
            ) : (
              <Alert
                style={{ marginTop: 10 }}
                type="success"
                showIcon
                message="Balance is sufficient"
              />
            )}

            <Space wrap style={{ marginTop: 10 }}>
              <Button onClick={fetchBalance} loading={balLoading}>
                {balLoading ? "Refreshing..." : "Refresh Balance"}
              </Button>
              <Button type="link" onClick={() => ensureLoggedIn() && navigate("/add-balance")}>
                Add Balance
              </Button>
            </Space>
          </div>
        </Space>
      </Card>

      <Card
        title="Delivery Address"
        extra={
          <Button
            type="primary"
            size={isMobile ? "small" : "middle"}
            onClick={() => {
              if (!ensureLoggedIn()) return;
              setIsAddModalOpen(true);
            }}
          >
            + Add new
          </Button>
        }
      >
        {hasAddress ? (
          <Radio.Group
            style={{ width: "100%" }}
            value={selectedAddress}
            onChange={(e) => setSelectedAddress(e.target.value)}
          >
            <Space direction="vertical" style={{ width: "100%" }}>
              {addresses.map((addr) => (
                <Card
                  key={addr.id}
                  size="small"
                  style={{ width: "100%" }}
                  bodyStyle={{ padding: 12 }}
                  onClick={() => setSelectedAddress(addr.id)}
                  hoverable
                >
                  <Space align="start" style={{ width: "100%" }}>
                    <Radio value={addr.id} />
                    <Space direction="vertical" size={2} style={{ minWidth: 0, flex: 1 }}>
                      <Space size="small" wrap>
                        <Text strong>{addr.label}</Text>
                        <Tag>{addr.city}</Tag>
                      </Space>
                      <Text>{addr.name}</Text>
                      <Text type="secondary">{addr.phone}</Text>
                      <Text type="secondary">
                        {addr.line1}, {addr.city} - {addr.zip}
                      </Text>
                    </Space>
                  </Space>
                  <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 8 }}>
                    <Popconfirm
                      title="Delete this address?"
                      okText="Delete"
                      cancelText="Cancel"
                      onConfirm={(e) => {
                        e?.stopPropagation?.();
                        handleDeleteAddress(addr.id);
                      }}
                    >
                      <Button
                        danger
                        size="small"
                        onClick={(e) => e.stopPropagation()}
                      >
                        Delete
                      </Button>
                    </Popconfirm>
                  </div>
                </Card>
              ))}
            </Space>
          </Radio.Group>
        ) : (
          <Space direction="vertical">
            <Text type="secondary">No address added.</Text>
            <Button type="dashed" onClick={() => ensureLoggedIn() && setIsAddModalOpen(true)}>
              + Add Address
            </Button>
          </Space>
        )}
      </Card>

      <Space style={{ width: "100%", justifyContent: isMobile ? "flex-start" : "flex-end" }}>
        <Button
          type="primary"
          size="large"
          style={{ width: isMobile ? "100%" : "auto" }}
          onClick={handlePlaceOrder}
          loading={loading}
          disabled={loading || insufficient || confirmCooldown}
        >
          Confirm Order - Pay ${Number(totals.payable).toFixed(2)}
        </Button>
      </Space>

      <Modal
        title="Add new address"
        open={isAddModalOpen}
        onOk={handleAddAddress}
        onCancel={() => setIsAddModalOpen(false)}
        okText="Save"
        width={isMobile ? "92%" : 520}
      >
        <Form form={form} layout="vertical">
          <Form.Item label="Label" name="label">
            <Input placeholder="Home / Office" />
          </Form.Item>
          <Form.Item
            label="Full Name"
            name="name"
            rules={[{ required: true, message: "Name required" }]}
          >
            <Input />
          </Form.Item>
          <Form.Item
            label="Phone"
            name="phone"
            rules={[{ required: true, message: "Phone required" }]}
          >
            <Input />
          </Form.Item>
          <Form.Item
            label="Address Line"
            name="line1"
            rules={[{ required: true, message: "Address required" }]}
          >
            <Input />
          </Form.Item>
          <Form.Item
            label="City"
            name="city"
            rules={[{ required: true, message: "City required" }]}
          >
            <Input />
          </Form.Item>
          <Form.Item
            label="ZIP/Postal"
            name="zip"
            rules={[{ required: true, message: "ZIP required" }]}
          >
            <Input />
          </Form.Item>
        </Form>
      </Modal>
    </Space>
  );
};

export default CheckoutPage;
