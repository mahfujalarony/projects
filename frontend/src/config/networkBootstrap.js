import axios from "axios";
import { rewriteKnownApiUrl } from "./env";

let isBootstrapped = false;

export const bootstrapNetworkLayer = () => {
  if (isBootstrapped) return;
  isBootstrapped = true;

  if (typeof window !== "undefined" && typeof window.fetch === "function") {
    const nativeFetch = window.fetch.bind(window);
    window.fetch = (input, init) => {
      if (typeof input === "string") {
        return nativeFetch(rewriteKnownApiUrl(input), init);
      }

      if (input instanceof Request) {
        const nextUrl = rewriteKnownApiUrl(input.url);
        if (nextUrl !== input.url) {
          return nativeFetch(new Request(nextUrl, input), init);
        }
      }

      return nativeFetch(input, init);
    };
  }

  axios.interceptors.request.use((config) => {
    if (typeof config.url === "string") {
      config.url = rewriteKnownApiUrl(config.url);
    }
    if (typeof config.baseURL === "string") {
      config.baseURL = rewriteKnownApiUrl(config.baseURL);
    }
    return config;
  });
};

