import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useSelector } from "react-redux";
import { API_BASE_URL, UPLOAD_BASE_URL } from "../../config/env";

const MAX_SITE_NAME_LENGTH = 24;
const clampSiteName = (value, fallback = "") => {
  const text = String(value || "").trim();
  if (!text) return fallback;
  return text.slice(0, MAX_SITE_NAME_LENGTH);
};

const defaultFooterData = {
  brand: {
    name: "",
    logo: "",
    href: "/",
  },
  columns: [
    {
      title: "Shop",
      links: [
        { label: "All Products", href: "/products" },
        { label: "Flash Sales", href: "/flash-sales" },
        { label: "Special Offers", href: "/offers" },
      ],
    },
    {
      title: "Support",
      links: [
        { label: "Support Chat", href: "/chats" },
        { label: "Guest Support", href: "/support" },
        { label: "My Orders", href: "/orders" },
      ],
    },
    {
      title: "Company",
      links: [
        { label: "Home", href: "/" },
        { label: "Profile", href: "/profile" },
        { label: "Add Balance", href: "/add-balance" },
      ],
    },
  ],
  social: [
    {
      label: "Facebook",
      href: "https://facebook.com",
      icon: (
        <svg
          className="w-5 h-5"
          aria-hidden="true"
          xmlns="http://www.w3.org/2000/svg"
          width="24"
          height="24"
          fill="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            fillRule="evenodd"
            d="M13.135 6H15V3h-1.865a4.147 4.147 0 0 0-4.142 4.142V9H7v3h2v9.938h3V12h2.021l.592-3H12V6.591A.6.6 0 0 1 12.592 6h.543Z"
            clipRule="evenodd"
          />
        </svg>
      ),
    },
    {
      label: "YouTube",
      href: "https://youtube.com",
      icon: (
        <svg
          className="w-5 h-5"
          aria-hidden="true"
          xmlns="http://www.w3.org/2000/svg"
          width="24"
          height="24"
          fill="currentColor"
          viewBox="0 0 24 24"
        >
          <path d="M21.58 7.19a2.94 2.94 0 0 0-2.07-2.07C17.67 4.6 12 4.6 12 4.6s-5.67 0-7.51.52a2.94 2.94 0 0 0-2.07 2.07C1.9 9.03 1.9 12 1.9 12s0 2.97.52 4.81a2.94 2.94 0 0 0 2.07 2.07C6.33 19.4 12 19.4 12 19.4s5.67 0 7.51-.52a2.94 2.94 0 0 0 2.07-2.07c.52-1.84.52-4.81.52-4.81s0-2.97-.52-4.81ZM10.2 14.7V9.3l4.68 2.7-4.68 2.7Z" />
        </svg>
      ),
    },
  ],
  copyright: {
    year: new Date().getFullYear(),
  },
};

