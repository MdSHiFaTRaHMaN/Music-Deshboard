"use client";
import React, { useEffect, useRef, useState, useCallback } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useSidebar } from "../context/SidebarContext";
import { useUser } from "../context/UserContext";
import { BiPurchaseTag } from "react-icons/bi";
import {
  GridIcon,
  HorizontaLDots,
} from "../icons/index";

import logoImage from "../../public/images/logo/own-music-logo.png";
import { FaChevronDown, FaRegCircleUser } from "react-icons/fa6";
import { MdFormatListBulletedAdd } from "react-icons/md";
import { RiMusicAiLine } from "react-icons/ri";
import { FiUsers, FiSettings } from "react-icons/fi";

const navItems = [
  {
    icon: <GridIcon className="text-orange-500 text-xl" />,
    name: "Dashboard",
    path: "/",
  },
  {
    icon: <BiPurchaseTag className="text-orange-500 text-xl" />,
    name: "Shopify Orders",
    path: "/orders",
  },
  {
    name: "Form Elements",
    icon: <MdFormatListBulletedAdd className="text-orange-500 text-xl" />,
    path: "/form-elements",
  },
  {
    name: "Musics",
    icon: <RiMusicAiLine className="text-orange-500 text-xl" />,
    subItems: [
      { name: "Customer Choice Music", path: "/ordered-musics", pro: false },
      { name: "All Music", path: "/all-musics", pro: false },
    ],
  },
];

const othersItems = (role) => [
  ...(role === "admin"
    ? [
      {
        icon: <FiUsers className="text-orange-500 text-xl" />,
        name: "Staff Management",
        subItems: [
          { name: "All Users", path: "/users", pro: false },
          { name: "Create Staff", path: "/create-staff", pro: false },
        ],
      },
    ]
    : []),
  {
    icon: <FaRegCircleUser className="text-orange-500 text-xl" />,
    name: "User Profile",
    path: "/profile",
  },
];

