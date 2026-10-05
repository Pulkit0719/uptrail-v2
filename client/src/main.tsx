import { trpc } from "@/lib/trpc";
import { CSRF_COOKIE_NAME, UNAUTHED_ERR_MSG } from "@shared/const";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { httpBatchLink, TRPCClientError } from "@trpc/client";
import { createRoot } from "react-dom/client";
import superjson from "superjson";
import App from "./App";
import { startLogin } from "./const";
import "./index.css";

const queryClient = new QueryClient();

const readCookie = (name: string) => {
  const prefix = `${encodeURIComponent(name)}=`;
  const value = document.cookie.split(";").map(item => item.trim()).find(item => item.startsWith(prefix));
  return value ? decodeURIComponent(value.slice(prefix.length)) : undefined;
};

const redirectToLoginIfUnauthorized = (error: unknown) => {
  if (!(error instanceof TRPCClientError) || typeof window === "undefined") return;
  if (error.message === UNAUTHED_ERR_MSG && window.location.pathname !== "/login") startLogin();
};

queryClient.getQueryCache().subscribe(event => {
  if (event.type === "updated" && event.action.type === "error") {
    redirectToLoginIfUnauthorized(event.query.state.error);
    console.error("[API Query Error]", event.query.state.error);
  }
});

queryClient.getMutationCache().subscribe(event => {
  if (event.type === "updated" && event.action.type === "error") {
    redirectToLoginIfUnauthorized(event.mutation.state.error);
    console.error("[API Mutation Error]", event.mutation.state.error);
  }
});

const trpcClient = trpc.createClient({
  links: [httpBatchLink({
    url: "/api/trpc",
    transformer: superjson,
    headers() {
      const token = readCookie(CSRF_COOKIE_NAME);
      return token ? { "x-csrf-token": token } : {};
    },
    fetch(input, init) {
      return globalThis.fetch(input, { ...(init ?? {}), credentials: "include" });
    },
  })],
});

async function bootstrap() {
  if (!readCookie(CSRF_COOKIE_NAME)) {
    await fetch("/api/auth/csrf", { credentials: "include", cache: "no-store" });
  }
  createRoot(document.getElementById("root")!).render(
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}><App /></QueryClientProvider>
    </trpc.Provider>
  );
}

void bootstrap();
