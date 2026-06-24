"use client";

import React, { useState } from "react";
import { FiCopy, FiMail, FiCheck, FiChevronDown, FiChevronUp } from "react-icons/fi";

export default function OrderEmailGenerator({ order, matchedMusicInfo }) {
  const [isOpen, setIsOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const hasMusic = matchedMusicInfo && matchedMusicInfo.length > 0;
  
  const generateEmailBody = () => {
    const customerName = order.customer ? `${order.customer.first_name || ''} ${order.customer.last_name || ''}`.trim() : "Customer";
    
    let trackLinksText = "";
    if (hasMusic) {
      trackLinksText = matchedMusicInfo.map(info => {
        if (!info.track) return "";
        return `Song Title: ${info.track.title || 'Your Song'}\nDownload Link: ${info.track.audioUrl || info.track.streamAudioUrl || 'No download link available'}`;
      }).filter(Boolean).join("\n\n");
    }

    return `Hi ${customerName},

Thank you for your order (#${order.order_number})!

Your personalized song is ready. You can download and listen to it using the link(s) below:

${trackLinksText}

We hope you enjoy your custom song! Please let us know if you have any questions.

Best regards,
Own Personal Song`;
  };

  const emailBody = generateEmailBody();
  const emailSubject = `Your custom song is ready! (Order #${order.order_number})`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(emailBody);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy text: ", err);
    }
  };

  const handleSendEmail = () => {
    const customerEmail = order.email || order.contact_email || order.customer?.email;
    if (!customerEmail) {
      alert("No customer email found for this order.");
      return;
    }
    const mailtoLink = `mailto:${customerEmail}?subject=${encodeURIComponent(emailSubject)}&body=${encodeURIComponent(emailBody)}`;
    window.location.href = mailtoLink;
  };

  return (
    <div className="mt-6 rounded-2xl border border-brand-200 bg-brand-50 p-6 dark:border-brand-500/20 dark:bg-brand-500/5">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-brand-700 dark:text-brand-400">Generate Delivery Email</h3>
          <p className="text-sm text-gray-600 dark:text-gray-400">Create an email template to send the song to the customer.</p>
        </div>
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center gap-2 rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-600 transition"
        >
          {isOpen ? "Close Template" : "Generate Email"}
          {isOpen ? <FiChevronUp size={16} /> : <FiChevronDown size={16} />}
        </button>
      </div>

      {isOpen && (
        <div className="mt-6 border-t border-brand-200 pt-6 dark:border-brand-500/20">
          <div className="mb-4">
            <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">Email Subject</label>
            <input 
              type="text" 
              readOnly 
              value={emailSubject} 
              className="w-full rounded-lg border border-gray-300 bg-gray-50 p-3 text-sm text-gray-800 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
            />
          </div>
          <div className="mb-4">
            <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">Email Body</label>
            <textarea
              readOnly
              value={emailBody}
              rows={12}
              className="w-full rounded-lg border border-gray-300 bg-gray-50 p-3 text-sm text-gray-800 dark:border-gray-700 dark:bg-gray-800 dark:text-white font-mono"
            />
          </div>
          
          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={handleCopy}
              className="flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700 transition"
            >
              {copied ? <FiCheck size={16} className="text-green-500" /> : <FiCopy size={16} />}
              {copied ? "Copied!" : "Copy Template"}
            </button>
            <button
              onClick={handleSendEmail}
              className="flex items-center gap-2 rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition"
            >
              <FiMail size={16} />
              Open in Mail App
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