const AppSidebar = () => {
  const { isExpanded, isMobileOpen, isHovered, setIsHovered } = useSidebar();
  const { user } = useUser();
  const pathname = usePathname();

  const renderMenuItems = (navItems, menuType) => (
    <ul className="flex flex-col gap-4">
      {navItems.map((nav, index) => (
        <li key={nav.name}>
          {nav.subItems ? (
            <button
              onClick={() => handleSubmenuToggle(index, menuType)}
              className={`menu-item group  ${openSubmenu?.type === menuType && openSubmenu?.index === index
                ? "menu-item-active"
                : "menu-item-inactive"
                } cursor-pointer ${!isExpanded && !isHovered
                  ? "lg:justify-center"
                  : "lg:justify-start"
                }`}
            >
              <span
                className={` ${openSubmenu?.type === menuType && openSubmenu?.index === index
                  ? "menu-item-icon-active"
                  : "menu-item-icon-inactive"
                  }`}
              >
                {nav.icon}
              </span>
              {(isExpanded || isHovered || isMobileOpen) && (
                <span className={`menu-item-text text-orange-500`}>{nav.name}</span>
              )}
              {(isExpanded || isHovered || isMobileOpen) && (
                <FaChevronDown
                  className={`ml-auto w-3 h-3 transition-transform duration-200 text-orange-500  ${openSubmenu?.type === menuType &&
                    openSubmenu?.index === index
                    ? "rotate-180 text-orange-500"
                    : ""
                    }`}
                />
              )}
            </button>
          ) : (
            nav.path && (
              <Link
                href={nav.path}
                className={`menu-item group ${isActive(nav.path) ? "menu-item-active" : "menu-item-inactive"
                  }`}
              >
                <span
                  className={`${isActive(nav.path)
                    ? "menu-item-icon-active"
                    : "menu-item-icon-inactive"
                    }`}
                >
                  {nav.icon}
                </span>
                {(isExpanded || isHovered || isMobileOpen) && (
                  <span className={`menu-item-text text-orange-500`}>{nav.name}</span>
                )}
              </Link>
            )
          )}
          {nav.subItems && (isExpanded || isHovered || isMobileOpen) && (
            <div
              ref={(el) => {
                subMenuRefs.current[`${menuType}-${index}`] = el;
              }}
              className="overflow-hidden transition-all duration-300"
              style={{
                height:
                  openSubmenu?.type === menuType && openSubmenu?.index === index
                    ? `${subMenuHeight[`${menuType}-${index}`]}px`
                    : "0px",
              }}
            >
              <ul className="mt-2 space-y-1 ml-9">
                {nav.subItems.map((subItem) => (
                  <li key={subItem.name}>
                    <Link
                      href={subItem.path}
                      className={`menu-dropdown-item ${isActive(subItem.path)
                        ? "menu-dropdown-item-active"
                        : "menu-dropdown-item-inactive"
                        }`}
                    >
                      <span className="text-orange-500">{subItem.name}</span>
                      <span className="flex items-center gap-1 ml-auto">
                        {subItem.new && (
                          <span
                            className={`ml-auto ${isActive(subItem.path)
                              ? "menu-dropdown-badge-active"
                              : "menu-dropdown-badge-inactive"
                              } menu-dropdown-badge `}
                          >
                            new
                          </span>
                        )}
                        {subItem.pro && (
                          <span
                            className={`ml-auto ${isActive(subItem.path)
                              ? "menu-dropdown-badge-active"
                              : "menu-dropdown-badge-inactive"
                              } menu-dropdown-badge `}
                          >
                            pro
                          </span>
                        )}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </li>
      ))}
    </ul>
  );

  const [openSubmenu, setOpenSubmenu] = useState(null);
  const [subMenuHeight, setSubMenuHeight] = useState({});
  const subMenuRefs = useRef({});

  // const isActive = (path: string) => path === pathname;
  const isActive = useCallback((path) => path === pathname, [pathname]);

  useEffect(() => {
    // Check if the current path matches any submenu item
    let submenuMatched = false;
    ["main", "others"].forEach((menuType) => {
      const items = menuType === "main" ? navItems : othersItems(user?.role);
      items.forEach((nav, index) => {
        if (nav.subItems) {
          nav.subItems.forEach((subItem) => {
            if (isActive(subItem.path)) {
              setOpenSubmenu({
                type: menuType,
                index,
              });
              submenuMatched = true;
            }
          });
        }
      });
    });

    // If no submenu item matches, close the open submenu
    if (!submenuMatched) {
      // eslint-disable-next-line react-hooks/exhaustive-deps
      setOpenSubmenu(null);
    }
  }, [pathname, isActive]);

  useEffect(() => {
    // Set the height of the submenu items when the submenu is opened
    if (openSubmenu !== null) {
      const key = `${openSubmenu.type}-${openSubmenu.index}`;
      if (subMenuRefs.current[key]) {
        setSubMenuHeight((prevHeights) => ({
          ...prevHeights,
          [key]: subMenuRefs.current[key]?.scrollHeight || 0,
        }));
      }
    }
  }, [openSubmenu]);

  const handleSubmenuToggle = (index, menuType) => {
    setOpenSubmenu((prevOpenSubmenu) => {
      if (
        prevOpenSubmenu &&
        prevOpenSubmenu.type === menuType &&
        prevOpenSubmenu.index === index
      ) {
        return null;
      }
      return { type: menuType, index };
    });
  };

  return (
    <aside
      className={`fixed mt-16 flex flex-col lg:mt-0 top-0 px-5 left-0 bg-white dark:bg-gray-900 dark:border-gray-800 text-gray-900 h-screen transition-all duration-300 ease-in-out z-50 border-r border-gray-200 
        ${isExpanded || isMobileOpen
          ? "w-[290px]"
          : isHovered
            ? "w-[290px]"
            : "w-[90px]"
        }
        ${isMobileOpen ? "translate-x-0" : "-translate-x-full"}
        lg:translate-x-0`}
      onMouseEnter={() => !isExpanded && setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div
        className={`py-5 flex  ${!isExpanded && !isHovered ? "lg:justify-center" : "justify-start"
          }`}
      >
        <Link href="/">
          {isExpanded || isHovered || isMobileOpen ? (
            <>
              <div className="flex items-center gap-2 uppercase text-2xl font-bold text-[#FF8A3E]">
                <Image
                  className="dark:hidden"
                  src={logoImage}
                  alt="Logo"
                  width={60}
                  height={60}
                  style={{ height: 'auto' }}
                />
                <Image
                  className="hidden dark:block"
                  src={logoImage}
                  alt="Logo"
                  width={60}
                  height={60}
                />
                Dashboard
              </div>
            </>
          ) : (
            <Image
              src={logoImage}
              alt="Logo"
              width={32}
              height={32}
            />
          )}
        </Link>
      </div>
      <div className="flex-1 flex flex-col overflow-y-auto duration-300 ease-linear no-scrollbar">
        <nav className="mb-6">
          <div className="flex flex-col gap-4">
            <div>
              <h2
                className={`mb-4 text-xs uppercase flex text-orange-400 ${!isExpanded && !isHovered
                  ? "lg:justify-center"
                  : "justify-start"
                  }`}
              >
                {isExpanded || isHovered || isMobileOpen ? (
                  "Menu"
                ) : (
                  <HorizontaLDots />
                )}
              </h2>
              {renderMenuItems(navItems, "main")}
            </div>

            <div className="">
              <h2
                className={`mb-4 text-xs uppercase flex text-orange-400 ${!isExpanded && !isHovered
                  ? "lg:justify-center"
                  : "justify-start"
                  }`}
              >
                {isExpanded || isHovered || isMobileOpen ? (
                  "Others"
                ) : (
                  <HorizontaLDots />
                )}
              </h2>
              {renderMenuItems(othersItems(user?.role), "others")}
            </div>
          </div>
        </nav>
        {isExpanded || isHovered || isMobileOpen ? "" : null}
      </div>

      {/* Pinned Bottom Settings for Admin */}
      {user?.role === "admin" && (
        <div className="mt-auto pt-3 pb-5 border-t border-gray-200 dark:border-gray-800">
          <Link
            href="/settings"
            className={`menu-item group ${isActive("/settings") ? "menu-item-active" : "menu-item-inactive"
              }`}
          >
            <span
              className={`${isActive("/settings")
                ? "menu-item-icon-active"
                : "menu-item-icon-inactive"
                }`}
            >
              <FiSettings className="text-orange-500 text-xl" />
            </span>
            {(isExpanded || isHovered || isMobileOpen) && (
              <span className={`menu-item-text text-orange-500`}>Settings</span>
            )}
          </Link>
        </div>
      )}
    </aside>
  );
};

export default AppSidebar;
