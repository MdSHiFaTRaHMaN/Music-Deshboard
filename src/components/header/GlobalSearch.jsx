"use client";
import React, { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Badge from "@/components/ui/badge/Badge";
import { LuLayoutGrid, LuSettings } from "react-icons/lu";
import { RiMusicAiLine } from "react-icons/ri";
import { BsCartPlus } from "react-icons/bs";
import { BiPurchaseTag } from "react-icons/bi";
import { MdFormatListBulletedAdd } from "react-icons/md";
import { FiUsers, FiUserPlus } from "react-icons/fi";
import { FaRegCircleUser } from "react-icons/fa6";
import { HiSparkles } from "react-icons/hi2";

// Quick navigation links shown by default (empty search) in the dropdown.
const QUICK_LINKS = [
  { label: "Shopify Orders", path: "/orders", icon: <BiPurchaseTag /> },
  { label: "All Musics", path: "/all-musics", icon: <RiMusicAiLine /> },
  { label: "Ordered Musics", path: "/ordered-musics", icon: <BsCartPlus /> },
  { label: "Dashboard", path: "/", icon: <LuLayoutGrid /> },
];

// All navigable routes in the app. Used only for search matching so users can
// reach any route by typing its name or a related keyword.
const ALL_ROUTES = [
  {
    label: "Dashboard",
    path: "/",
    icon: <LuLayoutGrid />,
    keywords: ["home", "overview", "main", "dashboard"],
  },
  {
    label: "Shopify Orders",
    path: "/orders",
    icon: <BiPurchaseTag />,
    keywords: ["orders", "shopify", "purchase", "sales"],
  },
  {
    label: "Ordered Musics",
    path: "/ordered-musics",
    icon: <BsCartPlus />,
    keywords: ["ordered", "customer", "choice", "music", "songs", "cart"],
  },
  {
    label: "All Musics",
    path: "/all-musics",
    icon: <RiMusicAiLine />,
    keywords: ["all", "music", "songs", "tracks", "library"],
  },
  {
    label: "Generate Music",
    path: "/genarate",
    icon: <HiSparkles />,
    keywords: ["generate", "create", "ai", "suno", "new music"],
  },
  {
    label: "Form Elements",
    path: "/form-elements",
    icon: <MdFormatListBulletedAdd />,
    keywords: ["form", "elements", "inputs", "fields"],
  },
  {
    label: "All Users",
    path: "/users",
    icon: <FiUsers />,
    keywords: ["users", "staff", "members", "people", "accounts"],
  },
  {
    label: "Create Staff",
    path: "/create-staff",
    icon: <FiUserPlus />,
    keywords: ["create", "staff", "add user", "new staff", "invite"],
  },
  {
    label: "User Profile",
    path: "/profile",
    icon: <FaRegCircleUser />,
    keywords: ["profile", "account", "me", "my profile"],
  },
  {
    label: "Settings",
    path: "/settings",
    icon: <LuSettings />,
    keywords: ["settings", "preferences", "config", "configuration"],
  },
];

export default function GlobalSearch() {
  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [results, setResults] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  
  const inputRef = useRef(null);
  const dropdownRef = useRef(null);
  const router = useRouter();

  // Reset active index on query or results change
  useEffect(() => {
    setActiveIndex(-1);
  }, [query, results]);

  // Handle Cmd+K / Ctrl+K
  useEffect(() => {
    const handleKeyDown = (event) => {
      if ((event.metaKey || event.ctrlKey) && event.key === "k") {
        event.preventDefault();
        inputRef.current?.focus();
        setIsOpen(true);
      }
      if (event.key === "Escape") {
        setIsOpen(false);
        inputRef.current?.blur();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Handle click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        dropdownRef.current && 
        !dropdownRef.current.contains(event.target) &&
        inputRef.current && 
        !inputRef.current.contains(event.target)
      ) {
        setIsOpen(false);
      }
    };
    
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Debounced API call for searching orders
  useEffect(() => {
    const searchOrders = async () => {
      if (query.trim().length < 2) {
        setResults([]);
        return;
      }
      
      setIsLoading(true);
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
        if (res.ok) {
          const data = await res.json();
          setResults(data.results || []);
        }
      } catch (error) {
        console.error("Search failed:", error);
      } finally {
        setIsLoading(false);
      }
    };

    const debounceTimer = setTimeout(searchOrders, 300);
    return () => clearTimeout(debounceTimer);
  }, [query]);

  // When empty, show the default QUICK_LINKS. When typing, search across ALL
  // routes by matching the label, path, or any related keyword so users can
  // reach any route in the app.
  const q = query.trim().toLowerCase();
  const filteredLinks = q.length === 0
    ? QUICK_LINKS
    : ALL_ROUTES.filter((link) => {
        const haystack = [
          link.label.toLowerCase(),
          link.path.toLowerCase(),
          ...(link.keywords || []),
        ].join(" ");
        // Match if every whitespace-separated term appears in the haystack.
        return q.split(/\s+/).every((term) => haystack.includes(term));
      });

  // Combine items for keyboard navigation
  const items = [
    ...filteredLinks.map(link => ({ type: "link", data: link })),
    ...(query.trim().length >= 2 ? results.map(order => ({ type: "order", data: order })) : [])
  ];

  const handleInputKeyDown = (e) => {
    if (!isOpen) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((prev) => (prev < items.length - 1 ? prev + 1 : prev));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((prev) => (prev > -1 ? prev - 1 : -1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      // Use the highlighted item, or fall back to the first available match so
      // a user can just type and press Enter to jump to a route.
      const targetIndex =
        activeIndex >= 0 && activeIndex < items.length ? activeIndex : 0;
      const item = items[targetIndex];
      if (item) {
        if (item.type === "link") {
          handleNavigate(item.data.path);
        } else if (item.type === "order") {
          handleNavigate(item.data.url);
        }
      }
    }
  };

  const handleNavigate = (path) => {
    setIsOpen(false);
    setQuery("");
    setActiveIndex(-1);
    router.push(path);
  };

  // Auto-scroll the dropdown when navigating with keyboard
  useEffect(() => {
    if (activeIndex >= 0 && dropdownRef.current) {
      const activeElement = document.getElementById(`search-item-${activeIndex}`);
      if (activeElement) {
        activeElement.scrollIntoView({ block: "nearest" });
      }
    }
  }, [activeIndex]);

  return (
    <div className="relative z-50">
      <div className="relative">
        <span className="absolute -translate-y-1/2 left-4 top-1/2 pointer-events-none">
          <svg
            className="fill-gray-500 dark:fill-gray-400"
            width="20"
            height="20"
            viewBox="0 0 20 20"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              fillRule="evenodd"
              clipRule="evenodd"
              d="M3.04175 9.37363C3.04175 5.87693 5.87711 3.04199 9.37508 3.04199C12.8731 3.04199 15.7084 5.87693 15.7084 9.37363C15.7084 12.8703 12.8731 15.7053 9.37508 15.7053C5.87711 15.7053 3.04175 12.8703 3.04175 9.37363ZM9.37508 1.54199C5.04902 1.54199 1.54175 5.04817 1.54175 9.37363C1.54175 13.6991 5.04902 17.2053 9.37508 17.2053C11.2674 17.2053 13.003 16.5344 14.357 15.4176L17.177 18.238C17.4699 18.5309 17.9448 18.5309 18.2377 18.238C18.5306 17.9451 18.5306 17.4703 18.2377 17.1774L15.418 14.3573C16.5365 13.0033 17.2084 11.2669 17.2084 9.37363C17.2084 5.04817 13.7011 1.54199 9.37508 1.54199Z"
              fill=""
            />
          </svg>
        </span>
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          onKeyDown={handleInputKeyDown}
          placeholder="Search or type command..."
          className="dark:bg-dark-900 h-11 w-full rounded-lg border border-gray-200 bg-transparent py-2.5 pl-12 pr-14 text-sm text-gray-800 shadow-theme-xs placeholder:text-gray-400 focus:border-brand-300 focus:outline-hidden focus:ring-3 focus:ring-brand-500/10 dark:border-gray-800 dark:bg-gray-900 dark:bg-white/[0.03] dark:text-white/90 dark:placeholder:text-white/30 dark:focus:border-brand-800 xl:w-[430px]"
        />

        <button 
          onClick={() => {
            inputRef.current?.focus();
            setIsOpen(true);
          }}
          type="button"
          className="absolute right-2.5 top-1/2 inline-flex -translate-y-1/2 items-center gap-0.5 rounded-lg border border-gray-200 bg-gray-50 px-[7px] py-[4.5px] text-xs -tracking-[0.2px] text-gray-500 dark:border-gray-800 dark:bg-white/[0.03] dark:text-gray-400"
        >
          <span> ⌘ </span>
          <span> K </span>
        </button>
      </div>

      {/* Dropdown Menu */}
      {isOpen && (query.trim().length > 0 || filteredLinks.length > 0) && (
        <div 
          ref={dropdownRef}
          className="absolute top-full mt-2 w-full rounded-xl border border-gray-200 bg-white py-2 shadow-lg dark:border-gray-800 dark:bg-gray-900"
        >
          <style dangerouslySetInnerHTML={{__html: `
            .custom-search-scrollbar::-webkit-scrollbar {
              width: 6px;
            }
            .custom-search-scrollbar::-webkit-scrollbar-track {
              background: transparent;
            }
            .custom-search-scrollbar::-webkit-scrollbar-thumb {
              background-color: #cbd5e1;
              border-radius: 10px;
            }
            .dark .custom-search-scrollbar::-webkit-scrollbar-thumb {
              background-color: #475569;
            }
          `}} />
          <div className="max-h-[400px] overflow-y-auto custom-search-scrollbar">
            {/* Quick Links Section */}
            {filteredLinks.length > 0 && (
              <div className="px-2">
                <h4 className="px-3 py-2 text-xs font-semibold text-gray-400 uppercase tracking-wider">
                  Quick Links
                </h4>
                <ul className="space-y-1">
                  {filteredLinks.map((link, index) => {
                    const globalIndex = index;
                    const isActive = globalIndex === activeIndex;
                    return (
                      <li key={link.path} id={`search-item-${globalIndex}`}>
                        <button
                          onClick={() => handleNavigate(link.path)}
                          onMouseEnter={() => setActiveIndex(globalIndex)}
                          className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm transition ${
                            isActive 
                              ? "bg-gray-100 text-brand-600 dark:bg-white/[0.1] dark:text-brand-400" 
                              : "text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-white/[0.05]"
                          }`}
                        >
                          <span className="text-lg">{link.icon}</span>
                          {link.label}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}

            {/* Separator if both sections exist */}
            {filteredLinks.length > 0 && (query.trim().length >= 2) && (
              <div className="mx-2 my-2 h-[1px] bg-gray-100 dark:bg-gray-800"></div>
            )}

            {/* Orders/Search Results Section */}
            {query.trim().length >= 2 && (
              <div className="px-2">
                <h4 className="px-3 py-2 text-xs font-semibold text-gray-400 uppercase tracking-wider flex items-center justify-between">
                  <span>Orders</span>
                  {isLoading && <span className="animate-pulse">Searching...</span>}
                </h4>
                
                {!isLoading && results.length === 0 ? (
                  <div className="px-3 py-4 text-center text-sm text-gray-500">
                    No orders found for &quot;{query}&quot;
                  </div>
                ) : (
                  <ul className="space-y-1">
                    {results.map((order, idx) => {
                      const globalIndex = filteredLinks.length + idx;
                      const isActive = globalIndex === activeIndex;
                      
                      // Using icons based on type
                      const isShopify = order.type === "shopify";
                      const OrderIcon = isShopify ? BiPurchaseTag : RiMusicAiLine;
                      
                      return (
                        <li key={order._id} id={`search-item-${globalIndex}`}>
                          <button
                            onClick={() => handleNavigate(order.url)}
                            onMouseEnter={() => setActiveIndex(globalIndex)}
                            className={`flex w-full items-start justify-between gap-3 rounded-lg px-3 py-2 text-left transition ${
                              isActive 
                                ? "bg-gray-100 dark:bg-white/[0.1]" 
                                : "hover:bg-gray-100 dark:hover:bg-white/[0.05]"
                            }`}
                          >
                            <div className="flex flex-col overflow-hidden gap-1">
                              <div className="flex items-center gap-2">
                                <OrderIcon className={`text-sm ${isShopify ? 'text-green-500' : 'text-blue-500'}`} />
                                <span className="truncate text-sm font-medium text-gray-800 dark:text-gray-200">
                                  {order.title}
                                </span>
                              </div>
                              <span className="truncate text-xs text-gray-500 pl-6">
                                {order.subtitle}
                              </span>
                            </div>
                            <Badge
                              size="sm"
                              color={
                                order.status === "paid" || order.status === "fulfilled"
                                  ? "success"
                                  : order.status === "in_cart"
                                    ? "info"
                                    : order.status === "created"
                                      ? "light"
                                      : (order.status === "pending" || order.status === "pending_payment")
                                        ? "warning"
                                        : "error"
                              }
                            >
                              {order.status === "created" ? "Created" : order.status === "paid" ? "Paid" : order.status}
                            </Badge>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
