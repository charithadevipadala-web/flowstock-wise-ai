import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "FlowStock AI — Smart Warehouse Control Center" },
      {
        name: "description",
        content:
          "FlowStock AI is a warehouse operations control center: live KPIs, smart inventory allocation, picking, packing, exceptions and decision intelligence.",
      },
      { property: "og:title", content: "FlowStock AI — Smart Warehouse Control Center" },
      {
        property: "og:description",
        content:
          "Live warehouse KPIs, smart allocation engine, exception handling and fulfillment analytics in one control center.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

function Index() {
  return (
    <iframe
      src="/flowstock/index.html"
      title="FlowStock AI Warehouse Control Center"
      style={{ position: "fixed", inset: 0, width: "100%", height: "100%", border: 0 }}
    />
  );
}
