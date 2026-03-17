import React, { useEffect, useState } from "react";
import axios from "axios";
import { API_BASE_URL } from "../../../config/env";
import { normalizeImageUrl } from "../../../utils/imageUrl";

const API_BASE = `${API_BASE_URL}/api`;

const Product = () => {
  const [products, setProducts] = useState([]);
  const [addingId, setAddingId] = useState(null);
  const [message, setMessage] = useState({ type: "", text: "" });
  const [loading, setLoading] = useState(true);
  
  //example 

  const merchantId = null; 


  useEffect(() => {
    let isMounted = true;
    const fetchProducts = async () => {
      try {
        const res = await axios.get(
          `${API_BASE}/products/exsistproduct`
        );
        if (!isMounted) return;
        setProducts(res.data || []);
        setLoading(false);
      } catch (error) {

        if (isMounted) {
          setMessage({ type: "error", text: "Failed to load products." });
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchProducts();
    return () => {
      isMounted = false;
    };
  }, [merchantId]);


    if(loading){
    return <div>Loading...</div>;
  }

  const handleAdd = async (productId) => {
    setAddingId(productId);
    setMessage({ type: "", text: "" });

    try {
      await axios.post(
        `${API_BASE}/products/add-product/${merchantId}`,
        { productId }
      );

      setProducts((prev) => prev.filter((p) => p.id !== productId));
      setMessage({
        type: "success",
        text: "Product successfully added to your store.",
      });
    } catch (error) {

      setMessage({
        type: "error",
        text: "This product is already assigned or something went wrong.",
      });
    } finally {
      setAddingId(null);
    }
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-6 text-slate-900 shadow-sm">
      <div className="mb-4">
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
          Inventory
        </p>
        <h3 className="text-2xl font-semibold text-slate-900">Available Products</h3>
        <p className="mt-1 text-sm text-slate-600">
          Pick from products not yet assigned to any merchant.
        </p>
      </div>

      {message.text && (
        <div
          className={`mb-4 rounded-xl border px-4 py-3 text-sm font-semibold ${
            message.type === "success"
              ? "border-emerald-200 bg-emerald-50 text-emerald-700"
              : "border-rose-200 bg-rose-50 text-rose-700"
          }`}
        >
          {message.text}
        </div>
      )}

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[...Array(6)].map((_, idx) => (
            <div
              key={idx}
              className="h-48 animate-pulse rounded-xl bg-slate-200"
            />
          ))}
        </div>
      ) : products.length === 0 ? (
        <div className="flex flex-col items-start gap-1 rounded-xl border border-dashed border-slate-200 bg-white px-4 py-6 text-slate-600">
          <p className="font-semibold text-slate-800">No products available.</p>
          <p className="text-sm">Create new products or check back later.</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {products.map((product) => (
            <div
              key={product.id}
              className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow"
            >
              <div className="flex items-center justify-center overflow-hidden rounded-lg bg-slate-100">
                {product.images?.[0] ? (
                  <img
                    src={normalizeImageUrl(product.images[0])}
                    alt={product.name}
                    className="h-32 w-full object-cover"
                  />
                ) : (
                  <div className="flex h-32 w-full items-center justify-center text-sm text-slate-500">
                    No Image
                  </div>
                )}
              </div>

              <div className="flex flex-col gap-1">
                <div className="flex items-start justify-between gap-2">
                  <strong className="text-base text-slate-900">
                    {product.name}
                  </strong>
                  {product.sku && (
                    <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-medium text-slate-600">
                      SKU: {product.sku}
                    </span>
                  )}
                </div>
                {product.price && (
                  <div className="text-sm font-semibold text-emerald-700">
                    $ {product.price}
                  </div>
                )}
              </div>

              <button
                className={`mt-auto inline-flex items-center justify-center rounded-lg px-3 py-2 text-sm font-semibold text-white transition focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:ring-offset-2 ${
                  addingId === product.id
                    ? "bg-emerald-400"
                    : "bg-emerald-600 hover:bg-emerald-700"
                } disabled:cursor-not-allowed disabled:opacity-70`}
                disabled={addingId === product.id}
                onClick={() => handleAdd(product.id)}
              >
                {addingId === product.id ? "Adding..." : "Add to Store"}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default Product;
