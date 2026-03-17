// src/components/reviews/ProductReviews.jsx
import React, { useEffect, useMemo, useState } from "react";
import {
  Card,
  Typography,
  Space,
  Rate,
  Button,
  Spin,
  Empty,
  Divider,
  Alert,
  Input,
  Select,
  Avatar,
  Tag,
  message,
  Upload,
  Image,
} from "antd";
import { PlusOutlined } from "@ant-design/icons";
import { User } from "lucide-react";
import axios from "axios";
import { useSelector } from "react-redux";
import { normalizeImageUrl } from "../../utils/imageUrl";
import { API_BASE_URL } from "../../config/env";
import { UPLOAD_BASE_URL } from "../../config/env";

const { Title, Text } = Typography;
const { TextArea } = Input;

const API_BASE = API_BASE_URL;
const UPLOAD_URL = `${UPLOAD_BASE_URL}/upload/image?scope=reviews`; 

const cleanImage = (url) => normalizeImageUrl(url);

const timeAgo = (dateStr) => {
  const d = new Date(dateStr);
  const diff = Date.now() - d.getTime();
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  if (day < 30) return `${day}d ago`;
  return d.toLocaleDateString();
};

export default function ProductReviews({ productId, product, onStatsUpdate }) {
  const token = useSelector((s) => s.auth?.token);

  // list state
  const [reviews, setReviews] = useState([]);
  const [total, setTotal] = useState(0);

  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);

  const [sortKey, setSortKey] = useState("newest");
  const [limit, setLimit] = useState(4);

  // eligibility + form
  const [elig, setElig] = useState({
    canReview: false,
    alreadyReviewed: false,
    reviewId: null,
  });
  const [myRating, setMyRating] = useState(5);
  const [myTitle, setMyTitle] = useState("");
  const [myComment, setMyComment] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // ✅ review images (selected files)
  const [fileList, setFileList] = useState([]); // antd Upload fileList
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewImage, setPreviewImage] = useState("");
  const [previewTitle, setPreviewTitle] = useState("");

  const MAX_REVIEW_IMAGES = 4;
  const MAX_SIZE_MB = 5;

  const sortQuery = useMemo(() => {
    if (sortKey === "oldest") return { sort: "asc" };
    if (sortKey === "top") return { sort: "desc", orderBy: "rating" };
    return { sort: "desc" };
  }, [sortKey]);

  const fetchReviews = async ({ reset = false } = {}) => {
    try {
      setLoading(true);

      const nextPage = reset ? 1 : page;

      const res = await axios.get(`${API_BASE}/api/reviews/product/${productId}`, {
        params: { page: nextPage, limit, sort: sortQuery.sort },
      });

      if (res.data?.success) {
        const incoming = res.data.reviews || [];
        const totalCount = Number(res.data.total || 0);

        setTotal(totalCount);

        if (reset) {
          setReviews(incoming);
          setPage(2);
        } else {
          setReviews((prev) => [...prev, ...incoming]);
          setPage((p) => p + 1);
        }
      }
    } catch (e) {
      message.error(e.response?.data?.message || "Failed to load reviews");
    } finally {
      setLoading(false);
    }
  };

  const fetchEligibility = async () => {
    if (!token) {
      setElig({ canReview: false, alreadyReviewed: false, reviewId: null });
      return;
    }
    try {
      const res = await axios.get(`${API_BASE}/api/reviews/eligibility/${productId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.data?.success) setElig(res.data);
    } catch (e) {
    }
  };

  useEffect(() => {
    setReviews([]);
    setPage(1);
    fetchReviews({ reset: true });
    fetchEligibility();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productId, sortKey, limit, token]);

  const displayReviews = useMemo(() => {
    if (sortKey !== "top") return reviews;
    return [...reviews].sort((a, b) => Number(b.rating || 0) - Number(a.rating || 0));
  }, [reviews, sortKey]);

  const hasMore = displayReviews.length < total;

  // ✅ Upload helpers
  const beforeUpload = (file) => {
    const isImage = file.type?.startsWith("image/");
    if (!isImage) {
      message.error("Only image files are allowed");
      return Upload.LIST_IGNORE;
    }

    const isLt = file.size / 1024 / 1024 < MAX_SIZE_MB;
    if (!isLt) {
      message.error(`Image must be smaller than ${MAX_SIZE_MB}MB`);
      return Upload.LIST_IGNORE;
    }

    // prevent auto upload (আমরা submit এ upload করবো)
    return false;
  };

  const handlePreview = async (file) => {
    // file.thumbUrl might exist; otherwise create base64
    const src = file.url || file.thumbUrl;
    if (src) {
      setPreviewImage(src);
      setPreviewOpen(true);
      setPreviewTitle(file.name || "Preview");
      return;
    }

    const origin = file.originFileObj;
    if (!origin) return;

    const toBase64 = (f) =>
      new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(f);
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
      });

    const base64 = await toBase64(origin);
    setPreviewImage(base64);
    setPreviewOpen(true);
    setPreviewTitle(file.name || "Preview");
  };

  const uploadReviewImagesTo5001 = async () => {
    // fileList → actual File objects
    const files = (fileList || [])
      .map((f) => f.originFileObj)
      .filter(Boolean);

    if (!files.length) return [];

    // Upload each file and keep relative /public paths
    const uploadPromises = files.map((file) => {
      const fd = new FormData();
      fd.append("file", file);
      return fetch(UPLOAD_URL, { method: "POST", body: fd });
    });

    const uploadResponses = await Promise.all(uploadPromises);

    const uploadJson = await Promise.all(
      uploadResponses.map(async (res) => {
        if (!res.ok) throw new Error("Image upload failed");
        return res.json();
      })
    );

    const paths = uploadJson.flatMap((u) => u.paths || []);
    return paths;
  };

  const submitReview = async () => {
    if (!token) return message.info("Please login first");
    if (!elig.canReview || elig.alreadyReviewed) return;

    try {
      setSubmitting(true);

      // ✅ 1) upload images to 5001 (if any)
      let imageUrls = [];
      if (fileList.length) {
        imageUrls = await uploadReviewImagesTo5001();
      }

      // ✅ 2) submit review to 3001
      const payload = {
        productId: Number(productId),
        rating: Number(myRating),
        title: myTitle,
        comment: myComment,
        images: imageUrls,
      };

      const res = await axios.post(`${API_BASE}/api/reviews`, payload, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.data?.success) {
        message.success("Review submitted!");
        setMyTitle("");
        setMyComment("");
        setMyRating(5);
        setFileList([]); // ✅ clear selected images

        // refresh list
        setReviews([]);
        setPage(1);
        await fetchReviews({ reset: true });
        await fetchEligibility();

        if (res.data.productStats && typeof onStatsUpdate === "function") {
          onStatsUpdate(res.data.productStats);
        }
      } else {
        message.error(res.data?.message || "Failed");
      }
    } catch (e) {
      message.error(e.response?.data?.message || e.message || "Failed");
    } finally {
      setSubmitting(false);
    }
  };

  const avg = Number(product?.averageRating || product?.rating || 0);
  const totalReviews = Number(product?.totalReviews || total || 0);

  return (
    <Card style={{ marginTop: 24 }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: 12,
          flexWrap: "wrap",
          width: "100%",
        }}
      >
        <div>
          <Title level={4} style={{ marginBottom: 2 }}>
            Reviews
          </Title>
          <Space size="small">
            <Rate disabled allowHalf value={avg} />
            <Text type="secondary">
              {avg ? avg.toFixed(1) : "0.0"} ({totalReviews})
            </Text>
          </Space>
        </div>

        <Space wrap>
          <Select
            value={sortKey}
            onChange={setSortKey}
            style={{ width: 160, maxWidth: "100%" }}
            options={[
              { value: "newest", label: "Newest" },
              { value: "oldest", label: "Oldest" },
              { value: "top", label: "Top rated" },
            ]}
          />
          <Select
            value={limit}
            onChange={setLimit}
            style={{ width: 150, maxWidth: "100%" }}
            options={[
              { value: 3, label: "Show 3" },
              { value: 4, label: "Show 4" },
              { value: 6, label: "Show 6" },
            ]}
          />
        </Space>
      </div>

      <Divider style={{ margin: "16px 0" }} />

      {/* Review form */}
      {!token ? (
        <Alert
          type="info"
          showIcon
          message="Login required"
          description="You need to login to submit a review."
        />
      ) : elig.alreadyReviewed ? (
        <Alert type="success" showIcon message="You already reviewed this product." />
      ) : elig.canReview ? (
        <Card
          type="inner"
          title="Write a review"
          style={{ marginBottom: 16, borderRadius: 14 }}
          styles={{ body: { padding : 16 }}}
        >
          <Space direction="vertical" style={{ width: "100%" }} size="middle">
            <Space align="center" wrap>
              <Text strong>Rating:</Text>
              <Rate value={myRating} onChange={setMyRating} />
              <Tag color="blue">{myRating}/5</Tag>
            </Space>

            <Input
              value={myTitle}
              onChange={(e) => setMyTitle(e.target.value)}
              placeholder="Title (optional)"
              maxLength={120}
            />

            <TextArea
              rows={4}
              value={myComment}
              onChange={(e) => setMyComment(e.target.value)}
              placeholder="Write your experience..."
            />

            {/* ✅ images upload */}
            <div>
              <Text type="secondary">Add photos (optional)</Text>
              <div style={{ marginTop: 8 }}>
                <Upload
                  listType="picture-card"
                  multiple
                  beforeUpload={beforeUpload}
                  fileList={fileList}
                  onChange={({ fileList: fl }) => setFileList(fl.slice(0, MAX_REVIEW_IMAGES))}
                  onPreview={handlePreview}
                  accept="image/*"
                >
                  {fileList.length >= MAX_REVIEW_IMAGES ? null : (
                    <div>
                      <PlusOutlined />
                      <div style={{ marginTop: 8 }}>Upload</div>
                    </div>
                  )}
                </Upload>

                <Image
                  wrapperStyle={{ display: "none" }}
                  preview={{
                    visible: previewOpen,
                    onVisibleChange: (v) => setPreviewOpen(v),
                    afterOpenChange: (v) => !v && setPreviewImage(""),
                  }}
                  src={previewImage}
                />
              </div>
              <Text type="secondary" style={{ fontSize: 12 }}>
                Max {MAX_REVIEW_IMAGES} images, {MAX_SIZE_MB}MB each.
              </Text>
            </div>

            <Button type="primary" loading={submitting} onClick={submitReview}>
              Submit Review
            </Button>
          </Space>
        </Card>
      ) : (
        <Alert
          type="warning"
          showIcon
          title="Not eligible to review"
          description="You can review only after ordering and receiving (delivered) this product."
        />
      )}

      {/* Review list */}
      {displayReviews.length === 0 && !loading ? (
        <Empty description="No reviews yet" />
      ) : (
        <Space orientation="vertical" style={{ width: "100%" }} size="middle">
          {displayReviews.map((r) => (
            <Card key={r.id} type="inner" style={{ borderRadius: 14 }} bodyStyle={{ padding: 14 }}>
              <div
                style={{
                  width: "100%",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "flex-start",
                  gap: 12,
                  flexWrap: "wrap",
                }}
              >
                <div style={{ display: "flex", alignItems: "flex-start", gap: 10, minWidth: 0, flex: "1 1 320px" }}>
                  <Avatar
                    src={cleanImage(r.user?.imageUrl)}
                    icon={<User size={18} />}
                    size={44}
                    style={{ flex: "0 0 auto" }}
                  />
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <Space size="small" wrap>
                      <Text strong>{r.user?.name || "User"}</Text>
                      <Rate disabled value={Number(r.rating || 0)} style={{ fontSize: 14 }} />
                      <Tag color="gold">{Number(r.rating || 0)}/5</Tag>
                    </Space>

                    {r.title && (
                      <div style={{ marginTop: 6 }}>
                        <Text strong>{r.title}</Text>
                      </div>
                    )}
                    {r.comment && (
                      <div style={{ marginTop: 6 }}>
                        <Text>{r.comment}</Text>
                      </div>
                    )}

                    {/* ✅ review images gallery */}
                    {Array.isArray(r.images) && r.images.length > 0 && (
                      <div style={{ marginTop: 10 }}>
                        <Image.PreviewGroup>
                          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                            {r.images.map((imgUrl, idx) => (
                              <Image
                                key={`${r.id}-img-${idx}`}
                                src={cleanImage(imgUrl)}
                                width={86}
                                height={86}
                                style={{ objectFit: "cover", borderRadius: 10 }}
                              />
                            ))}
                          </div>
                        </Image.PreviewGroup>
                      </div>
                    )}
                  </div>
                </div>

                <Text type="secondary" style={{ whiteSpace: "nowrap", marginLeft: "auto" }}>
                  {timeAgo(r.createdAt)}
                </Text>
              </div>
            </Card>
          ))}

          {hasMore && (
            <div style={{ display: "flex", justifyContent: "center", marginTop: 8 }}>
              <Button onClick={() => fetchReviews({ reset: false })} loading={loading}>
                Show more
              </Button>
            </div>
          )}

          {!hasMore && displayReviews.length > 0 && (
            <div style={{ textAlign: "center", marginTop: 6 }}>
              <Text type="secondary">No more reviews</Text>
            </div>
          )}

          {loading && displayReviews.length === 0 && (
            <div style={{ textAlign: "center" }}>
              <Spin />
            </div>
          )}
        </Space>
      )}
    </Card>
  );
}
