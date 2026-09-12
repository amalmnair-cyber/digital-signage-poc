import { SignageDisplay } from "@/components/signage/SignageDisplay";

export default async function DisplayPage({
  params,
}: PageProps<"/display/[store]/[screen]">) {
  const { store, screen } = await params;

  // Checked server-side so the dev-only UI is dead-code-eliminated out of
  // the production client bundle entirely, not just hidden at runtime.
  const showDebug = process.env.NEXT_PUBLIC_SHOW_DEBUG === "true";

  return <SignageDisplay storeId={store} screenId={screen} showDebug={showDebug} />;
}
