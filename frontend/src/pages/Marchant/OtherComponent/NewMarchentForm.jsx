import React, { useEffect, useMemo, useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { Button, Card, Typography, Divider, Input, Form, message, Alert, Row, Col, Tag } from "antd";
import { UploadOutlined } from "@ant-design/icons";
import axios from "axios";
import { API_BASE_URL } from "../../../config/env";
import { UPLOAD_BASE_URL } from "../../../config/env";

const { Title, Text } = Typography;

const API_BASE = `${API_BASE_URL}`;
const IMG_BASE = `${UPLOAD_BASE_URL}`;
const uploadBoxStyle = {
  border: "1px dashed #94a3b8",
  background: "#f8fafc",
  borderRadius: 10,
  padding: "14px 12px",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  gap: 4,
  cursor: "pointer",
  textAlign: "center",
};

const safeJson = (s, fallback = null) => {
  try { return JSON.parse(s); } catch { return fallback; }
};

const getToken = () => safeJson(localStorage.getItem("userInfo"), null)?.token || null;
const getUserInfo = () => safeJson(localStorage.getItem("userInfo"), null)?.user || null;

const toSafeFolderName = (value) => {
  const raw = String(value || "").trim().toLowerCase();
  if (!raw) return "";
  return raw
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
};

const extractUrl = (d) => {
  if (Array.isArray(d?.paths)) return d.paths;
  const u = d?.url || d?.imageUrl;
  if (u) return [u];
  return [];
};

const MerchantRegistration = () => {
  const { control, handleSubmit, reset, watch, formState: { errors, isSubmitting } } = useForm({
    defaultValues: {
      YourAddress: "",
      phoneNumber: "",
      idNumber: "",
      paypalEmail: "",
      stripeAccountId: "",
      bankName: "",
      accountNumber: "",
      swiftCode: "",
      description: "",
      facebook: "",
      instagram: "",
      website: "",
    },
  });

  const [frontFile, setFrontFile] = useState(null);
  const [backFile, setBackFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [settings, setSettings] = useState({ sellerCommission: null, storyPostFee: null });

  const token = getToken();
  const user = getUserInfo();
  const merchantBaseName = useMemo(() => {
    const byName = toSafeFolderName(user?.name);
    if (byName) return byName;
    const byEmail = toSafeFolderName((user?.email || "").split("@")[0]);
    if (byEmail) return byEmail;
    return `merchant-${user?.id || "user"}`;
  }, [user?.name, user?.email, user?.id]);

  const frontPreview = useMemo(() => (frontFile ? URL.createObjectURL(frontFile) : null), [frontFile]);
  const backPreview = useMemo(() => (backFile ? URL.createObjectURL(backFile) : null), [backFile]);

  const validateImage = (file) => {
    if (!file.type.startsWith("image/")) return "Only images allowed";
    if (file.size > 5 * 1024 * 1024) return "Max 5MB";
    return null;
  };

  const handleFrontChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const err = validateImage(file);
    if (err) return message.error(err);
    setFrontFile(file);
  };

  const handleBackChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const err = validateImage(file);
    if (err) return message.error(err);
    setBackFile(file);
  };

  const paypalEmail = watch("paypalEmail");
  const stripeAccountId = watch("stripeAccountId");
  const bankName = watch("bankName");

  useEffect(() => {
    let ignore = false;
    (async () => {
      try {
        const { data } = await axios.get(`${API_BASE}/api/settings`);
        const s = data?.data || {};
        if (!ignore) {
          setSettings({
            sellerCommission: Number(s?.sellerCommission ?? 0),
            storyPostFee: Number(s?.storyPostFee ?? 0),
          });
        }
      } catch {
        if (!ignore) {
          setSettings({ sellerCommission: 0, storyPostFee: 0 });
        }
      }
    })();
    return () => {
      ignore = true;
    };
  }, []);

  const onSubmit = async (data) => {
    setSubmitAttempted(true);
    if (!frontFile || !backFile) return message.error("Both front and back images are required");
    if (!token) return message.error("Please login first");

    const hasPayout =
      (paypalEmail || "").trim() ||
      (stripeAccountId || "").trim() ||
      (bankName || "").trim();

    if (!hasPayout) {
      return message.error("At least one payout method is required (PayPal, Stripe, or Bank)");
    }

    setUploading(true);

    try {
      // 1) Upload images to image server
      const uploadFiles = [frontFile, backFile];
      const uploadResponses = [];
      for (const file of uploadFiles) {
        const fd = new FormData();
        fd.append("file", file);
        const response = await axios.post(
          `${IMG_BASE}/upload/image?scope=merchant&name=${encodeURIComponent(merchantBaseName)}&id=${encodeURIComponent(user?.id || "")}`,
          fd,
          {
            headers: { "Content-Type": "multipart/form-data" },
          }
        );
        uploadResponses.push(response);
      }
      const urls = uploadResponses.flatMap((r) => extractUrl(r.data));

      if (urls.length < 2) throw new Error("Failed to upload both images");

      // 2) Build socialLinks JSON (model: JSON)
      const socialLinks = {
        facebook: (data.facebook || "").trim() || undefined,
        instagram: (data.instagram || "").trim() || undefined,
        website: (data.website || "").trim() || undefined,
      };

      // remove empty keys
      Object.keys(socialLinks).forEach((k) => socialLinks[k] === undefined && delete socialLinks[k]);

      // 3) Payload (model fields অনুযায়ী)
      const payload = {
        YourAddress: data.YourAddress?.trim() || "",
        phoneNumber: data.phoneNumber?.trim() || null,

        idNumber: data.idNumber?.trim() || "",
        idFrontImage: urls[0],
        idBackImage: urls[1],

        paypalEmail: data.paypalEmail?.trim() || null,
        stripeAccountId: data.stripeAccountId?.trim() || null,

        bankName: data.bankName?.trim() || null,
        accountNumber: data.accountNumber?.trim() || null,
        swiftCode: data.swiftCode?.trim() || null,

        description: data.description?.trim() || null,
        socialLinks: Object.keys(socialLinks).length ? socialLinks : null,
      };

      await axios.post(`${API_BASE}/api/merchant/register`, payload, {
        headers: { Authorization: `Bearer ${token}` },
      });

      message.success("Merchant registration submitted! Waiting for approval.");
      reset();
      setFrontFile(null);
      setBackFile(null);
      setSubmitAttempted(false);
    } catch (err) {
      message.error(err?.response?.data?.message || err.message || "Something went wrong");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div
      style={{
        maxWidth: 1050,
        margin: "22px auto",
        padding: "0 14px 28px",
        background:
          "radial-gradient(circle at top right, rgba(56,189,248,0.08), transparent 40%), radial-gradient(circle at top left, rgba(45,212,191,0.10), transparent 35%)",
      }}
    >
      <Card
        bordered={false}
        style={{
          boxShadow: "0 12px 30px rgba(15, 23, 42, 0.08)",
          borderRadius: 16,
          overflow: "hidden",
        }}
        headStyle={{
          background: "linear-gradient(92deg, #e0f2fe 0%, #ecfeff 45%, #f0fdf4 100%)",
          borderBottom: "1px solid #e5e7eb",
        }}
      >
        <Title level={3} style={{ textAlign: "center", marginBottom: 8 }}>
          Merchant Registration
        </Title>
        <Text type="secondary" style={{ display: "block", textAlign: "center", marginBottom: 24 }}>
          Submit your details. Admin will review and approve.
        </Text>

        <Alert
          type="info"
          showIcon
          style={{ marginBottom: 18, borderRadius: 12 }}
          message={
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
              <span style={{ fontWeight: 600 }}>Merchant Rules:</span>
              <Tag color="blue" style={{ whiteSpace: "normal", wordBreak: "break-word", lineHeight: 1.35 }}>
                Commission: {Number(settings?.sellerCommission || 0)}% per product sale
              </Tag>
              <Tag color="purple" style={{ whiteSpace: "normal", wordBreak: "break-word", lineHeight: 1.35 }}>
                Story Post Fee: USD {Number(settings?.storyPostFee || 0).toFixed(2)}
              </Tag>
              <Tag color="green" style={{ whiteSpace: "normal", wordBreak: "break-word", lineHeight: 1.35 }}>
                At least one payout method is required
              </Tag>
              <Tag color="orange" style={{ whiteSpace: "normal", wordBreak: "break-word", lineHeight: 1.35 }}>
                ID front + back image must be uploaded
              </Tag>
            </div>
          }
          description="Please provide accurate documents and payout details. Incomplete or incorrect submissions may be rejected by admin."
        />

        <Form layout="vertical" onFinish={handleSubmit(onSubmit)}>
          <Divider orientation="left">Contact & Address</Divider>

          <Row gutter={14} style={{ marginBottom: 12 }}>
            <Col xs={24} md={12}>
              <Form.Item
                label="Address *"
                validateStatus={errors.YourAddress ? "error" : ""}
                help={errors.YourAddress?.message}
              >
                <Controller
                  name="YourAddress"
                  control={control}
                  rules={{ required: "Address is required" }}
                  render={({ field }) => <Input {...field} placeholder="Your full address" />}
                />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item label="Phone Number (optional)">
                <Controller
                  name="phoneNumber"
                  control={control}
                  render={({ field }) => <Input {...field} placeholder="01XXXXXXXXX" />}
                />
              </Form.Item>
            </Col>
            <Col xs={24}>
              <Form.Item label="Description (optional)">
                <Controller
                  name="description"
                  control={control}
                  render={({ field }) => (
                    <Input.TextArea {...field} rows={4} placeholder="Tell about your shop / services" />
                  )}
                />
              </Form.Item>
            </Col>
          </Row>

          <Divider orientation="left">Identity Verification</Divider>

          <Row gutter={14} style={{ marginBottom: 12 }}>
            <Col xs={24}>
              <Form.Item
                label="ID / Passport Number *"
                validateStatus={errors.idNumber ? "error" : ""}
                help={errors.idNumber?.message}
              >
                <Controller
                  name="idNumber"
                  control={control}
                  rules={{ required: "ID/Passport number is required" }}
                  render={({ field }) => <Input {...field} placeholder="Your ID number" />}
                />
              </Form.Item>
            </Col>

            <Col xs={24} md={12}>
              <Form.Item
                label="ID/Passport Front Side *"
                validateStatus={submitAttempted && !frontFile ? "error" : ""}
                help={submitAttempted && !frontFile ? "Front image is required" : ""}
              >
                <label htmlFor="merchant-id-front-upload" style={uploadBoxStyle}>
                  <UploadOutlined style={{ fontSize: 22, color: "#0ea5e9" }} />
                  <div style={{ fontWeight: 700, color: "#0f172a" }}>Click to upload front side</div>
                  <div style={{ fontSize: 12, color: "#64748b" }}>JPG/PNG, max 5MB</div>
                  {frontFile && (
                    <div style={{ marginTop: 2, fontSize: 12, color: "#16a34a", fontWeight: 600 }}>
                      Selected: {frontFile.name}
                    </div>
                  )}
                </label>
                <input
                  id="merchant-id-front-upload"
                  type="file"
                  accept="image/*"
                  onChange={handleFrontChange}
                  style={{ display: "none" }}
                />
                {frontPreview && (
                  <div style={{ marginTop: 12, maxWidth: 260, position: "relative" }}>
                    <img src={frontPreview} alt="Front Preview" style={{ width: "100%", borderRadius: 8 }} />
                    <Button
                      danger
                      size="small"
                      onClick={() => setFrontFile(null)}
                      style={{ position: "absolute", top: 8, right: 8 }}
                    >
                      Remove
                    </Button>
                  </div>
                )}
              </Form.Item>
            </Col>

            <Col xs={24} md={12}>
              <Form.Item
                label="ID/Passport Back Side *"
                validateStatus={submitAttempted && !backFile ? "error" : ""}
                help={submitAttempted && !backFile ? "Back image is required" : ""}
              >
                <label htmlFor="merchant-id-back-upload" style={uploadBoxStyle}>
                  <UploadOutlined style={{ fontSize: 22, color: "#0ea5e9" }} />
                  <div style={{ fontWeight: 700, color: "#0f172a" }}>Click to upload back side</div>
                  <div style={{ fontSize: 12, color: "#64748b" }}>JPG/PNG, max 5MB</div>
                  {backFile && (
                    <div style={{ marginTop: 2, fontSize: 12, color: "#16a34a", fontWeight: 600 }}>
                      Selected: {backFile.name}
                    </div>
                  )}
                </label>
                <input
                  id="merchant-id-back-upload"
                  type="file"
                  accept="image/*"
                  onChange={handleBackChange}
                  style={{ display: "none" }}
                />
                {backPreview && (
                  <div style={{ marginTop: 12, maxWidth: 260, position: "relative" }}>
                    <img src={backPreview} alt="Back Preview" style={{ width: "100%", borderRadius: 8 }} />
                    <Button
                      danger
                      size="small"
                      onClick={() => setBackFile(null)}
                      style={{ position: "absolute", top: 8, right: 8 }}
                    >
                      Remove
                    </Button>
                  </div>
                )}
              </Form.Item>
            </Col>
          </Row>

          <Divider orientation="left">Payout Methods (at least one required)</Divider>

          <Row gutter={14} style={{ marginBottom: 12 }}>
            <Col xs={24} md={12}>
              <Form.Item label="PayPal Email">
                <Controller
                  name="paypalEmail"
                  control={control}
                  render={({ field }) => <Input {...field} placeholder="name@example.com" />}
                />
              </Form.Item>
            </Col>

            <Col xs={24} md={12}>
              <Form.Item label="Stripe Account ID">
                <Controller
                  name="stripeAccountId"
                  control={control}
                  render={({ field }) => <Input {...field} placeholder="acct_..." />}
                />
              </Form.Item>
            </Col>

            <Col xs={24} md={8}>
              <Form.Item label="Bank Name">
                <Controller
                  name="bankName"
                  control={control}
                  render={({ field }) => <Input {...field} placeholder="e.g., DBBL / Brac / City" />}
                />
              </Form.Item>
            </Col>

            <Col xs={24} md={8}>
              <Form.Item label="Account Number">
                <Controller name="accountNumber" control={control} render={({ field }) => <Input {...field} />} />
              </Form.Item>
            </Col>

            <Col xs={24} md={8}>
              <Form.Item label="SWIFT Code">
                <Controller name="swiftCode" control={control} render={({ field }) => <Input {...field} />} />
              </Form.Item>
            </Col>

            <Col xs={24}>
              <Text type="secondary">
                Note: Provide at least one of PayPal / Stripe / Bank. Otherwise registration will be rejected.
              </Text>
            </Col>
          </Row>

          <Divider orientation="left">Social Links (optional)</Divider>

          <Row gutter={14} style={{ marginBottom: 12 }}>
            <Col xs={24} md={8}>
              <Form.Item label="Facebook">
                <Controller name="facebook" control={control} render={({ field }) => <Input {...field} />} />
              </Form.Item>
            </Col>

            <Col xs={24} md={8}>
              <Form.Item label="Instagram">
                <Controller name="instagram" control={control} render={({ field }) => <Input {...field} />} />
              </Form.Item>
            </Col>

            <Col xs={24} md={8}>
              <Form.Item label="Website">
                <Controller name="website" control={control} render={({ field }) => <Input {...field} />} />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item style={{ textAlign: "center", marginTop: 28 }}>
            <Button
              type="primary"
              htmlType="submit"
              loading={isSubmitting || uploading}
              size="large"
              style={{
                minWidth: 260,
                border: "none",
                fontWeight: 700,
                borderRadius: 10,
                background: "linear-gradient(90deg, #0ea5e9 0%, #14b8a6 100%)",
              }}
            >
              {uploading ? "Uploading & Submitting..." : "Submit for Review"}
            </Button>
          </Form.Item>
        </Form>
      </Card>
    </div>
  );
};

export default MerchantRegistration;