const Footer = ({ data = defaultFooterData }) => {
  const { brand, columns, social, copyright } = data;
  const isExternal = (href = "") => /^https?:\/\//i.test(String(href));
  const authState = useSelector((state) => state.auth || {});
  const [logoSrc, setLogoSrc] = useState("");
  const [siteName, setSiteName] = useState("");
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  const [supportContact, setSupportContact] = useState({
    email: "support@shopverse.com",
    whatsapp: "+8801700000000",
  });
  const [socialLinks, setSocialLinks] = useState({
    facebookUrl: "https://facebook.com",
    youtubeUrl: "https://youtube.com",
  });
  const localToken = useMemo(() => {
    try {
      const saved = JSON.parse(localStorage.getItem("userInfo") || "null");
      return saved?.token || "";
    } catch {
      return "";
    }
  }, []);
  const isLoggedIn = Boolean(authState?.token || authState?.user?.id || localToken);

  useEffect(() => {
    let ignore = false;
    const toLogoSrc = (value) => {
      const raw = String(value || "").trim();
      if (!raw) return "";
      if (/^https?:\/\//i.test(raw)) return raw;
      return `${UPLOAD_BASE_URL}/${raw.replace(/^\/+/, "")}`;
    };

    (async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/api/settings`);
        const json = await res.json().catch(() => ({}));
        if (!res.ok || !json?.success || ignore) return;

        const email = String(json?.data?.supportEmail || "").trim();
        const whatsapp = String(json?.data?.supportWhatsapp || "").trim();
        const facebookUrl = String(json?.data?.facebookUrl || "").trim();
        const youtubeUrl = String(json?.data?.youtubeUrl || "").trim();
        const siteLogoUrl = String(json?.data?.siteLogoUrl || "").trim();
        const dynamicSiteName = clampSiteName(json?.data?.siteName, "");

        setLogoSrc(toLogoSrc(siteLogoUrl));
        setSiteName(dynamicSiteName);

        setSupportContact((prev) => ({
          email: email || prev.email,
          whatsapp: whatsapp || prev.whatsapp,
        }));
        setSocialLinks((prev) => ({
          facebookUrl: facebookUrl || prev.facebookUrl,
          youtubeUrl: youtubeUrl || prev.youtubeUrl,
        }));
      } catch {
        // keep fallback support contacts
      } finally {
        if (!ignore) setSettingsLoaded(true);
      }
    })();

    return () => {
      ignore = true;
    };
  }, []);

  const whatsappHref = useMemo(() => {
    const digits = String(supportContact.whatsapp || "").replace(/[^\d]/g, "");
    return digits ? `https://wa.me/${digits}` : "";
  }, [supportContact.whatsapp]);

  const socialItems = useMemo(() => {
    return social.map((item) => {
      if (item.label === "Facebook") return { ...item, href: socialLinks.facebookUrl };
      if (item.label === "YouTube") return { ...item, href: socialLinks.youtubeUrl };
      return item;
    });
  }, [social, socialLinks.facebookUrl, socialLinks.youtubeUrl]);

  const footerColumns = useMemo(() => {
    return (Array.isArray(columns) ? columns : []).map((col) => {
      const links = (Array.isArray(col.links) ? col.links : []).filter((link) => {
        const href = String(link?.href || "").trim();

        if (isLoggedIn) {
          // Logged-in users do not need guest support shortcut.
          if (href === "/support") return false;
          return true;
        }

        // Guest users should not see authenticated-only shortcuts.
        if (href === "/profile") return false;
        if (href === "/add-balance") return false;
        if (href === "/chats") return false;
        if (href === "/orders") return false;
        return true;
      });

      return { ...col, links };
    });
  }, [columns, isLoggedIn]);

  return (
    <footer className="mt-10 border-t border-slate-200 bg-white text-slate-700">
      <div className="mx-auto w-full max-w-screen-xl px-4 py-10 sm:px-6 lg:px-8 lg:py-12">
        <div className="grid grid-cols-1 gap-10 lg:grid-cols-12">
          <div className="lg:col-span-4">
            <Link to={brand.href} className="inline-flex items-center gap-3">
              {settingsLoaded && logoSrc ? (
                <img src={logoSrc} className="h-10 w-10 rounded-lg object-cover border border-slate-200" alt={siteName || "Shop Logo"} />
              ) : null}
              {settingsLoaded && siteName ? (
                <span className="max-w-[220px] truncate text-2xl font-bold tracking-tight text-slate-900">
                  {siteName}
                </span>
              ) : null}
            </Link>

            <p className="mt-4 max-w-sm text-sm leading-6 text-slate-600">
              Trusted marketplace for everyday shopping. Quality products, secure checkout, and reliable support.
            </p>

            <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm">
              <p className="font-semibold text-slate-900">Need help?</p>
              <a href={`mailto:${supportContact.email}`} className="mt-1 block text-slate-700 hover:underline">
                Email: {supportContact.email}
              </a>
              {whatsappHref ? (
                <a href={whatsappHref} target="_blank" rel="noreferrer" className="mt-1 block text-slate-700 hover:underline">
                  WhatsApp: {supportContact.whatsapp}
                </a>
              ) : (
                <span className="mt-1 block text-slate-700">WhatsApp: {supportContact.whatsapp}</span>
              )}
            </div>

            <div className="mt-5 grid grid-cols-1 sm:grid-cols-3 gap-2 max-w-md">
              <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-medium text-slate-700">Fast Delivery</div>
              <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-medium text-slate-700">Secure Payment</div>
              <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-medium text-slate-700">24/7 Support</div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-8 sm:grid-cols-3 lg:col-span-8 lg:justify-items-end">
            {footerColumns.map((col) => (
              <div key={col.title} className="min-w-[120px]">
                <h2 className="mb-4 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">{col.title}</h2>
                <ul className="space-y-2.5 text-sm text-slate-700">
                  {col.links.map((link) => (
                    <li key={link.label}>
                      {isExternal(link.href) ? (
                        <a href={link.href} className="transition-colors hover:text-slate-900 hover:underline" target="_blank" rel="noreferrer">
                          {link.label}
                        </a>
                      ) : (
                        <Link to={link.href} className="transition-colors hover:text-slate-900 hover:underline">
                          {link.label}
                        </Link>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        <hr className="my-7 border-slate-200 lg:my-8" />

        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">

          <div className="flex items-center gap-2">
            {socialItems.map((item) => (
              <a
                key={item.label}
                href={item.href}
                className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900"
                aria-label={item.label}
                target="_blank"
                rel="noreferrer"
              >
                {item.icon}
              </a>
            ))}
          </div>
        </div>

        <div className="mt-6 border-t border-slate-200 pt-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <span className="text-sm text-slate-600">
            &copy; {copyright.year}{" "}
            {settingsLoaded && siteName ? (
              <>
                <Link to={brand.href} className="hover:underline">{siteName}</Link>. All Rights Reserved.
              </>
            ) : (
              <>All Rights Reserved.</>
            )}
          </span>
          <p className="text-xs text-slate-500">Privacy Policy | Terms of Service</p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
