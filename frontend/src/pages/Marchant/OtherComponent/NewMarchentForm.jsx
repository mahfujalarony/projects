import React, { useMemo, useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { Button, Card, Space, Typography, Divider, Input, Form, message } from "antd";
import axios from "axios";
import { API_BASE_URL } from "../../../config/env";
import { UPLOAD_BASE_URL } from "../../../config/env";

const { Title, Text } = Typography;

const API_BASE = `${API_BASE_URL}`;
const IMG_BASE = `${UPLOAD_BASE_URL}`;

const safeJson = (s, fallback = null) => {
  try { return JSON.parse(s); } catch { return fallback; }
};

const getToken = () => safeJson(localStorage.getItem("userInfo"), null)?.token || null;

const extractUrl = (d) => {
  const u = d?.url || d?.imageUrl;
  if (u) return [u];
  if (Array.isArray(d?.urls)) return d.urls;
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

  const token = getToken();

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

  const onSubmit = async (data) => {
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
      const uploadFiles = [frontFile, backFile].map((file) => {
        const fd = new FormData();
        fd.append("file", file);
        return axios.post(`${IMG_BASE}/upload/image`, fd, {
          headers: { "Content-Type": "multipart/form-data" },
        });
      });

      const uploadResponses = await Promise.all(uploadFiles);
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
    } catch (err) {
      message.error(err?.response?.data?.message || err.message || "Something went wrong");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div style={{ maxWidth: 1000, margin: "40px auto", padding: "0 20px" }}>
      <Card bordered={false} style={{ boxShadow: "0 2px 8px rgba(0,0,0,0.1)" }}>
        <Title level={3} style={{ textAlign: "center", marginBottom: 8 }}>
          Merchant Registration
        </Title>
        <Text type="secondary" style={{ display: "block", textAlign: "center", marginBottom: 24 }}>
          Submit your details. Admin will review and approve.
        </Text>

        <Form layout="vertical" onFinish={handleSubmit(onSubmit)}>
          <Divider orientation="left">Contact & Address</Divider>

          <Space direction="vertical" style={{ width: "100%", marginBottom: 24 }}>
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

            <Form.Item label="Phone Number (optional)">
              <Controller
                name="phoneNumber"
                control={control}
                render={({ field }) => <Input {...field} placeholder="01XXXXXXXXX" />}
              />
            </Form.Item>

            <Form.Item label="Description (optional)">
              <Controller
                name="description"
                control={control}
                render={({ field }) => (
                  <Input.TextArea {...field} rows={4} placeholder="Tell about your shop / services" />
                )}
              />
            </Form.Item>
          </Space>

          <Divider orientation="left">Identity Verification</Divider>

          <Space direction="vertical" style={{ width: "100%", marginBottom: 24 }}>
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

            <Form.Item
              label="ID/Passport Front Side *"
              validateStatus={!frontFile ? "error" : ""}
              help={!frontFile ? "Front image is required" : ""}
            >
              <input type="file" accept="image/*" onChange={handleFrontChange} />
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

            <Form.Item
              label="ID/Passport Back Side *"
              validateStatus={!backFile ? "error" : ""}
              help={!backFile ? "Back image is required" : ""}
            >
              <input type="file" accept="image/*" onChange={handleBackChange} />
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
          </Space>

          <Divider orientation="left">Payout Methods (at least one required)</Divider>

          <Space direction="vertical" style={{ width: "100%", marginBottom: 24 }}>
            <Form.Item label="PayPal Email">
              <Controller
                name="paypalEmail"
                control={control}
                render={({ field }) => <Input {...field} placeholder="name@example.com" />}
              />
            </Form.Item>

            <Form.Item label="Stripe Account ID">
              <Controller
                name="stripeAccountId"
                control={control}
                render={({ field }) => <Input {...field} placeholder="acct_..." />}
              />
            </Form.Item>

            <Form.Item label="Bank Name">
              <Controller
                name="bankName"
                control={control}
                render={({ field }) => <Input {...field} placeholder="e.g., DBBL / Brac / City" />}
              />
            </Form.Item>

            <Form.Item label="Account Number">
              <Controller name="accountNumber" control={control} render={({ field }) => <Input {...field} />} />
            </Form.Item>

            <Form.Item label="SWIFT Code">
              <Controller name="swiftCode" control={control} render={({ field }) => <Input {...field} />} />
            </Form.Item>

            <Text type="secondary">
              Note: Provide at least one of PayPal / Stripe / Bank. Otherwise registration will be rejected.
            </Text>
          </Space>

          <Divider orientation="left">Social Links (optional)</Divider>

          <Space direction="vertical" style={{ width: "100%", marginBottom: 24 }}>
            <Form.Item label="Facebook">
              <Controller name="facebook" control={control} render={({ field }) => <Input {...field} />} />
            </Form.Item>

            <Form.Item label="Instagram">
              <Controller name="instagram" control={control} render={({ field }) => <Input {...field} />} />
            </Form.Item>

            <Form.Item label="Website">
              <Controller name="website" control={control} render={({ field }) => <Input {...field} />} />
            </Form.Item>
          </Space>

          <Form.Item style={{ textAlign: "center", marginTop: 28 }}>
            <Button
              type="primary"
              htmlType="submit"
              loading={isSubmitting || uploading}
              size="large"
              style={{ minWidth: 260 }}
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
