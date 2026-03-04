// src/pages/ClaimGiftCard.jsx
import { useEffect, useMemo, useState } from "react";
import { Input, Button, Card, message, Divider, Statistic, Alert, Avatar } from "antd";
import {
  GiftOutlined,
  CheckCircleFilled,
  CloseCircleFilled,
  SearchOutlined,
  ThunderboltOutlined,
  WalletOutlined,
  UserOutlined,
  MailOutlined,
} from "@ant-design/icons";
import axios from "axios";
import { useSelector } from "react-redux";
import { useLocation, useNavigate } from "react-router-dom";
import { API_BASE_URL } from "../../config/env";
import { normalizeImageUrl } from "../../utils/imageUrl";

const API = axios.create({
  baseURL: `${API_BASE_URL}/api`,
  headers: { "Content-Type": "application/json" },
});

function formatGiftCode(raw) {
  const clean = (raw || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  const withoutPrefix = clean.startsWith("GIFT") ? clean.slice(4) : clean;
  const body = withoutPrefix.slice(0, 12);

  if (!body) return "";
  if (body.length <= 4) return `GIFT-${body}`;
  if (body.length <= 8) return `GIFT-${body.slice(0, 4)}-${body.slice(4)}`;
  return `GIFT-${body.slice(0, 4)}-${body.slice(4, 8)}-${body.slice(8)}`;
}

function CardPreview({ data }) {
  return (
    <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-zinc-950 shadow-2xl">
      <div className="absolute inset-0 bg-gradient-to-br from-zinc-950 via-zinc-900 to-zinc-950" />
      <div className="absolute inset-0 gc-diagonal-pattern opacity-[0.12]" />
      <div className="absolute -top-24 -right-24 h-56 w-56 rounded-full bg-fuchsia-500/20 blur-3xl" />
      <div className="absolute -bottom-28 -left-28 h-72 w-72 rounded-full bg-amber-500/15 blur-3xl" />

      <div className="relative p-7 sm:p-8">
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
                Verified Gift Card
              </p>
            </div>
          </div>

          <span className="inline-flex items-center rounded-full bg-white/5 border border-white/10 px-3 py-1 text-xs text-white/70">
            Ready to claim
          </span>
        </div>

        <div className="mt-7">
          <p className="text-5xl sm:text-6xl font-extrabold tracking-tight text-white leading-none">
            ${parseFloat(data.amount).toFixed(2)}
          </p>

          {data.message ? (
            <div className="mt-4 rounded-2xl bg-white/5 border border-white/10 px-4 py-3">
              <p className="text-sm text-white/70 italic leading-relaxed">
                “{data.message}”
              </p>
            </div>
          ) : (
            <p className="mt-4 text-sm text-white/45">
              No message included.
            </p>
          )}
        </div>

        <Divider className="border-white/10 my-5" />

        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-white/55">
          {data.creatorName && (
            <span className="flex items-center gap-1">
              <UserOutlined /> From: {data.creatorName}
            </span>
          )}
          {data.expiresAt && (
            <span>
              Expires: {new Date(data.expiresAt).toLocaleDateString("en-GB")}
            </span>
          )}
        </div>

        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_0%,rgba(255,255,255,0.10),transparent_45%)]" />
      </div>
    </div>
  );
}

function ClaimSuccessBanner({ result, onClaimAnother }) {
  return (
    <div className="rounded-3xl border border-emerald-200 bg-emerald-50 p-7 sm:p-8 shadow-sm text-center">
      <div className="text-5xl mb-3">🎉</div>
      <h2 className="text-2xl sm:text-3xl font-extrabold text-zinc-900">
        Claimed Successfully!
      </h2>
      <p className="text-sm text-zinc-600 mt-2">
        The balance has been added to your account.
      </p>

      <div className="mt-6 grid grid-cols-2 gap-4 max-w-xs mx-auto">
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-emerald-200">
          <Statistic
            title={<span className="text-xs text-zinc-500">Claimed</span>}
            value={parseFloat(result.claimedAmount).toFixed(2)}
            prefix="$"
            valueStyle={{ color: "#16a34a", fontSize: 22, fontWeight: 800 }}
          />
        </div>
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-emerald-200">
          <Statistic
            title={<span className="text-xs text-zinc-500">New Balance</span>}
            value={parseFloat(result.newBalance).toFixed(2)}
            prefix="$"
            valueStyle={{ color: "#0a0a0a", fontSize: 22, fontWeight: 800 }}
          />
        </div>
      </div>

      <Button onClick={onClaimAnother} size="large" className="rounded-2xl font-semibold mt-6">
        Claim Another
      </Button>
    </div>
  );
}

