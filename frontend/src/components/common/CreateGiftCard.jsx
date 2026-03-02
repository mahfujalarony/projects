// src/pages/CreateGiftCard.jsx
import { useMemo, useState } from "react";
import {
  Form,
  Input,
  InputNumber,
  Select,
  Button,
  Card,
  message,
  Tooltip,
  Divider,
} from "antd";
import {
  GiftOutlined,
  CopyOutlined,
  SendOutlined,
  DollarOutlined,
  CalendarOutlined,
  CheckCircleFilled,
  LinkOutlined,
  WhatsAppOutlined,
  MessageOutlined,
} from "@ant-design/icons";
import axios from "axios";
import { API_BASE_PATH } from "../../config/env";
import { useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";

const { TextArea } = Input;
const { Option } = Select;

const API = axios.create({
  baseURL: API_BASE_PATH,
  headers: { "Content-Type": "application/json" },
});

const PRESET_AMOUNTS = [50, 100, 200, 500, 1000, 2000];

function GiftCardPreview({ amount, messageText, senderName, code }) {
  const prettyAmount = useMemo(() => {
    if (amount === "" || amount === null || amount === undefined) return null;
    const n = Number(amount);
    if (!Number.isFinite(n)) return null;
    return `৳${n.toFixed(2)}`;
  }, [amount]);

  return (
    <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-zinc-950 shadow-2xl">
      <div className="absolute inset-0 bg-gradient-to-br from-zinc-950 via-zinc-900 to-zinc-950" />
      <div className="absolute inset-0 gc-diagonal-pattern opacity-[0.12]" />
      <div className="absolute -top-24 -right-24 h-56 w-56 rounded-full bg-fuchsia-500/20 blur-3xl" />
      <div className="absolute -bottom-28 -left-28 h-72 w-72 rounded-full bg-amber-500/15 blur-3xl" />

      <div className="relative p-7 sm:p-8 min-h-[240px] flex flex-col justify-between">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-2xl bg-white/5 border border-white/10">
              <GiftOutlined className="text-white/80" />
            </span>
            <div className="leading-tight">
              <p className="text-xs uppercase tracking-[0.22em] text-white/50">
                GiftFlow
              </p>
              <p className="text-sm font-semibold text-white/90">
                Digital Gift Card
              </p>
            </div>
          </div>

          <span className="inline-flex items-center rounded-full bg-white/5 border border-white/10 px-3 py-1 text-xs text-white/70">
            Manual • Redeemable
          </span>
        </div>

        <div className="mt-7">
          <p className="text-5xl sm:text-6xl font-extrabold tracking-tight text-white leading-none">
            {prettyAmount || "৳ ---"}
          </p>

          {messageText ? (
            <div className="mt-4 rounded-2xl bg-white/5 border border-white/10 px-4 py-3">
              <p className="text-sm text-white/70 italic leading-relaxed">
                “{messageText}”
              </p>
            </div>
          ) : (
            <p className="mt-4 text-sm text-white/45">
              Add a short message to make it feel personal ✨
            </p>
          )}
        </div>

        <div className="mt-6 flex items-end justify-between gap-4 flex-wrap">
          <div className="flex flex-col gap-1">
            <span className="text-[11px] uppercase tracking-[0.18em] text-white/40">
              Code
            </span>
            <span className="inline-flex items-center gap-2 rounded-2xl bg-white/5 border border-white/10 px-4 py-2">
              <span className="font-mono text-xs sm:text-sm tracking-widest text-white/90">
                {code || "GIFT-XXXX-XXXX"}
              </span>
              <span className="h-2 w-2 rounded-full bg-emerald-400/80" />
            </span>
          </div>

          <div className="text-right">
            <p className="text-[11px] uppercase tracking-[0.18em] text-white/40">
              From
            </p>
            <p className="text-sm font-medium text-white/80">
              {senderName || "You"}
            </p>
          </div>
        </div>

        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_0%,rgba(255,255,255,0.10),transparent_45%)]" />
      </div>
    </div>
  );
}

