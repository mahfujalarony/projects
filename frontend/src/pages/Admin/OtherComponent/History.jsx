import React, { useEffect, useMemo, useState } from "react";
import { Card, Empty, Spin } from "antd";
import axios from "axios";
import { useSelector } from "react-redux";
import { API_BASE_URL } from "../../../config/env";

const API_BASE = `${API_BASE_URL}/api`;

const toLocalText = (iso) => {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso);
  return d.toLocaleString();
};

const History = () => {
  const reduxToken = useSelector((state) => state.auth?.token);
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState([]);

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
    const load = async () => {
      setLoading(true);
      try {
        const res = await axios.get(`${API_BASE}/admin/history?limit=300`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.data?.success) {
          setItems(Array.isArray(res.data.data) ? res.data.data : []);
        }
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [token]);

  return (
    <Card
      title="Admin History"
      bodyStyle={{ padding: 12 }}
      headStyle={{ fontWeight: 700 }}
    >
      {loading ? (
        <div className="py-8 text-center">
          <Spin />
        </div>
      ) : items.length === 0 ? (
        <Empty description="No history yet" />
      ) : (
        <div className="space-y-2">
          {items.map((row) => (
            <div key={row.id} className="rounded border border-gray-200 bg-gray-50 px-3 py-2">
              <p className="text-sm text-gray-800">{row.message}</p>
              <p className="text-xs text-gray-500 mt-1">{toLocalText(row.createdAt)}</p>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
};

export default History;
