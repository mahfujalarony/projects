import React from "react";
import { Link, useLocation } from "react-router-dom";
import { SearchX } from "lucide-react";

export default function NotFound() {
  const location = useLocation();

  return (
    <section className="min-h-[70vh] px-4 py-8 sm:py-12">
      <div className="mx-auto w-full max-w-3xl rounded-3xl border border-orange-100 bg-gradient-to-br from-orange-50 via-amber-50 to-rose-50 p-6 text-center shadow-sm sm:p-10">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-white text-orange-500 shadow-sm sm:h-16 sm:w-16">
          <SearchX className="h-7 w-7 sm:h-8 sm:w-8" />
        </div>

        <p className="text-sm font-semibold uppercase tracking-wider text-orange-500">Page Not Found</p>
        <h1 className="mt-2 text-5xl font-extrabold leading-none text-slate-900 sm:text-6xl">404</h1>
        <p className="mx-auto mt-3 max-w-xl text-sm text-slate-600 sm:text-base">
          The page you are looking for does not exist or may have been moved.
        </p>

        {location.pathname !== "/404" ? (
          <p className="mt-2 text-xs text-slate-500 sm:text-sm">Path: {location.pathname}</p>
        ) : null}

        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <Link
            to="/"
            className="rounded-xl bg-orange-500 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-orange-600"
          >
            Go Home
          </Link>
          <button
            type="button"
            onClick={() => window.history.back()}
            className="rounded-xl border border-slate-300 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            Go Back
          </button>
        </div>
      </div>
    </section>
  );
}
