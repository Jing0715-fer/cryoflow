// Public surface is byte-identical to @radix-ui/react-toast@1.2.15 —
// the fork (see radix-toast-vendor.mjs header) only unwraps the
// DismissableLayer registration inside ToastImpl. Borrow the package's
// own declarations so every consumer (ui/toast.tsx) keeps exact types.
export * from "@radix-ui/react-toast";