export default function ClaimGiftCard() {
  const currentUser = useSelector((state) => state.auth.user);
  const location = useLocation();
  const navigate = useNavigate();

  const [displayCode, setDisplayCode] = useState("");
  const [preview, setPreview] = useState(null);
  const [verifying, setVerifying] = useState(false);
  const [claiming, setClaiming] = useState(false);
  const [claimResult, setClaimResult] = useState(null);
  const [codeError, setCodeError] = useState("");

  useEffect(() => {
    const qs = new URLSearchParams(location.search);
    const codeFromUrl = qs.get("code");
    if (codeFromUrl) {
      const formatted = formatGiftCode(codeFromUrl);
      setDisplayCode(formatted);
      setPreview(null);
      setClaimResult(null);
      setCodeError("");
      Promise.resolve().then(() => {
        if (formatted) handleVerify(formatted);
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.search]);

  const handleCodeChange = (e) => {
    const formatted = formatGiftCode(e.target.value);
    setDisplayCode(formatted);
    setPreview(null);
    setCodeError("");
    setClaimResult(null);
  };

  const clearAll = () => {
    setDisplayCode("");
    setPreview(null);
    setCodeError("");
    setClaimResult(null);
  };

  const handleVerify = async (forcedCode) => {
    const code = (forcedCode ?? displayCode).trim();

    if (!code || code === "GIFT-" || code.length < 9) {
      setCodeError("Please enter a gift card code");
      return;
    }

    setVerifying(true);
    setCodeError("");
    try {
      const uid = currentUser?.id ? `?userId=${encodeURIComponent(currentUser.id)}` : "";
      const res = await API.get(`/giftcards/verify/${encodeURIComponent(code)}${uid}`);
      setPreview(res.data);
      if (!res.data.valid) {
        setCodeError(res.data.message || "This code is not valid");
      }
    } catch (err) {
      const status = err.response?.status;
      const msg =
        err.response?.data?.message ||
        "Verification failed. Try again.";
      if (status === 429) {
        message.error(msg);
      }
      setCodeError(msg);
    } finally {
      setVerifying(false);
    }
  };

  const handleClaim = async () => {
    if (!currentUser) {
      message.warning("Please login first");
      return;
    }
    if (!preview?.valid) return;

    setClaiming(true);
    try {
      const res = await API.post("/giftcards/claim", {
        code: displayCode.trim(),
        userId: currentUser.id,
      });
      setClaimResult(res.data);
      message.success("Gift card claimed successfully!");
    } catch (err) {
      const status = err.response?.status;
      const msg =
        err.response?.data?.message ||
        "Claim failed. Please try again.";
      if (status === 429) {
        message.error(msg);
      } else {
        message.error(msg);
      }
    } finally {
      setClaiming(false);
    }
  };

  const rightBalance = useMemo(() => {
    const n = Number(currentUser?.balance || 0);
    return Number.isFinite(n) ? n.toFixed(2) : "0.00";
  }, [currentUser?.balance]);

  return (
    <div className="relative">
      <div className="absolute inset-0 -z-10 bg-gradient-to-b from-zinc-50 via-white to-zinc-50" />
      <div className="absolute inset-0 -z-10 gc-soft-grid opacity-[0.28]" />

      <div className="max-w-6xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 mb-10">
          <div>
            <h1 className="text-3xl sm:text-4xl font-black text-zinc-900 tracking-tight">
              Claim a Gift Card
            </h1>
            <p className="text-zinc-500 mt-2 text-sm sm:text-base font-medium">
              Verify your gift card and add the balance instantly.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 sm:gap-4">
            <div className="hidden sm:inline-flex items-center gap-3 rounded-2xl border border-zinc-200 bg-white px-4 py-2.5 shadow-sm">
              <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-zinc-900 text-white shadow-sm">
                <GiftOutlined />
              </span>
              <div className="leading-tight pr-2">
                <p className="text-[10px] uppercase font-bold tracking-wider text-zinc-400">Gift Flow</p>
                <p className="text-sm font-black text-zinc-900">
                  {currentUser ? "Wallet Ready" : "Guest"}
                </p>
              </div>
            </div>

            <Button
              size="large"
              className="rounded-2xl font-semibold shadow-sm border-zinc-200"
              onClick={() => navigate("/profile/my-giftcards")}
            >
              My Cards
            </Button>
            <Button
              type="primary"
              size="large"
              className="rounded-2xl font-semibold shadow-md bg-zinc-900 hover:bg-zinc-800"
              onClick={() => navigate("/gift-card")}
              icon={<GiftOutlined />}
            >
              Send Gift Card
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
          <div className="lg:col-span-2 space-y-5">
            {claimResult ? (
              <ClaimSuccessBanner
                result={claimResult}
                onClaimAnother={() => clearAll()}
              />
            ) : (
              <Card className="rounded-3xl border border-zinc-100 shadow-sm" bodyStyle={{ padding: 28 }}>
                <div className="mb-6">
                  <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-2">
                    Gift Card Code
                  </label>

                  <div className="flex gap-3">
                    <Input
                      size="large"
                      className="font-mono text-lg tracking-widest flex-1"
                      placeholder="ENTER GIFT CODE"
                      value={displayCode}
                      onChange={handleCodeChange}
                      maxLength={19}
                      status={codeError ? "error" : ""}
                      onPressEnter={() => handleVerify()}
                      prefix={<GiftOutlined className="text-zinc-400" />}
                      allowClear
                      onClear={clearAll}
                    />

                    <Button
                      size="large"
                      icon={<SearchOutlined />}
                      onClick={() => handleVerify()}
                      loading={verifying}
                      disabled={!displayCode}
                      className="shrink-0 rounded-2xl font-semibold px-5"
                      style={{ background: "#0a0a0a", borderColor: "#0a0a0a", color: "#fff" }}
                    >
                      Verify
                    </Button>
                  </div>

                  {codeError && (
                    <p className="mt-2 text-red-500 text-sm flex items-center gap-1">
                      <CloseCircleFilled /> {codeError}
                    </p>
                  )}
                </div>

                {preview?.valid && (
                  <div className="space-y-4 animate-fade-up">
                    <div className="flex items-center gap-2 text-emerald-600 text-sm font-semibold">
                      <CheckCircleFilled /> Valid gift card found
                    </div>

                    <CardPreview data={preview} />

                    <Button
                      type="primary"
                      size="large"
                      icon={<ThunderboltOutlined />}
                      onClick={handleClaim}
                      loading={claiming}
                      className="w-full text-base font-bold rounded-2xl"
                      style={{
                        background: "linear-gradient(135deg, #8a6820, #c9a840)",
                        borderColor: "transparent",
                        height: 52,
                      }}
                    >
                      {claiming
                        ? "Claiming..."
                        : `Claim $${parseFloat(preview.amount).toFixed(2)}`}
                    </Button>

                    <p className="text-center text-xs text-zinc-500">
                      Claiming will instantly add this amount to your balance.
                    </p>
                  </div>
                )}

                {preview && !preview.valid && (
                  <Alert
                    type="error"
                    showIcon
                    message="Wrong gift card code"
                    description="Please check the code and try again, or ask the sender to resend."
                    className="rounded-2xl"
                  />
                )}
              </Card>
            )}
          </div>

          <div className="space-y-4">
            <Card className="rounded-3xl border border-zinc-100 shadow-sm" bodyStyle={{ padding: 24 }}>
              <h4 className="text-base font-semibold text-zinc-900 mb-4">Your Account</h4>

              {currentUser ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-3 p-3 bg-zinc-50 rounded-2xl">
                    <Avatar
                      size={40}
                      src={normalizeImageUrl(currentUser?.imageUrl)}
                      icon={!currentUser?.imageUrl && <UserOutlined />}
                      style={{ backgroundColor: "#111827", flex: "0 0 auto" }}
                    />
                    <div className="min-w-0">
                      <p className="font-semibold text-zinc-900 text-sm truncate">
                        {currentUser.name}
                      </p>
                      <p className="text-zinc-500 text-xs truncate flex items-center gap-1">
                        <MailOutlined className="text-[10px]" /> {currentUser.email}
                      </p>
                    </div>
                  </div>

                  <div className="bg-gradient-to-br from-zinc-950 to-zinc-900 rounded-2xl p-4 text-center border border-white/10">
                    <p className="text-white/60 text-xs uppercase tracking-wider mb-1">
                      Current Balance
                    </p>
                    <p className="text-3xl font-extrabold text-white">
                      ${rightBalance}
                    </p>
                    <WalletOutlined className="text-white/40 text-lg mt-2" />
                  </div>
                </div>
              ) : (
                <p className="text-zinc-500 text-sm">
                  Please login to claim gift cards and see your balance.
                </p>
              )}
            </Card>

            <Card className="rounded-3xl border border-zinc-100 shadow-sm" bodyStyle={{ padding: 20 }}>
              <h5 className="font-semibold text-zinc-900 text-sm mb-3">How to claim</h5>
              <ol className="space-y-2 text-xs text-zinc-600 list-none">
                {[
                  "Paste your gift card code",
                  "Press Verify to check validity",
                  "Press Claim to add balance",
                ].map((step, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <span className="shrink-0 w-5 h-5 rounded-full bg-zinc-900 text-white font-bold flex items-center justify-center text-[10px]">
                      {i + 1}
                    </span>
                    {step}
                  </li>
                ))}
              </ol>
            </Card>
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
