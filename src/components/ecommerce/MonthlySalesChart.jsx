"use client";
import dynamic from "next/dynamic";
import { MoreDotIcon } from "@/icons";
import { DropdownItem } from "../ui/dropdown/DropdownItem";
import { useState } from "react";
import { Dropdown } from "../ui/dropdown/Dropdown";

// Dynamically import the ReactApexChart component
const ReactApexChart = dynamic(() => import("react-apexcharts"), {
  ssr: false,
});

export default function MonthlySalesChart({ chartData = {} }) {
  const [timeRange, setTimeRange] = useState('7_days');
  const [isOpen, setIsOpen] = useState(false);

  // Fallback data structure
  const safeData = {
    '7_days': chartData['7_days'] || { categories: [], series: [] },
    '30_days': chartData['30_days'] || { categories: [], series: [] },
    '60_days': chartData['60_days'] || { categories: [], series: [] }
  };

  const currentData = safeData[timeRange];

  const options = {
    colors: ["#ff8f43"],
    chart: {
      fontFamily: "Outfit, sans-serif",
      type: "bar",
      height: "100%",
      toolbar: {
        show: false,
      },
    },
    plotOptions: {
      bar: {
        horizontal: false,
        columnWidth: "25%",
        borderRadius: 6,
        borderRadiusApplication: "end",
      },
    },
    dataLabels: {
      enabled: false,
    },
    stroke: {
      show: true,
      width: 4,
      colors: ["transparent"],
    },
    xaxis: {
      categories: currentData.categories.length > 0 ? currentData.categories : [],
      axisBorder: {
        show: false,
      },
      axisTicks: {
        show: false,
      },
      tickAmount: timeRange === '7_days' ? 7 : timeRange === '30_days' ? 6 : 10,
      labels: {
        rotate: 0,
        hideOverlappingLabels: true,
        style: {
          colors: "#64748B",
        }
      }
    },
    legend: {
      show: true,
      position: "top",
      horizontalAlign: "left",
      fontFamily: "Outfit",
    },
    yaxis: {
      title: {
        text: undefined,
      },
      min: 0,
      labels: {
        formatter: (val) => Math.floor(val),
        style: {
          colors: "#64748B",
        }
      }
    },
    grid: {
      yaxis: {
        lines: {
          show: true,
        },
      },
      borderColor: "#F1F5F9",
      strokeDashArray: 4,
    },
    fill: {
      opacity: 1,
    },
    tooltip: {
      theme: "light",
      x: {
        show: false,
      },
      y: {
        formatter: (val) => `${val}`,
      },
    },
  };
  
  const series = [
    {
      name: "Orders",
      data: currentData.series.length > 0 ? currentData.series : [],
    },
  ];

  function toggleDropdown() {
    setIsOpen(!isOpen);
  }

  function closeDropdown() {
    setIsOpen(false);
  }

  const handleSelectRange = (range) => {
    setTimeRange(range);
    closeDropdown();
  };

  const titleText = timeRange === '7_days' ? 'Orders (Last 7 Days)' : 
                    timeRange === '30_days' ? 'Orders (Last 30 Days)' : 'Orders (Last 60 Days)';

  return (
    <div className="flex flex-col h-full overflow-hidden rounded-2xl border border-gray-200 bg-white px-5 pt-5 dark:border-gray-800 dark:bg-white/[0.03] sm:px-6 sm:pt-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-800 dark:text-white/90">
          {titleText}
        </h3>

        <div className="relative inline-block">
          <button onClick={toggleDropdown} className="dropdown-toggle">
            <MoreDotIcon className="text-gray-400 hover:text-gray-700 dark:hover:text-gray-300" />
          </button>
          <Dropdown
            isOpen={isOpen}
            onClose={closeDropdown}
            className="w-48 p-2"
          >
            <DropdownItem
              onItemClick={() => handleSelectRange('7_days')}
              className={`flex w-full font-normal text-left rounded-lg hover:bg-gray-100 dark:hover:bg-white/5 ${timeRange === '7_days' ? 'text-brand-500 bg-brand-50 dark:bg-brand-500/10' : 'text-gray-500 dark:text-gray-400'}`}
            >
              Last 7 Days
            </DropdownItem>
            <DropdownItem
              onItemClick={() => handleSelectRange('30_days')}
              className={`flex w-full font-normal text-left rounded-lg hover:bg-gray-100 dark:hover:bg-white/5 ${timeRange === '30_days' ? 'text-brand-500 bg-brand-50 dark:bg-brand-500/10' : 'text-gray-500 dark:text-gray-400'}`}
            >
              Last 30 Days
            </DropdownItem>
            <DropdownItem
              onItemClick={() => handleSelectRange('60_days')}
              className={`flex w-full font-normal text-left rounded-lg hover:bg-gray-100 dark:hover:bg-white/5 ${timeRange === '60_days' ? 'text-brand-500 bg-brand-50 dark:bg-brand-500/10' : 'text-gray-500 dark:text-gray-400'}`}
            >
              Last 60 Days
            </DropdownItem>
          </Dropdown>
        </div>
      </div>

      <div className="flex-1 w-full mt-4 min-h-[300px]">
        <div className="-ml-5 w-full h-full pl-2">
          <ReactApexChart
            options={options}
            series={series}
            type="bar"
            height="100%"
            width="100%"
          />
        </div>
      </div>
    </div>
  );
}