function CreatedSuccess({ card, onReset }) {
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  const redeemUrl = useMemo(() => {
    const origin = window.location.origin;
    // ✅ তোমার route অনুযায়ী
    return `${origin}/gift-card/claim/redeem?code=${encodeURIComponent(
      card.code
    )}`;
  }, [card.code]);

  const copy = async (text, which) => {
    try {
      await navigator.clipboard.writeText(text);
      if (which === "code") {
        setCopiedCode(true);
        setTimeout(() => setCopiedCode(false), 1500);
      } else {
        setCopiedLink(true);
        setTimeout(() => setCopiedLink(false), 1500);
      }
      message.success("Copied!");
    } catch {
      message.error("Copy failed.");
    }
  };

  const waText = `Here is your gift card 🎁\nCode: ${card.code}\nRedeem: ${redeemUrl}`;
  const waLink = `https://wa.me/?text=${encodeURIComponent(waText)}`;
  const messengerLink = `https://www.messenger.com/`;

  const amountText = useMemo(() => {
    const n = Number(card.amount);
    return Number.isFinite(n) ? `৳${n.toFixed(2)}` : `৳${card.amount}`;
  }, [card.amount]);

  return (
    <div className="rounded-3xl border border-emerald-200 bg-emerald-50 p-6 sm:p-7 shadow-sm">
      <div className="flex items-start gap-4">
        <div className="h-11 w-11 rounded-2xl bg-emerald-600/10 border border-emerald-600/20 flex items-center justify-center">
          <CheckCircleFilled className="text-emerald-600 text-2xl" />
        </div>
        <div className="flex-1">
          <h3 className="text-lg sm:text-xl font-bold text-zinc-900 leading-tight">
            Gift Card Created
          </h3>
          <p className="text-sm text-zinc-600 mt-1">
            Copy and share the code/link with the recipient.
          </p>
        </div>
      </div>

      <div className="mt-5 rounded-2xl bg-white border border-emerald-200 px-4 py-3 flex items-center justify-between gap-3">
        <span className="font-mono text-base sm:text-lg font-extrabold tracking-widest text-zinc-900">
          {card.code}
        </span>
        <Tooltip title={copiedCode ? "Copied!" : "Copy code"}>
          <Button
            type="primary"
            onClick={() => copy(card.code, "code")}
            icon={
              copiedCode ? (
                <CheckCircleFilled className="text-white" />
              ) : (
                <CopyOutlined />
              )
            }
            className="rounded-xl"
          >
            {copiedCode ? "Copied" : "Copy"}
          </Button>
        </Tooltip>
      </div>

      <div className="mt-3 rounded-2xl bg-white border border-emerald-200 px-4 py-3 flex items-center justify-between gap-3">
        <span className="text-sm text-zinc-700 truncate">
          <span className="font-semibold">Redeem:</span> {redeemUrl}
        </span>
        <Tooltip title={copiedLink ? "Copied!" : "Copy link"}>
          <Button
            onClick={() => copy(redeemUrl, "link")}
            icon={<LinkOutlined />}
            className="rounded-xl"
          >
            {copiedLink ? "Copied" : "Copy"}
          </Button>
        </Tooltip>
      </div>

      <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
        <div className="rounded-2xl bg-white/70 border border-emerald-200 px-4 py-3">
          <p className="text-[11px] uppercase tracking-[0.16em] text-zinc-500">
            Amount
          </p>
          <p className="font-semibold text-zinc-900">{amountText}</p>
        </div>
        <div className="rounded-2xl bg-white/70 border border-emerald-200 px-4 py-3">
          <p className="text-[11px] uppercase tracking-[0.16em] text-zinc-500">
            Delivery
          </p>
          <p className="font-semibold text-zinc-900">Manual share</p>
        </div>
      </div>

      <div className="mt-5 flex flex-wrap gap-2">
        <Button
          icon={<WhatsAppOutlined />}
          className="rounded-xl"
          onClick={() => window.open(waLink, "_blank")}
        >
          Share WhatsApp
        </Button>
        <Button
          icon={<MessageOutlined />}
          className="rounded-xl"
          onClick={() => window.open(messengerLink, "_blank")}
        >
          Open Messenger
        </Button>
      </div>

      <div className="mt-5 flex items-center justify-between gap-3 flex-wrap">
        <Button onClick={onReset} className="rounded-xl">
          Create another
        </Button>
      </div>
    </div>
  );
}

