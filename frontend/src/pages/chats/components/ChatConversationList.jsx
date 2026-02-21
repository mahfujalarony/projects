import React from "react";
import { List, Avatar, Typography, Badge, Tag, Spin, Input, Button } from "antd";
import { UserOutlined, CustomerServiceOutlined, ArrowLeftOutlined } from "@ant-design/icons";

const { Text, Title } = Typography;
const { Search } = Input;

const ChatConversationList = ({
  chatId,
  chatLoading,
  chatLoadingMore,
  filteredChatList,
  chatSearch,
  onSearchChange,
  onChatListScroll,
  onOpenChat,
  getPartnerMeta,
  getAvatarUrl,
  getConversationPreview,
  formatRelativeAgo,
  isSupportViewer,
  onHeaderClick,
  onBackClick,
  showGlobalSearchLabel = true,
}) => {
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <div style={{ padding: "16px", borderBottom: "1px solid #f0f0f0" }}>
        <Button
          type="text"
          icon={<ArrowLeftOutlined />}
          onClick={onBackClick}
          style={{ marginBottom: 8, paddingInline: 0 }}
        >
          Back
        </Button>
        <Title level={4} style={{ marginBottom: 14, cursor: onHeaderClick ? "pointer" : "default" }} onClick={onHeaderClick}>
          Support Inbox
        </Title>
        <Search
          placeholder="Global search: name, id, status, message"
          allowClear
          value={chatSearch}
          onChange={(e) => onSearchChange(e.target.value)}
        />
        {showGlobalSearchLabel && (
          <Text type="secondary" style={{ display: "block", marginTop: 8, fontSize: 12 }}>
            Search works across loaded conversations and their preview text.
          </Text>
        )}
      </div>

      <div onScroll={onChatListScroll} style={{ flex: 1, overflowY: "auto" }}>
        <List
          itemLayout="horizontal"
          loading={chatLoading}
          dataSource={filteredChatList}
          locale={{ emptyText: "No conversations found" }}
          renderItem={(item) => {
            const meta = getPartnerMeta(item);
            const avatarSrc = getAvatarUrl(meta?.imageUrl);
            const isEndUser = !isSupportViewer;
            const isSupportChat = String(item.contextType || "").toLowerCase() === "support";
            const preview = getConversationPreview(item);
            const listTitle = isEndUser && isSupportChat ? "Support Chat" : meta?.name || `User #${item.customerId}`;
            const useSupportIcon = isEndUser && isSupportChat;

            return (
              <List.Item
                onClick={() => onOpenChat(item.id)}
                style={{
                  cursor: "pointer",
                  padding: "12px 16px",
                  backgroundColor: String(chatId) === String(item.id) ? "#eff6ff" : "transparent",
                  borderBottom: "1px solid #f3f4f6",
                }}
              >
                <List.Item.Meta
                  avatar={
                    <Avatar
                      size={44}
                      src={useSupportIcon ? null : avatarSrc}
                      icon={useSupportIcon ? <CustomerServiceOutlined /> : !avatarSrc && <UserOutlined />}
                      style={
                        useSupportIcon
                          ? { background: "linear-gradient(135deg, #2563eb 0%, #0ea5e9 100%)", color: "#fff" }
                          : undefined
                      }
                    />
                  }
                  title={
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                      <Text strong ellipsis style={{ maxWidth: 170 }}>
                        {listTitle}
                      </Text>
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        {formatRelativeAgo(item.lastMessageAt)}
                      </Text>
                    </div>
                  }
                  description={
                    <div style={{ display: "grid", gap: 6 }}>
                      <Text type="secondary" ellipsis style={{ maxWidth: 230, display: "block", fontSize: 13 }}>
                        {preview}
                      </Text>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                        <Tag color={item.status === "open" ? "blue" : "default"} style={{ marginInlineEnd: 0 }}>
                          {item.status || "open"}
                        </Tag>
                        {Number(item.unreadCount || 0) > 0 && (
                          <Badge count={Number(item.unreadCount)} size="small" style={{ backgroundColor: "#1677ff" }} />
                        )}
                      </div>
                    </div>
                  }
                />
              </List.Item>
            );
          }}
        />
        {chatLoadingMore && (
          <div style={{ textAlign: "center", padding: "10px 0" }}>
            <Spin size="small" />
          </div>
        )}
      </div>
    </div>
  );
};

export default ChatConversationList;
