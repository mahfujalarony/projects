import { useSelector } from "react-redux";
import { Navigate } from "react-router-dom";

const ProtectedRoute = ({ children }) => {
    const userInfo = localStorage.getItem("userInfo");

  if (!userInfo || userInfo === "null") {
    return <Navigate to="/" replace />;
  }

  return children;
};

export default ProtectedRoute;
