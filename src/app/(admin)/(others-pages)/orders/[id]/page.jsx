import React from "react";
import PageBreadcrumb from "@/components/common/PageBreadCrumb";
import { getSettings } from "@/lib/getSettings";
import Badge from "@/components/ui/badge/Badge";
import { notFound } from "next/navigation";
import Link from "next/link";
import EditOrderModal from "@/components/ecommerce/EditOrderModal";
import dbConnect from "@/lib/mongoose";
import Order from "@/models/Order";
import DeliverMusicButton from "@/components/ecommerce/DeliverMusicButton";
import FulfillmentManager from "@/components/ecommerce/FulfillmentManager";
import { FiMusic, FiDownload } from "react-icons/fi";

export const metadata = {
  title: "Shopify Order Details | Dashboard",
  description: "Detailed view of a Shopify order",
};

export const dynamic = "force-dynamic";

export default async function ShopifyOrderDetailsPage({ params }) {
  const { id } = await params;
  const settings = await getSettings();
  let orderInfo = null;
  let errorMsg = null;
  let matchedMusicInfo = []; // Array to store matched music for each line item

  if (!settings.shopUrl1 || !settings.shopifyAdminApiKey) {
    errorMsg = "Shopify integration is not configured.";
  } else {
    try {
      let url = settings.shopUrl1;
      if (!url.startsWith('http')) url = `https://${url}`;

      const response = await fetch(`${url}/admin/api/2024-04/orders/${id}.json`, {
        headers: {
          "X-Shopify-Access-Token": settings.shopifyAdminApiKey,
          "Content-Type": "application/json"
        },
        cache: "no-store"
      });

      const data = await response.json();
      if (response.ok && data.order) {
        orderInfo = data.order;

        // Fetch corresponding music from MongoDB
        await dbConnect();

        for (const item of orderInfo.line_items) {
          if (item.properties && item.properties.length > 0) {
            const musicIdProp = item.properties.find(p => p.name.toLowerCase() === "music id");
            if (musicIdProp && musicIdProp.value) {
              const musicOrder = await Order.findOne({ musicId: musicIdProp.value }).lean();
              if (musicOrder) {
                // Find the selected demo track
                let selectedTrack = null;
                if (musicOrder.selectedDemo && musicOrder.musicTracks) {
                  selectedTrack = musicOrder.musicTracks.find(t => t.id === musicOrder.selectedDemo);
                }

                // If no selected track but there are tracks, pick the first one as fallback
                if (!selectedTrack && musicOrder.musicTracks && musicOrder.musicTracks.length > 0) {
                  selectedTrack = musicOrder.musicTracks[0];
                }

                matchedMusicInfo.push({
                  lineItemId: item.id,
                  musicId: musicIdProp.value,
                  orderId: musicOrder._id.toString(),
                  track: selectedTrack ? JSON.parse(JSON.stringify(selectedTrack)) : null,
                  mongoEmail: musicOrder.email
                });
              }
            }
          }
        }



      } else {
        errorMsg = data.errors ? JSON.stringify(data.errors) : "Failed to fetch order from Shopify.";
      }
    } catch (err) {
      console.error(err);
      errorMsg = "An error occurred while fetching the order.";
    }
  }

  if (errorMsg) {
    return (
      <div>
        <PageBreadcrumb pageTitle="Order Details" />
        <div className="p-4 rounded bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-400">
          {errorMsg}
        </div>
        <Link href="/orders" className="mt-4 inline-block text-brand-500 underline">Back to Orders</Link>
      </div>
    );
  }

  if (!orderInfo) return notFound();

  // Helper to format addresses
  const formatAddress = (address) => {
    if (!address) return "No address provided";
    return (
      <div className="text-sm text-gray-700 dark:text-gray-300">
        <p className="font-medium text-gray-800 dark:text-white/90">{address.name || `${address.first_name || ''} ${address.last_name || ''}`.trim()}</p>
        <p>{address.company}</p>
        <p>{address.address1}</p>
        <p>{address.address2}</p>
        <p>{`${address.city ? address.city + ',' : ''} ${address.province || ''} ${address.zip || ''}`}</p>
        <p>{address.country}</p>
        <p>{address.phone}</p>
      </div>
    );
  };

  // Determine best email (Shopify API might redact email due to protected customer data scopes)
  let bestEmail = orderInfo.email || orderInfo.contact_email || orderInfo.customer?.email;
  if (!bestEmail && matchedMusicInfo.length > 0) {
    const fallback = matchedMusicInfo.find(m => m.mongoEmail);
    if (fallback) bestEmail = fallback.mongoEmail;
  }

  return (
    <div>
      <PageBreadcrumb pageTitle={`Order #${orderInfo.order_number}`} />

      <div className="flex flex-col md:flex-row justify-between md:items-center gap-4 mb-6">
        <Link href="/orders" className="text-gray-500 hover:text-gray-800 dark:hover:text-white transition">
          ← Back to Orders
        </Link>
        <EditOrderModal order={orderInfo} />
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        {/* Left: Main Info */}
        <div className="xl:col-span-2 space-y-6">
          {/* Fulfillment Manager */}
          <FulfillmentManager orderId={orderInfo.id} currentStatus={orderInfo.fulfillment_status} />

          {/* Order Items */}
          <div className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-white/[0.03]">
            <h3 className="mb-5 text-lg font-semibold text-gray-800 dark:text-white/90">Order Items</h3>
            <div className="space-y-6">
              {orderInfo.line_items.map(item => {
                const matchedMusic = matchedMusicInfo.find(m => m.lineItemId === item.id);

                return (
                  <div key={item.id} className="border-b border-gray-100 dark:border-gray-800 pb-6 last:border-0 last:pb-0">
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <p className="font-medium text-gray-800 dark:text-white/90">{item.title}</p>
                        <p className="text-sm text-gray-500">{item.variant_title || "Default"}</p>
                        {item.properties && item.properties.length > 0 && (
                          <div className="mt-2 space-y-1 text-xs text-gray-500">
                            {item.properties.map((p, idx) => (
                              <div key={idx} className="flex">
                                <span className="font-medium mr-1 text-gray-700 dark:text-gray-400">{p.name}:</span>
                                <span>{p.value}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                      <div className="text-right">
                        <p className="font-medium text-gray-800 dark:text-white/90">{item.price} {orderInfo.currency}</p>
                        <p className="text-sm text-gray-500">Qty: {item.quantity}</p>
                      </div>
                    </div>

                    {/* Show matched music track if available */}
                    {matchedMusic && matchedMusic.track && (
                      <div className="mt-4 rounded-xl bg-gray-50 p-4 border border-gray-100 dark:bg-white/[0.02] dark:border-white/[0.05]">
                        <div className="flex items-center gap-3 mb-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-100 text-brand-600 dark:bg-brand-500/20 dark:text-brand-400">
                            <FiMusic size={20} />
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-gray-800 dark:text-white/90">Selected Music: {matchedMusic.track.title || "Unknown Title"}</p>
                            <p className="text-xs text-gray-500">Music ID: {matchedMusic.musicId}</p>
                          </div>
                        </div>

                        {(matchedMusic.track.audioUrl || matchedMusic.track.streamAudioUrl) && (
                          <div className="mt-3 flex items-center gap-4">
                            <audio
                              controls
                              controlsList="nodownload noremoteplayback nosaveplayback noplaybackrate nofullscreen"
                              src={matchedMusic.track.audioUrl || matchedMusic.track.streamAudioUrl}
                              className="h-10 w-full max-w-[300px]"
                            />
                            {(matchedMusic.track.audioUrl || matchedMusic.track.streamAudioUrl) && (
                              <a
                                href={matchedMusic.track.audioUrl || matchedMusic.track.streamAudioUrl}
                                target="_blank"
                                rel="noreferrer"
                                download
                                className="flex items-center gap-1.5 text-sm font-medium text-brand-500 hover:text-brand-600 dark:hover:text-brand-400"
                              >
                                <FiDownload size={16} />
                                Download
                              </a>
                            )}
                          </div>
                        )}
                      </div>
                    )}

                    {/* If music ID exists but no track found */}
                    {matchedMusic && !matchedMusic.track && (
                      <div className="mt-4 rounded-xl bg-yellow-50 p-3 text-sm text-yellow-700 dark:bg-yellow-500/10 dark:text-yellow-500">
                        Music ID ({matchedMusic.musicId}) found, but no selected track was located in the database.
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Deliver Music Section */}
            <DeliverMusicButton order={{ ...orderInfo, email: bestEmail }} />

          </div>

          {(orderInfo.note || orderInfo.tags) && (
            <div className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-white/[0.03]">
              <h3 className="mb-4 text-lg font-semibold text-gray-800 dark:text-white/90">Additional Info</h3>
              {orderInfo.tags && (
                <div className="mb-4">
                  <span className="text-xs text-gray-400 uppercase tracking-wider block mb-2">Tags</span>
                  <div className="flex flex-wrap gap-2">
                    {orderInfo.tags.split(',').map(tag => (
                      <Badge key={tag} size="sm" color="info">{tag.trim()}</Badge>
                    ))}
                  </div>
                </div>
              )}
              {orderInfo.note && (
                <div>
                  <span className="text-xs text-gray-400 uppercase tracking-wider block mb-2">Order Note (Notes from customer)</span>
                  <p className="text-sm text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-800 p-3 rounded-lg">
                    {orderInfo.note}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right: Meta Info & Customer Info */}
        <div className="space-y-6">
          <div className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-white/[0.03]">
            <h3 className="mb-5 text-lg font-semibold text-gray-800 dark:text-white/90">Customer</h3>

            <div className="space-y-5">
              <div>
                <p className="font-medium text-brand-500 hover:text-brand-600">
                  {orderInfo.customer ? `${orderInfo.customer.first_name || ''} ${orderInfo.customer.last_name || ''}`.trim() : "No Customer"}
                </p>
                {orderInfo.customer && orderInfo.customer.orders_count !== undefined && (
                  <p className="text-sm text-gray-500 mt-1">{orderInfo.customer.orders_count} order(s)</p>
                )}
              </div>

              <div className="pt-4 border-t border-gray-100 dark:border-gray-800">
                <h4 className="text-sm font-medium text-gray-800 dark:text-white/90 mb-2">Contact Information</h4>
                <p className="text-sm text-brand-500 hover:text-brand-600 break-all">{bestEmail || "No email provided"}</p>
                {(orderInfo.phone || orderInfo.customer?.phone) && <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{orderInfo.phone || orderInfo.customer?.phone}</p>}
              </div>

              <div className="pt-4 border-t border-gray-100 dark:border-gray-800">
                <h4 className="text-sm font-medium text-gray-800 dark:text-white/90 mb-2">Shipping Address</h4>
                {formatAddress(orderInfo.shipping_address)}
              </div>

              <div className="pt-4 border-t border-gray-100 dark:border-gray-800">
                <h4 className="text-sm font-medium text-gray-800 dark:text-white/90 mb-2">Billing Address</h4>
                {formatAddress(orderInfo.billing_address)}
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-white/[0.03]">
            <h3 className="mb-5 text-lg font-semibold text-gray-800 dark:text-white/90">Summary</h3>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500 dark:text-gray-400">Date</span>
                <span className="font-medium text-gray-800 dark:text-white/90">
                  {new Date(orderInfo.created_at).toLocaleDateString()}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-500 dark:text-gray-400">Financial</span>
                <Badge size="sm" color={orderInfo.financial_status === 'paid' ? 'success' : 'warning'}>
                  {orderInfo.financial_status}
                </Badge>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-500 dark:text-gray-400">Fulfillment</span>
                <Badge size="sm" color={orderInfo.fulfillment_status === 'fulfilled' ? 'success' : 'warning'}>
                  {orderInfo.fulfillment_status || 'unfulfilled'}
                </Badge>
              </div>
              <div className="pt-3 mt-3 border-t border-gray-100 dark:border-gray-800 flex justify-between font-semibold">
                <span className="text-gray-800 dark:text-white/90">Total</span>
                <span className="text-gray-800 dark:text-white/90">{orderInfo.total_price} {orderInfo.currency}</span>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
