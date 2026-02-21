import React, { useEffect, useMemo, useState } from "react";
import { Card, Form, InputNumber, Button, message } from "antd";
import axios from "axios";
import { useSelector } from "react-redux";
import { API_BASE_URL } from "../../../config/env";

const API_BASE = `${API_BASE_URL}/api`;

const Settings = () => {
  const reduxToken = useSelector((state) => state.auth?.token);
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

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
        form.setFieldsValue(res.data.data);
      }
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const onFinish = async (values) => {
    setSaving(true);
    try {
      await axios.put(`${API_BASE}/admin/settings`, values, {
        headers: { Authorization: `Bearer ${token}` },
      });
      message.success("Settings updated");
    } catch (error) {
      console.error(error);
      message.error("Failed to update settings");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ padding: 20, maxWidth: 600, margin: "0 auto" }}>
      <Card title="Global Settings" loading={loading}>
        <Form layout="vertical" form={form} onFinish={onFinish}>
          <Form.Item
            label="Delivery Charge (৳)"
            name="deliveryCharge"
            rules={[{ required: true, message: "Please set a delivery charge" }]}
          >
            <InputNumber style={{ width: "100%" }} min={0} />
          </Form.Item>

          <Form.Item
            label="Seller Commission (%)"
            name="sellerCommission"
            rules={[{ required: true, message: "Please set seller commission" }]}
            help="This percentage will be calculated on product sales"
          >
            <InputNumber
              style={{ width: "100%" }}
              min={0}
              max={100}
              formatter={(value) => `${value}%`}
              parser={(value) => value?.replace("%", "")}
            />
          </Form.Item>

          <Button type="primary" htmlType="submit" loading={saving}>
            Save Changes
          </Button>
        </Form>
      </Card>
    </div>
  );
};

export default Settings;