export default function CreateGiftCard() {
  const currentUser = useSelector((state) => state.auth.user);
  const token = useSelector((state) => state.auth.token) || "";
  const navigate = useNavigate();

  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [created, setCreated] = useState(null);
  const [preview, setPreview] = useState({ amount: "", message: "" });

  const handleValuesChange = (_, allValues) => {
    setPreview({
      amount: allValues.amount ?? "",
      message: allValues.message ?? "",
    });
  };

  const handlePresetAmount = (amt) => {
    form.setFieldValue("amount", amt);
    setPreview((p) => ({ ...p, amount: amt }));
  };

  const handleSubmit = async (values) => {
    if (!currentUser || !token) {
      message.error("Please login first");
      return;
    }

    setLoading(true);
    try {
      const payload = {
        amount: parseFloat(values.amount),
        message: values.message || null,
        expiryDays: values.expiryDays ?? 30,
        senderId: currentUser.id,
        recipientEmail: null, // ✅ only manual
      };

      const res = await API.post("/giftcards/create", payload, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setCreated(res.data.giftCard);
      message.success("Gift card created successfully!");
    } catch (err) {
      message.error(err.response?.data?.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setCreated(null);
    form.resetFields();
    setPreview({ amount: "", message: "" });
  };

  return (
    <div className="relative">
      <div className="absolute inset-0 -z-10 bg-gradient-to-b from-zinc-50 via-white to-zinc-50" />
      <div className="absolute inset-0 -z-10 gc-soft-grid opacity-[0.28]" />

      <div className="max-w-6xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-7 sm:mb-9 flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-zinc-900">
              Create a Gift Card
            </h1>
            <p className="text-zinc-600 mt-2">
              Create a code and share it manually (WhatsApp/Messenger/DM).
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <Button
              className="rounded-2xl"
              onClick={() => navigate("/profile/my-giftcards")}
            >
              My Cards
            </Button>
            <Button
              className="rounded-2xl"
              onClick={() => navigate("/gift-card/claim")}
            >
              Claim
            </Button>

            <div className="inline-flex items-center gap-2 rounded-2xl border border-zinc-200 bg-white px-3 py-2 shadow-sm">
              <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-zinc-900 text-white">
                <GiftOutlined />
              </span>
              <div className="leading-tight">
                <p className="text-xs text-zinc-500">Signed in as</p>
                <p className="text-sm font-semibold text-zinc-900">
                  {currentUser?.name || "Guest"}
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
          <Card
            className="rounded-3xl border border-zinc-100 shadow-sm"
            bodyStyle={{ padding: 28 }}
          >
            <div className="mb-4">
              <p className="text-sm font-semibold text-zinc-900">Gift Details</p>
              <p className="text-xs text-zinc-500 mt-1">
                Pick an amount + optional message, then create & share.
              </p>
            </div>

            <Form
              form={form}
              layout="vertical"
              onFinish={handleSubmit}
              onValuesChange={handleValuesChange}
              initialValues={{ expiryDays: 30 }}
              requiredMark={false}
            >
              <Form.Item
                label={
                  <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
                    Amount (৳)
                  </span>
                }
                name="amount"
                rules={[
                  { required: true, message: "Please enter an amount" },
                  { type: "number", min: 1, message: "Min ৳1" },
                ]}
              >
                <div className="space-y-3">
                  <div className="flex flex-wrap gap-2">
                    {PRESET_AMOUNTS.map((amt) => {
                      const selected = Number(preview.amount) === amt;
                      return (
                        <button
                          key={amt}
                          type="button"
                          onClick={() => handlePresetAmount(amt)}
                          className={[
                            "px-4 py-2 rounded-full text-sm font-semibold border transition-all",
                            "active:scale-[0.98]",
                            selected
                              ? "bg-zinc-900 border-zinc-900 text-white shadow-sm"
                              : "bg-white border-zinc-200 text-zinc-600 hover:border-zinc-400 hover:text-zinc-900",
                          ].join(" ")}
                        >
                          ৳{amt}
                        </button>
                      );
                    })}
                  </div>

                  <InputNumber
                    className="w-full"
                    placeholder="Or enter a custom amount..."
                    min={1}
                    size="large"
                    prefix={<DollarOutlined className="text-zinc-400" />}
                    value={form.getFieldValue("amount")}
                    onChange={(val) => {
                      form.setFieldValue("amount", val);
                      setPreview((p) => ({ ...p, amount: val }));
                    }}
                  />
                </div>
              </Form.Item>

              <Form.Item
                label={
                  <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
                    Personal Message{" "}
                    <span className="normal-case font-normal text-zinc-400">
                      (optional)
                    </span>
                  </span>
                }
                name="message"
              >
                <TextArea
                  rows={3}
                  placeholder="e.g. Happy Birthday! Hope you enjoy this gift 🎂"
                  showCount
                  maxLength={200}
                />
              </Form.Item>

              <Form.Item
                label={
                  <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
                    Validity Period
                  </span>
                }
                name="expiryDays"
              >
                <Select size="large" suffixIcon={<CalendarOutlined />}>
                  <Option value={7}>7 days</Option>
                  <Option value={30}>30 days</Option>
                  <Option value={90}>90 days</Option>
                  <Option value={365}>1 year</Option>
                  <Option value={null}>No expiry</Option>
                </Select>
              </Form.Item>

              <Divider className="my-4" />

              <Form.Item className="mb-0">
                <Button
                  type="primary"
                  htmlType="submit"
                  loading={loading}
                  icon={<SendOutlined />}
                  size="large"
                  className="w-full h-12 text-base font-semibold rounded-2xl"
                  style={{ background: "#0a0a0a", borderColor: "#0a0a0a" }}
                >
                  {loading ? "Creating..." : "Create Gift Card"}
                </Button>

                <p className="mt-3 text-xs text-zinc-500">
                  Manual share only: Copy the code/link after creation and send it.
                </p>
              </Form.Item>
            </Form>
          </Card>

          <div className="space-y-5 lg:sticky lg:top-24">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
                Live Preview
              </p>
              <span className="text-xs text-zinc-400">Manual share</span>
            </div>

            <GiftCardPreview
              amount={preview.amount}
              messageText={preview.message}
              senderName={currentUser?.name}
              code={null}
            />

            <Divider className="my-4" />

            {created ? (
              <CreatedSuccess card={created} onReset={handleReset} />
            ) : (
              <div className="rounded-3xl border border-zinc-200 bg-white p-6 text-center shadow-sm">
                <div className="mx-auto h-12 w-12 rounded-2xl bg-zinc-900 text-white flex items-center justify-center">
                  <GiftOutlined className="text-2xl" />
                </div>
                <p className="mt-3 text-sm font-semibold text-zinc-900">
                  Ready when you are
                </p>
                <p className="mt-1 text-sm text-zinc-500">
                  Create a card, then share by code/link.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      <style>{`
        .gc-diagonal-pattern{
          background-image: repeating-linear-gradient(
            135deg,
            rgba(255,255,255,0.9) 0px,
            rgba(255,255,255,0.9) 1px,
            transparent 1px,
            transparent 14px
          );
        }
        .gc-soft-grid{
          background-image:
            linear-gradient(to right, rgba(0,0,0,0.04) 1px, transparent 1px),
            linear-gradient(to bottom, rgba(0,0,0,0.04) 1px, transparent 1px);
          background-size: 28px 28px;
        }
      `}</style>
    </div>
  );
}
