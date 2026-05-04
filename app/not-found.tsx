import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center gap-4 p-8 text-center">
      <p className="text-6xl font-bold text-neutral-700">404</p>
      <h1 className="text-xl font-semibold text-neutral-100">Page not found</h1>
      <p className="text-sm text-neutral-400">
        The page you are looking for does not exist or has been moved.
      </p>
      <Link
        href="/"
        className="mt-2 min-h-[44px] inline-flex items-center rounded-lg bg-accent px-5 py-2.5 text-sm font-semibold text-accent-foreground"
      >
        Go home
      </Link>
    </div>
  );
}
