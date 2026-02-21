import React from "react";
import { Link } from "react-router-dom";

export default function Forbidden() {
  return (
    <div className="min-h-[60vh] flex items-center justify-center px-4">
      <div className="max-w-md w-full rounded-2xl border bg-white p-6 text-center shadow-sm">
        <div className="text-5xl font-extrabold">403</div>
        <p className="mt-2 text-gray-600">You don’t have permission to access this page.</p>
        <div className="mt-5 flex gap-3 justify-center">
          <Link className="px-4 py-2 rounded-lg border hover:bg-gray-50" to="/">
            Go Home
          </Link>
          <button
            className="px-4 py-2 rounded-lg bg-black text-white hover:opacity-90"
            onClick={() => window.history.back()}
          >
            Go Back
          </button>
        </div>
      </div>
    </div>
  );
}
