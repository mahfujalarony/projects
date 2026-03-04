import React, { useRef, useState } from "react";
import { Link } from "react-router-dom";
import { animateAddToCart, bumpCartBadge } from "../../utils/cartAnimation";

const ProductCard = ({ product, onAddToCart, onProductClick }) => {
  const [qty, setQty] = useState(1);
  const [justAdded, setJustAdded] = useState(false);
  const [cooldown, setCooldown] = useState(false);
  const buttonRef = useRef(null);

  const handleQtyChange = (e) => {
    const value = parseInt(e.target.value);
    setQty(value > 0 ? value : 1);
  };

  const handleOpenProduct = () => {
    if (typeof onProductClick === "function") onProductClick(product);
  };

  return (
    <div className="bg-white rounded-lg shadow-sm hover:shadow-md transition-all duration-300 flex flex-col border border-gray-100 overflow-hidden group">
      <Link to={`/products/${product.id}`} className="block" onClick={handleOpenProduct}>
        <div className="h-28 md:h-32 w-full bg-gray-50 relative overflow-hidden">
          <img
            src={product.images?.[0] || "https://via.placeholder.com/150"}
            alt={product.name}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          />
        </div>
      </Link>

      <div className="p-2 flex flex-col flex-grow">
        <p className="text-[9px] text-gray-400 uppercase tracking-wider mb-0.5 truncate">
          {product.category || "General"}
        </p>

        <p
          className="text-[10px] text-sky-700 font-medium mb-1 truncate"
          title={product.merchant?.name || (product.merchantId ? `Seller #${product.merchantId}` : "")}
        >
          {product.merchant?.name
            ? `Seller: ${product.merchant.name}`
            : product.merchantId
              ? `Seller #${product.merchantId}`
              : ""}
        </p>

        <Link to={`/products/${product.id}`} className="block" onClick={handleOpenProduct}>
          <h3
            className="text-xs font-medium text-gray-800 line-clamp-2 leading-tight mb-1 h-8 hover:text-blue-600 transition-colors"
            title={product.name}
          >
            {product.name}
          </h3>
        </Link>

        <div className="mt-auto">
          <div className="flex flex-wrap items-baseline justify-between mb-2">
            <p className="text-sm font-bold text-gray-900">
              ${product.price}
            </p>

            <div className="flex items-center">
              <span className="text-[10px] text-yellow-500">★</span>
              <span className="text-[10px] text-gray-500 ml-0.5">
                {product.rating ?? product.averageRating ?? "N/A"}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1">
            <input
              type="number"
              min="1"
              max="10"
              value={qty}
              onChange={handleQtyChange}
              className="w-8 md:w-10 text-center rounded border border-gray-200 text-[10px] h-7 focus:outline-none focus:border-blue-500 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
            />
            <button
              ref={buttonRef}
              onClick={() => {
                if (cooldown) return;
                const ok = typeof onAddToCart === "function" ? onAddToCart(product, qty) : false;
                if (ok !== false) {
                  animateAddToCart({
                    sourceEl: buttonRef.current,
                    imageUrl: product.images?.[0],
                  });
                  bumpCartBadge();
                  setJustAdded(true);
                  window.setTimeout(() => setJustAdded(false), 900);
                  setCooldown(true);
                  window.setTimeout(() => setCooldown(false), 10000);
                }
              }}
              disabled={cooldown}
              className={`flex-grow text-white text-[10px] md:text-xs font-medium h-7 rounded flex items-center justify-center transition-colors active:scale-95 ${
                cooldown ? "bg-blue-400 cursor-not-allowed" : "bg-blue-600 hover:bg-blue-700"
              }`}
            >
              {justAdded ? "ADDED" : "ADD"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProductCard;
