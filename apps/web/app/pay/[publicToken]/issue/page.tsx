import Link from "next/link";
import { redirect } from "next/navigation";
import { getPublicInvoiceStatus } from "../../../../lib/api";

export default async function PaymentIssuePage({
  params
}: {
  params: Promise<{ publicToken: string }>;
}) {
  const { publicToken } = await params;
  const status = await getPublicInvoiceStatus(publicToken).catch(() => null);

  if (status?.redirectHint === "success") {
    redirect(`/pay/${publicToken}/success`);
  }

  if (status?.redirectHint === "processing") {
    redirect(`/pay/${publicToken}/processing`);
  }

  return (
    <main className="public-shell">
      <section className="public-card">
        <p className="brand-mark">Payment issue</p>
        <h1 className="page-title">We could not complete this hosted payment flow.</h1>
        <p className="page-copy">
          This usually means the public invoice token was invalid or the processing state failed.
        </p>
        <div className="actions" style={{ marginTop: "20px" }}>
          <Link className="button" href={`/pay/${publicToken}`}>
            Try again
          </Link>
        </div>
      </section>
    </main>
  );
}
