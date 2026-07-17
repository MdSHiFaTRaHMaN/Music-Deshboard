"use client";
// import Chart from "react-apexcharts";

import dynamic from "next/dynamic";
import { PencilIcon } from "@/icons";
import { useState } from "react";
import { useRouter } from "next/navigation";

// Dynamically import the ReactApexChart component
const ReactApexChart = dynamic(() => import("react-apexcharts"), {
  ssr: false,
});

export default function MonthlyTarget({
  revenueThisMonth = 0,
  revenueLastMonth = 0,
  revenueToday = 0,
  monthlyTarget = 20000
}) {
  const router = useRouter();
  const target = monthlyTarget;
  
  const [isEditing, setIsEditing] = useState(false);
  const [inputValue, setInputValue] = useState(target);

  const handleSave = async () => {
    try {
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ monthlyTarget: Number(inputValue) }),
      });
      if (res.ok) {
        setIsEditing(false);
        router.refresh();
      }
    } catch (error) {
      console.error("Error saving target:", error);
    }
  };
  
  const progressPercentage = target > 0 ? Math.min((revenueThisMonth / target) * 100, 100).toFixed(2) : 0;
  const series = [parseFloat(progressPercentage)];
  
  const growthPercentage = revenueLastMonth > 0 ? (((revenueThisMonth - revenueLastMonth) / revenueLastMonth) * 100).toFixed(1) : 0;
  const isHigher = revenueThisMonth >= revenueLastMonth;

  const formatCurrency = (val) => {
    if (val >= 1000) {
      return `€${(val / 1000).toFixed(1)}K`.replace('.0K', 'K');
    }
    return `€${val.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
  };

  const options = {
    colors: ["#465FFF"],
    chart: {
      fontFamily: "Outfit, sans-serif",
      type: "radialBar",
      height: 330,
      sparkline: {
        enabled: true,
      },
    },
    plotOptions: {
      radialBar: {
        startAngle: -85,
        endAngle: 85,
        hollow: {
          size: "80%",
        },
        track: {
          background: "#E4E7EC",
          strokeWidth: "100%",
          margin: 5, // margin is in pixels
        },
        dataLabels: {
          name: {
            show: false,
          },
          value: {
            fontSize: "36px",
            fontWeight: "600",
            offsetY: -40,
            color: "#1D2939",
            formatter: function (val) {
              return val + "%";
            },
          },
        },
      },
    },
    fill: {
      type: "solid",
      colors: ["#465FFF"],
    },
    stroke: {
      lineCap: "round",
    },
    labels: ["Progress"],
  };

  const UpArrowSVG = () => (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path fillRule="evenodd" clipRule="evenodd" d="M7.60141 2.33683C7.73885 2.18084 7.9401 2.08243 8.16435 2.08243C8.16475 2.08243 8.16516 2.08243 8.16556 2.08243C8.35773 2.08219 8.54998 2.15535 8.69664 2.30191L12.6968 6.29924C12.9898 6.59203 12.9899 7.0669 12.6971 7.3599C12.4044 7.6529 11.9295 7.65306 11.6365 7.36027L8.91435 4.64004L8.91435 13.5C8.91435 13.9142 8.57856 14.25 8.16435 14.25C7.75013 14.25 7.41435 13.9142 7.41435 13.5L7.41435 4.64442L4.69679 7.36025C4.4038 7.65305 3.92893 7.6529 3.63613 7.35992C3.34333 7.06693 3.34348 6.59206 3.63646 6.29926L7.60141 2.33683Z" fill="#039855" />
    </svg>
  );

  const DownArrowSVG = () => (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path fillRule="evenodd" clipRule="evenodd" d="M7.26816 13.6632C7.4056 13.8192 7.60686 13.9176 7.8311 13.9176C7.83148 13.9176 7.83187 13.9176 7.83226 13.9176C8.02445 13.9178 8.21671 13.8447 8.36339 13.6981L12.3635 9.70076C12.6565 9.40797 12.6567 8.9331 12.3639 8.6401C12.0711 8.34711 11.5962 8.34694 11.3032 8.63973L8.5811 11.36L8.5811 2.5C8.5811 2.08579 8.24531 1.75 7.8311 1.75C7.41688 1.75 7.0811 2.08579 7.0811 2.5L7.0811 11.3556L4.36354 8.63975C4.07055 8.34695 3.59568 8.3471 3.30288 8.64009C3.01008 8.93307 3.01023 9.40794 3.30321 9.70075L7.26816 13.6632Z" fill="#D92D20" />
    </svg>
  );

  return (
    <div className="rounded-2xl border border-gray-200 bg-gray-100 dark:border-gray-800 dark:bg-white/[0.03]">
      <div className="px-5 pt-5 bg-white shadow-default rounded-2xl pb-11 dark:bg-gray-900 sm:px-6 sm:pt-6">
        <div className="flex justify-between items-start">
          <div>
            <h3 className="text-lg font-semibold text-gray-800 dark:text-white/90">
              Monthly Target
            </h3>
            <p className="mt-1 font-normal text-gray-500 text-theme-sm dark:text-gray-400">
              Target you’ve set for each month
            </p>
          </div>
          <div className="relative inline-block">
            {isEditing ? (
              <div className="flex items-center gap-2 mt-1">
                <input 
                  type="number" 
                  value={inputValue} 
                  onChange={(e) => setInputValue(e.target.value)}
                  className="w-24 px-2 py-1 text-sm border rounded dark:bg-gray-800 dark:border-gray-700 dark:text-white outline-none focus:border-brand-500"
                />
                <button onClick={handleSave} className="px-3 py-1 text-xs font-medium text-white bg-brand-500 hover:bg-brand-600 rounded transition">Save</button>
                <button onClick={() => setIsEditing(false)} className="px-3 py-1 text-xs font-medium text-gray-600 bg-gray-200 hover:bg-gray-300 rounded dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600 transition">Cancel</button>
              </div>
            ) : (
              <button onClick={() => setIsEditing(true)} className="p-1 mt-1 text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 transition">
                <PencilIcon className="w-5 h-5" />
              </button>
            )}
          </div>
        </div>
        <div className="relative mt-2">
          <div className="max-h-[330px]">
            <ReactApexChart
              options={options}
              series={series}
              type="radialBar"
              height={330}
            />
          </div>

          <span className={`absolute left-1/2 top-full -translate-x-1/2 -translate-y-[95%] rounded-full px-3 py-1 text-xs font-medium ${isHigher ? 'bg-success-50 text-success-600 dark:bg-success-500/15 dark:text-success-500' : 'bg-error-50 text-error-600 dark:bg-error-500/15 dark:text-error-500'}`}>
            {isHigher ? '+' : ''}{growthPercentage}%
          </span>
        </div>
        <p className="mx-auto mt-10 w-full max-w-[380px] text-center text-sm text-gray-500 sm:text-base">
          You earned €{revenueToday.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })} today, {isHigher ? "it's higher than last month. Keep up your good work!" : "which is lower than last month. Let's push for more sales!"}
        </p>
      </div>

      <div className="flex items-center justify-center gap-5 px-6 py-3.5 sm:gap-8 sm:py-5">
        <div>
          <p className="mb-1 text-center text-gray-500 text-theme-xs dark:text-gray-400 sm:text-sm">
            Target
          </p>
          <p className="flex items-center justify-center gap-1 text-base font-semibold text-gray-800 dark:text-white/90 sm:text-lg">
            {formatCurrency(target)}
            <UpArrowSVG />
          </p>
        </div>

        <div className="w-px bg-gray-200 h-7 dark:bg-gray-800"></div>

        <div>
          <p className="mb-1 text-center text-gray-500 text-theme-xs dark:text-gray-400 sm:text-sm">
            Revenue
          </p>
          <p className="flex items-center justify-center gap-1 text-base font-semibold text-gray-800 dark:text-white/90 sm:text-lg">
            {formatCurrency(revenueThisMonth)}
            {isHigher ? <UpArrowSVG /> : <DownArrowSVG />}
          </p>
        </div>

        <div className="w-px bg-gray-200 h-7 dark:bg-gray-800"></div>

        <div>
          <p className="mb-1 text-center text-gray-500 text-theme-xs dark:text-gray-400 sm:text-sm">
            Today
          </p>
          <p className="flex items-center justify-center gap-1 text-base font-semibold text-gray-800 dark:text-white/90 sm:text-lg">
            {formatCurrency(revenueToday)}
            <UpArrowSVG />
          </p>
        </div>
      </div>
    </div>
  );
}
