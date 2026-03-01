import React from "react";
import { Alert } from "antd";
import { useOutletContext } from "react-router-dom";

export default function SubAdminModuleGuard({ perm, children }) {
  const ctx = useOutletContext() || {};
  const permLoading = Boolean(ctx.permLoading);
  const permissions = Array.isArray(ctx.permissions) ? ctx.permissions : [];

  if (permLoading) {
    return null;
  }

  if (!permissions.includes(perm)) {
    return (
      <Alert
        type="warning"
        showIcon
        message="Module access denied"
        description="You do not have permission to access this module."
      />
    );
  }

  return children;
}
