import React, { useState } from "react";
import { 
  PanelLeftClose, 
  PanelLeftOpen, 
  PlusCircle, 
  LayoutDashboard, 
  Users, 
  UserPlus, 
  ShoppingBag, 
  CarTaxiFront,
  BotOffIcon,
  User2,
  Settings,
  MessageSquare,
  Search,
  Wallet,
  DollarSign,
  History as HistoryIcon
} from "lucide-react";
import { Button, Layout, Menu, theme, Drawer, Badge, Input, Grid } from "antd";
import { useNavigate, useLocation, Outlet } from "react-router-dom";
import { useSelector } from "react-redux";

const { Header, Sider, Content } = Layout;
const { useBreakpoint } = Grid;

const DashboardLayout = () => {
  const [collapsed, setCollapsed] = useState(false);
  const [drawerVisible, setDrawerVisible] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const screens = useBreakpoint();
  const totalUnreadCount = useSelector((state) => state.chat?.totalUnreadCount || 0);

  const {
    token: { colorBgContainer, borderRadiusLG },
  } = theme.useToken();

  // Responsive check (reactive)
  const isMobile = !screens.lg;

  const menuItems = [
    {
      key: "/admin",
      icon: <LayoutDashboard size={18} />,
      label: "Dashboard",
    },
    {
      key: "/admin/products",
      icon: <ShoppingBag size={18} />,
      label: "Products",
    },
    {
      key: "/admin/create-item",
      icon: <PlusCircle size={18} />,
      label: "Create Product",
    },
    {
      key: "/admin/users",
      icon: <Users size={18} />,
      label: "Users",
    },
    {
      key: "/admin/category-management",
      icon: <CarTaxiFront size={18} />,
      label: "Category Management",
    },
    {
      key: "/admin/offers",
      icon: <BotOffIcon size={18} />,
      label: "Offers",
    },
    {
      key: "/admin/orders",
      icon: <LayoutDashboard size={18} />,
      label: "Orders",
    },
    {
      key: "/admin/subadmins",
      icon: <User2 size={18} />,
      label: "Sub Admin Permissions",
    },
    {
      key: "/admin/merchant-join-requests",
      icon: <UserPlus size={18} />,
      label: "Merchant Join Requests",
    },
    {
      key: "/admin/wallets",
      icon: <Wallet size={18} />,
      label: "Wallet",
    },
    {
      key: "/admin/balance-topup",
      icon: <DollarSign size={18} />,
      label: "Balance Topup",
    },
    {
      key: "/admin/settings",
      icon: <Settings size={18} />,
      label: "Settings",
    },
    {
      key: "/admin/history",
      icon: <HistoryIcon size={18} />,
      label: "History",
    }
  ];

  const MenuContent = () => (
    <Menu
      theme="light"
      mode="inline"
      selectedKeys={[location.pathname]}
      onClick={({ key }) => {
        navigate(key);
        if (isMobile) setDrawerVisible(false);
      }}
      items={menuItems}
      style={{ borderRight: 0, height: "100%", background: "transparent" }}
    />
  );

  return (
    <Layout style={{ minHeight: "100vh" }}>
      {/* Desktop Sidebar */}
      {!isMobile && (
        <Sider
          theme="light"
          trigger={null}
          collapsible
          collapsed={collapsed}
          width={200}
          collapsedWidth={80}
          style={{
            overflow: "auto",
            height: "100vh",
            position: "fixed",
            left: 0,
            top: 0,
            bottom: 0,
            zIndex: 1000,
            background: colorBgContainer,
            boxShadow: "2px 0 8px rgba(0,21,41,0.08)",
          }}
        >
          <div
            style={{
              height: "64px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: collapsed ? "16px" : "20px",
              fontWeight: "bold",
              color: "#001529",
              borderBottom: "1px solid #f0f0f0",
            }}
          >
            {collapsed ? "MS" : "My Shop Admin"}
          </div>
          <MenuContent />
        </Sider>
      )}

      {/* Mobile Drawer */}
      {isMobile && (
        <Drawer
          title="My Shop Admin"
          placement="left"
          onClose={() => setDrawerVisible(false)}
          open={drawerVisible}
          width={280}
          styles={{ body: { padding: 0 } }}
        >
          <MenuContent />
        </Drawer>
      )}

      {/* Main Layout */}
      <Layout
        style={{
          marginLeft: !isMobile ? (collapsed ? 80 : 200) : 0,
          transition: "margin-left 0.2s",
        }}
      >
        <Header
          style={{
            padding: isMobile ? "0 12px" : "0 24px",
            background: colorBgContainer,
            position: "fixed",
            top: 0,
            left: !isMobile ? (collapsed ? 80 : 200) : 0,
            right: 0,
            zIndex: 999,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            boxShadow: "0 1px 2px 0 rgba(0, 0, 0, 0.03), 0 1px 6px -1px rgba(0, 0, 0, 0.02), 0 2px 4px 0 rgba(0, 0, 0, 0.02)",
            height: 64,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            {isMobile ? (
              <Button
                type="text"
                icon={<PanelLeftOpen size={20} />}
                onClick={() => setDrawerVisible(true)}
                style={{ display: "flex", alignItems: "center", justifyContent: "center" }}
              />
            ) : (
              <Button
                type="text"
                icon={collapsed ? <PanelLeftOpen size={20} /> : <PanelLeftClose size={20} />}
                onClick={() => setCollapsed(!collapsed)}
                style={{ display: "flex", alignItems: "center", justifyContent: "center" }}
              />
            )}

            <div style={{ fontSize: isMobile ? 16 : 18, fontWeight: "bold" }}>Admin Dashboard</div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: isMobile ? 8 : 20 }}>
             <div className="hidden xl:block">
                <Input 
                    prefix={<Search size={16} className="text-gray-400" />} 
                    placeholder="Search..." 
                    style={{ 
                        borderRadius: 8, 
                        width: 240, 
                        border: '1px solid #f0f0f0', 
                        background: '#f9fafb',
                        padding: '6px 12px'
                    }}
                    variant="borderless"
                />
             </div>

             <Badge count={Number(totalUnreadCount || 0)} size="small" offset={[-2, 2]}>
                <Button
                    type="text"
                    icon={<MessageSquare size={20} className="text-gray-600" />}
                    onClick={() => navigate("/chats")}
                    style={{ borderRadius: '50%', width: 40, height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                />
             </Badge>
          </div>
        </Header>

        {/* Content Area */}
        <Content
          style={{
            marginTop: 64, // Header height
            padding: "24px 16px",
            minHeight: "calc(100vh - 64px)",
            background: "#f0f2f5",
          }}
        >
          <div
            style={{
              padding: 24,
              background: colorBgContainer,
              borderRadius: borderRadiusLG,
              minHeight: "100%",
            }}
          >
            <Outlet />
          </div>
        </Content>
      </Layout>
    </Layout>
  );
};

export default DashboardLayout;
