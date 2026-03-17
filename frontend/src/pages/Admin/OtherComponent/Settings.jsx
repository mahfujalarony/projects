import React, { useEffect, useMemo, useState } from "react";
import {
  Card,
  Form,
  Input,
  InputNumber,
  Button,
  Upload,
  message,
  Row,
  Col,
} from "antd";
import { UploadOutlined } from "@ant-design/icons";
import axios from "axios";
import { useSelector } from "react-redux";
import { API_BASE_URL, UPLOAD_BASE_URL } from "../../../config/env";
import { normalizeImageUrl } from "../../../utils/imageUrl";

const API_BASE = `${API_BASE_URL}/api`;
const UPLOAD_URL = `${UPLOAD_BASE_URL}/upload/image?scope=logo`;
const MAX_SITE_NAME_LENGTH = 24;

const Settings = () => {
  const reduxToken = useSelector((state) => state.auth?.token);
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [logoUploading, setLogoUploading] = useState(false);
  const logoUrlValue = Form.useWatch("siteLogoUrl", form);

  const token = useMemo(() => {
    if (reduxToken) return reduxToken;
    try {
      const saved = JSON.parse(localStorage.getItem("userInfo") || "null");
      return saved?.token || null;
    } catch {
      return null;
    }
  }, [reduxToken]);

  useEffect(() => {
    if (!token) return;
    fetchSettings();
  }, [token]);

  const fetchSettings = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API_BASE}/admin/settings`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (res.data?.success) {
        const next = { ...(res.data.data || {}) };
        const rawSuggestions = next.searchSuggestions;
        next.searchSuggestions = Array.isArray(rawSuggestions)
          ? rawSuggestions.join("\n")
          : String(rawSuggestions || "");
        const durationHours = Math.round(Number(next.storyDurationHours || 24));
        next.storyDurationDays = Math.max(1, Math.round(durationHours / 24));
        form.setFieldsValue(next);
      }
    } catch (error) {

    } finally {
      setLoading(false);
    }
  };

  const onFinish = async (values) => {
    setSaving(true);
    try {
      const payload = { ...values };
      payload.siteLogoUrl = String(form.getFieldValue("siteLogoUrl") || "").trim();
      payload.searchSuggestions = String(values.searchSuggestions || "")
        .split(/\r?\n|,/)
        .map((x) => String(x || "").trim())
        .filter(Boolean)
        .slice(0, 50);
      payload.storyDurationHours = Math.max(1, Math.round(Number(values.storyDurationDays || 1))) * 24;
      delete payload.storyDurationDays;

      await axios.put(`${API_BASE}/admin/settings`, payload, {
        headers: { Authorization: `Bearer ${token}` },
      });
      message.success("Settings updated");
      window.dispatchEvent(
        new CustomEvent("app-settings-updated", {
          detail: {
            siteName: String(payload.siteName || "").trim(),
            siteLogoUrl: payload.siteLogoUrl,
          },
        })
      );
    } catch (error) {

      message.error("Failed to update settings");
    } finally {
      setSaving(false);
    }
  };

  const uploadLogo = async ({ file, onSuccess, onError }) => {
    try {
      setLogoUploading(true);
      const fd = new FormData();
      fd.append("images", file);
      const res = await fetch(UPLOAD_URL, { method: "POST", body: fd });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.message || "Logo upload failed");
      const savedPath = json?.paths?.[0] || "";
      if (!savedPath) throw new Error("Upload succeeded but no file path returned");
      form.setFieldValue("siteLogoUrl", savedPath);
      message.success("Logo uploaded");
      onSuccess?.(json, file);
    } catch (err) {
      message.error(err?.message || "Logo upload failed");
      onError?.(err);
    } finally {
      setLogoUploading(false);
    }
  };

  const containerStyle = {
    maxWidth: 820,
    margin: "8px auto 16px",
    padding: "8px 10px 14px",
    borderRadius: 14,
    background:
      "linear-gradient(135deg, rgba(255,199,102,0.12) 0%, rgba(255,122,162,0.1) 42%, rgba(112,215,255,0.12) 100%)",
  };

  const cardStyle = {
    borderRadius: 14,
    border: "1px solid rgba(255, 255, 255, 0.45)",
    boxShadow: "0 8px 24px rgba(15, 23, 42, 0.06)",
    overflow: "hidden",
  };

  return (
    <div style={containerStyle}>
      <Card
        title={
          <div>
            <div style={{ fontSize: 18, fontWeight: 700, color: "#1f2937" }}>Global Settings</div>
            <div style={{ fontSize: 12, color: "#4b5563", marginTop: 2 }}>
              Update delivery, support, social links, search suggestions, and branding.
            </div>
          </div>
        }
        loading={loading}
        style={cardStyle}
        headStyle={{
          background: "linear-gradient(90deg, #fff4cc 0%, #ffe3ef 52%, #e4f7ff 100%)",
          borderBottom: "1px solid #f3f4f6",
          padding: "10px 16px",
        }}
        bodyStyle={{ padding: "14px 16px 12px" }}
      >
        <Form
          layout="vertical"
          form={form}
          onFinish={onFinish}
          requiredMark={false}
          size="middle"
          style={{ marginBottom: 0 }}
        >
          <Row gutter={[12, 2]}>
            <Col xs={24} md={12}>
              <Form.Item
                label="Delivery Charge (USD)"
                name="deliveryCharge"
                rules={[{ required: true, message: "Please enter the delivery charge." }]}
                style={{ marginBottom: 12 }}
              >
                <InputNumber style={{ width: "100%" }} min={0} />
              </Form.Item>
            </Col>

            <Col xs={24} md={12}>
              <Form.Item
                label="Seller Commission (%)"
                name="sellerCommission"
                rules={[{ required: true, message: "Please enter the seller commission rate." }]}
                help="This percentage is applied to each product sale."
                style={{ marginBottom: 12 }}
              >
                <InputNumber
                  style={{ width: "100%" }}
                  min={0}
                  max={100}
                  formatter={(value) => `${value}%`}
                  parser={(value) => value?.replace("%", "")}
                />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={[12, 2]}>
            <Col xs={24} md={12}>
              <Form.Item
                label="Story Post Fee (USD)"
                name="storyPostFee"
                rules={[{ required: true, message: "Please enter the story post fee." }]}
                help="This amount is deducted from the merchant balance when publishing a story."
                style={{ marginBottom: 12 }}
              >
                <InputNumber style={{ width: "100%" }} min={0} precision={0} />
              </Form.Item>
            </Col>

            <Col xs={24} md={12}>
              <Form.Item
                label="Story Duration (Days)"
                name="storyDurationDays"
                rules={[{ required: true, message: "Please enter story duration days." }]}
                help="Merchants cannot modify this duration."
                style={{ marginBottom: 12 }}
              >
                <InputNumber
                  style={{ width: "100%" }}
                  min={1}
                  precision={0}
                  addonAfter="day(s)"
                />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={[12, 2]}>
            <Col xs={24} md={12}>
              <Form.Item
                label="Support Email"
                name="supportEmail"
                rules={[
                  { required: true, message: "Please enter a support email address." },
                  { type: "email", message: "Please enter a valid email address." },
                ]}
                help="Shown in the footer for customer support."
                style={{ marginBottom: 12 }}
              >
                <Input placeholder="support@yourshop.com" />
              </Form.Item>
            </Col>

            <Col xs={24} md={12}>
              <Form.Item
                label="Support WhatsApp Number"
                name="supportWhatsapp"
                rules={[{ required: true, message: "Please enter a support WhatsApp number." }]}
                help="Format example: +8801712345678"
                style={{ marginBottom: 12 }}
              >
                <Input placeholder="+8801712345678" />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={[12, 2]}>
            <Col xs={24} md={12}>
              <Form.Item
                label="Facebook Page URL"
                name="facebookUrl"
                rules={[{ type: "url", message: "Please enter a valid URL." }]}
                help="Used for the Facebook icon link in the footer."
                style={{ marginBottom: 12 }}
              >
                <Input placeholder="https://facebook.com/yourpage" />
              </Form.Item>
            </Col>

            <Col xs={24} md={12}>
              <Form.Item
                label="YouTube Channel URL"
                name="youtubeUrl"
                rules={[{ type: "url", message: "Please enter a valid URL." }]}
                help="Used for the YouTube icon link in the footer."
                style={{ marginBottom: 12 }}
              >
                <Input placeholder="https://youtube.com/@yourchannel" />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={[12, 2]}>
            <Col xs={24} md={24}>
              <Form.Item
                label="Shop Name"
                name="siteName"
                rules={[
                  {
                    max: MAX_SITE_NAME_LENGTH,
                    message: `Shop name can be up to ${MAX_SITE_NAME_LENGTH} characters.`,
                  },
                ]}
                help={`Displayed in the header and footer (max ${MAX_SITE_NAME_LENGTH} characters).`}
                style={{ marginBottom: 12 }}
              >
                <Input placeholder="Enter shop name" maxLength={MAX_SITE_NAME_LENGTH} showCount />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item
            label="Search Suggestions"
            name="searchSuggestions"
            help="One keyword per line or comma separated. Example: mobile, grocery, laptop"
            style={{ marginBottom: 12 }}
          >
            <Input.TextArea
              rows={4}
              placeholder={"mobile\nlaptop\ngrocery"}
            />
          </Form.Item>

          <Form.Item
            label="Site Logo"
            help="Upload a logo image. Manual URL input is disabled."
            style={{ marginBottom: 14 }}
          >
            <Form.Item name="siteLogoUrl" hidden>
              <Input />
            </Form.Item>
            <Upload accept="image/*" showUploadList={false} customRequest={uploadLogo} maxCount={1}>
              <Button
                icon={<UploadOutlined />}
                loading={logoUploading}
                style={{
                  borderRadius: 10,
                  borderColor: "#ff9f43",
                  color: "#b45309",
                  fontWeight: 600,
                }}
              >
                Upload Logo
              </Button>
            </Upload>
            {logoUrlValue ? (
              <div className="mt-3">
                <img
                  src={normalizeImageUrl(logoUrlValue)}
                  alt="site-logo-preview"
                  className="h-12 w-12 rounded object-cover border border-gray-200"
                />
              </div>
            ) : null}
          </Form.Item>

          <Button
            type="primary"
            htmlType="submit"
            loading={saving}
            style={{
              width: "100%",
              height: 40,
              borderRadius: 10,
              border: "none",
              fontWeight: 700,
              background: "linear-gradient(90deg, #ff9f43 0%, #ff6b6b 48%, #4dabf7 100%)",
            }}
          >
            Save Changes
          </Button>
        </Form>
      </Card>
    </div>
  );
};

export default Settings;
