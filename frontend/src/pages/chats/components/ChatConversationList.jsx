import React, { useEffect, useRef } from "react";
import { List, Avatar, Typography, Badge, Tag, Spin, Input, Button, Checkbox } from "antd";
import { UserOutlined, CustomerServiceOutlined, DeleteOutlined } from "@ant-design/icons";

const { Text } = Typography;
const { Search } = Input;

const ChatConversationList = ({
  chatId,
  chatLoading,
  chatLoadingMore,
  filteredChatList,
  chatSearch,
  onSearchChange,
  onSearchSubmit,
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
  isSupportOnlyMode = false,
  onStartSupport,
  supportOpenBusy = false,
  canDeleteConversations = false,
  canManageConversations = false,
  selectionMode = false,
  selectedChatIds = [],
  onToggleSelectionMode,
  onToggleSelectChat,
  onDeleteChat,
  onDeleteSelected,
  deletingChatIds = [],
  deletingBulk = false,
  initialScrollTop = 0,
  onListScrollTopChange,
}) => {
  const selectedCount = Array.isArray(selectedChatIds) ? selectedChatIds.length : 0;
  const totalChats = Array.isArray(filteredChatList) ? filteredChatList.length : 0;
  const listWrapRef = useRef(null);

  useEffect(() => {
    const el = listWrapRef.current;
    if (!el) return;
    el.scrollTop = Number(initialScrollTop || 0);
  }, [initialScrollTop]);

  const EmptyState = () =>
  isSupportOnlyMode ? (
    <div style={{ padding: "28px 16px", textAlign: "center" }}>
      <div
        style={{
          width: 64,
          height: 64,
          borderRadius: 999,
          margin: "0 auto 12px",
          display: "grid",
          placeItems: "center",
          background: "linear-gradient(135deg, #dbeafe 0%, #cffafe 100%)",
          color: "#0f766e",
          fontSize: 24,
        }}
      >
        <CustomerServiceOutlined />
      </div>

      <Text strong style={{ display: "block", fontSize: 15, marginBottom: 6 }}>
        Support Chat
      </Text>

      <Text type="secondary" style={{ display: "block", marginBottom: 14, lineHeight: 1.45 }}>
        If you face any issues, message the admin/support team to get help.
      </Text>

      <Button
        type="primary"
        onClick={onStartSupport}
        loading={supportOpenBusy}
        icon={<CustomerServiceOutlined />}
      >
        Click to Start Chat
      </Button>
    </div>
  ) : (
    <div style={{ padding: "28px 16px", textAlign: "center" }}>
      <Text type="secondary">No conversations found</Text>
    </div>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <div
        style={{
          padding: "8px 10px 10px",
          borderBottom: "1px solid #e9eef5",
          background: "linear-gradient(180deg, #ffffff 0%, #fbfdff 100%)",
        }}
      >
        <Search
          placeholder={isSupportOnlyMode ? "Search support messages..." : "Search chats..."}
          allowClear
          value={chatSearch}
          onChange={(e) => onSearchChange(e.target.value)}
          onSearch={(value) => onSearchSubmit?.(value)}
          size="middle"
        />
        {canManageConversations && (
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10 }}>
            <Button
              size="small"
              onClick={onToggleSelectionMode}
              type={selectionMode ? "default" : "dashed"}
              style={{ borderRadius: 999 }}
            >
              {selectionMode ? "Cancel Select" : "Select Chats"}
            </Button>
            <Tag style={{ marginInlineEnd: 0, borderRadius: 999, background: "#f8fafc", borderColor: "#e2e8f0" }}>
              Total: {totalChats}
            </Tag>
            {selectionMode && (
              <Button
                size="small"
                danger
                icon={<DeleteOutlined />}
                disabled={!selectedCount}
                loading={deletingBulk}
                onClick={onDeleteSelected}
                style={{ borderRadius: 999 }}
              >
                Delete Selected{selectedCount ? ` (${selectedCount})` : ""}
              </Button>
            )}
          </div>
        )}
        {showGlobalSearchLabel && !canManageConversations && (
          <Text type="secondary" style={{ display: "block", marginTop: 8, fontSize: 12 }}>
            Search works across loaded conversations and their preview text.
          </Text>
        )}
      </div>

      <div
        ref={listWrapRef}
        onScroll={(e) => {
          onListScrollTopChange?.(e.currentTarget.scrollTop);
          onChatListScroll?.(e);
        }}
        style={{ flex: 1, overflowY: "auto", background: "linear-gradient(180deg, #f8fbff 0%, #f5f8fd 100%)" }}
      >
        <div>
          {chatLoading ? (
            <div style={{ padding: 16 }}>
              <Text type="secondary">Loading…</Text>
            </div>
          ) : filteredChatList?.length ? (
            <div style={{ padding: 4 }}>
              {filteredChatList.map((item) => {
                const meta = getPartnerMeta(item);
                const avatarSrc = getAvatarUrl(meta?.imageUrl);
                const isEndUser = !isSupportViewer;
                const isSupportChat = String(item.contextType || "").toLowerCase() === "support";
                const preview = getConversationPreview(item);
                const listTitle =
                  isEndUser && isSupportChat ? "Support Chat" : meta?.name || `User #${item.customerId}`;
                const useSupportIcon = isEndUser && isSupportChat;

                const isActive = String(chatId) === String(item.id);

                return (
                  <div
                    key={item.id}
                    onClick={() => onOpenChat(item.id)}
                    style={{
                      cursor: "pointer",
                      margin: "6px 8px",
                      padding: "10px 10px",
                      borderRadius: 14,
                      backgroundColor: isActive ? "#eff6ff" : "#ffffff",
                      border: isActive ? "1px solid #bfdbfe" : "1px solid #e8eef6",
                      boxShadow: isActive ? "0 8px 22px rgba(59,130,246,0.10)" : "0 2px 8px rgba(15,23,42,0.04)",
                      transition: "all 160ms ease",
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                    }}
                  >
                    {canManageConversations && selectionMode && (
                      <div onClick={(e) => e.stopPropagation()} style={{ marginRight: 2, alignSelf: "center" }}>
                        <Checkbox
                          checked={selectedChatIds.includes(item.id)}
                          onChange={(e) => onToggleSelectChat(item.id, e.target.checked)}
                        />
                      </div>
                    )}

                    {/* Avatar */}
                    <Avatar
                      size={40}
                      src={useSupportIcon ? null : avatarSrc}
                      icon={useSupportIcon ? <CustomerServiceOutlined /> : !avatarSrc && <UserOutlined />}
                      style={
                        useSupportIcon
                          ? {
                              background: "linear-gradient(135deg, #2563eb 0%, #0ea5e9 100%)",
                              color: "#fff",
                              fontSize: 18,
                            }
                          : undefined
                      }
                    />

                    {/* Content */}
                    <div style={{ minWidth: 0, flex: 1 }}>
                      {/* Title row */}
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                        <Text strong ellipsis style={{ maxWidth: 150, fontSize: 13, lineHeight: 1.2 }}>
                          {listTitle}
                        </Text>
                        <Text type="secondary" style={{ fontSize: 11, whiteSpace: "nowrap" }}>
                          {formatRelativeAgo(item.lastMessageAt)}
                        </Text>
                      </div>

                      {/* Preview + tags row */}
                      <div style={{ display: "grid", gap: 5, marginTop: 2 }}>
                        <Text
                          type="secondary"
                          ellipsis
                          style={{ maxWidth: 220, display: "block", fontSize: 12, lineHeight: 1.25 }}
                        >
                          {preview}
                        </Text>

                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                          {isSupportOnlyMode ? (
                            <Tag
                              color="cyan"
                              style={{
                                marginInlineEnd: 0,
                                fontSize: 11,
                                lineHeight: "16px",
                                paddingInline: 6,
                                borderRadius: 999,
                              }}
                            >
                              Support
                            </Tag>
                          ) : (
                            <Tag
                              color={item.status === "open" ? "blue" : "default"}
                              style={{
                                marginInlineEnd: 0,
                                fontSize: 11,
                                lineHeight: "16px",
                                paddingInline: 6,
                                borderRadius: 999,
                              }}
                            >
                              {item.status || "open"}
                            </Tag>
                          )}

                          {Number(item.unreadCount || 0) > 0 && (
                            <Badge
                              count={Number(item.unreadCount)}
                              size="small"
                              style={{ backgroundColor: "#2563eb", boxShadow: "0 0 0 2px #fff" }}
                            />
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Delete button */}
                    {canDeleteConversations && !selectionMode && (
                      <Button
                        type="text"
                        danger
                        size="small"
                        icon={<DeleteOutlined />}
                        style={{ borderRadius: 8 }}
                        loading={deletingChatIds.includes(item.id)}
                        onClick={(e) => {
                          e.stopPropagation();
                          onDeleteChat(item.id);
                        }}
                        aria-label="Delete chat"
                      />
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <EmptyState />
          )}
        </div>
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
