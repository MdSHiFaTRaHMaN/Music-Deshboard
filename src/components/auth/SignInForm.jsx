"use client";
import Checkbox from "@/components/form/input/Checkbox";
import Input from "@/components/form/input/InputField";
import Label from "@/components/form/Label";
import Button from "@/components/ui/button/Button";
import { ChevronLeftIcon, EyeCloseIcon, EyeIcon } from "@/icons";
import Link from "next/link";
import { useRouter } from "next/navigation";
import React, { useState, useRef } from "react";
import { useUser } from "@/context/UserContext";

export default function SignInForm() {
  const router = useRouter();
  const { fetchUser } = useUser();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isChecked, setIsChecked] = useState(true);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  
  const [requires2FA, setRequires2FA] = useState(false);
  const [tempToken, setTempToken] = useState("");
  const [twoFactorCode, setTwoFactorCode] = useState("");
  const [codeDigits, setCodeDigits] = useState(["", "", "", "", "", ""]);
  const inputRefs = useRef([]);

  const handleDigitChange = (index, value) => {
    if (!/^\d*$/.test(value)) return;
    const digit = value.slice(-1);
    const newDigits = [...codeDigits];
    newDigits[index] = digit;
    setCodeDigits(newDigits);
    setTwoFactorCode(newDigits.join(""));
    
    if (digit !== "" && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index, e) => {
    if (e.key === "Backspace" && !codeDigits[index] && index > 0) {
      // If current box is empty, backspace should clear the previous box and focus it
      const newDigits = [...codeDigits];
      newDigits[index - 1] = "";
      setCodeDigits(newDigits);
      setTwoFactorCode(newDigits.join(""));
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handleFocus = (index, e) => {
    const firstEmptyIndex = inputRefs.current.findIndex(el => el && el.value === "");
    if (firstEmptyIndex !== -1 && index > firstEmptyIndex) {
      inputRefs.current[firstEmptyIndex]?.focus();
    } else if (e && e.target) {
      // Select the content so the user can easily overwrite it
      e.target.select();
    }
  };

  const handlePaste = (e) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (pastedData) {
      const newDigits = [...codeDigits];
      for (let i = 0; i < pastedData.length; i++) {
        newDigits[i] = pastedData[i];
      }
      setCodeDigits(newDigits);
      setTwoFactorCode(newDigits.join(""));
      const nextIndex = pastedData.length < 6 ? pastedData.length : 5;
      inputRefs.current[nextIndex]?.focus();
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, keepLoggedIn: isChecked })
      });

      const data = await res.json();
      if (res.ok) {
        if (data.requires2FA) {
          setRequires2FA(true);
          setTempToken(data.tempToken);
        } else {
          // Fetch the user data so the context is updated
          await fetchUser();
          // Redirect to dashboard
          router.push("/");
          router.refresh();
        }
      } else {
        setError(data.error || "Login failed");
      }
    } catch (err) {
      setError("An unexpected error occurred");
    } finally {
      setLoading(false);
    }
  };

  const handleVerify2FA = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/auth/login/verify-2fa", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tempToken, code: twoFactorCode })
      });

      const data = await res.json();
      if (res.ok) {
        await fetchUser();
        router.push("/");
        router.refresh();
      } else {
        setError(data.error || "Invalid 2FA code");
      }
    } catch (err) {
      setError("An unexpected error occurred");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col flex-1 lg:w-1/2 w-full">
      <div className="w-full max-w-md sm:pt-10 mx-auto mb-5">
        <Link
          href="/"
          className="inline-flex items-center text-sm text-gray-500 transition-colors hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
        >
          <ChevronLeftIcon />
          Back to dashboard
        </Link>
      </div>
      <div className="flex flex-col justify-center flex-1 w-full max-w-md mx-auto">
        <div>
          <div className="mb-5 sm:mb-8">
            <h1 className="mb-2 font-semibold text-gray-800 text-title-sm dark:text-white/90 sm:text-title-md">
              {requires2FA ? "Two-Step Verification" : "Sign In"}
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {requires2FA 
                ? "Open your Authenticator app and enter the 6-digit code." 
                : "Enter your email and password to sign in!"}
            </p>
          </div>
          <div>
            {/* <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-5">
              <button className="inline-flex items-center justify-center gap-3 py-3 text-sm font-normal text-gray-700 transition-colors bg-gray-100 rounded-lg px-7 hover:bg-gray-200 hover:text-gray-800 dark:bg-white/5 dark:text-white/90 dark:hover:bg-white/10">
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 20 20"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    d="M18.7511 10.1944C18.7511 9.47495 18.6915 8.94995 18.5626 8.40552H10.1797V11.6527H15.1003C15.0011 12.4597 14.4654 13.675 13.2749 14.4916L13.2582 14.6003L15.9087 16.6126L16.0924 16.6305C17.7788 15.1041 18.7511 12.8583 18.7511 10.1944Z"
                    fill="#4285F4"
                  />

                  <path
                    d="M10.1788 18.75C12.5895 18.75 14.6133 17.9722 16.0915 16.6305L13.274 14.4916C12.5201 15.0068 11.5081 15.3666 10.1788 15.3666C7.81773 15.3666 5.81379 13.8402 5.09944 11.7305L4.99473 11.7392L2.23868 13.8295L2.20264 13.9277C3.67087 16.786 6.68674 18.75 10.1788 18.75Z"
                    fill="#34A853"
                  />

                  <path
                    d="M5.10014 11.7305C4.91165 11.186 4.80257 10.6027 4.80257 9.99992C4.80257 9.3971 4.91165 8.81379 5.09022 8.26935L5.08523 8.1534L2.29464 6.02954L2.20333 6.0721C1.5982 7.25823 1.25098 8.5902 1.25098 9.99992C1.25098 11.4096 1.5982 12.7415 2.20333 13.9277L5.10014 11.7305Z"
                    fill="#FBBC05"
                  />

                  <path
                    d="M10.1789 4.63331C11.8554 4.63331 12.9864 5.34303 13.6312 5.93612L16.1511 3.525C14.6035 2.11528 12.5895 1.25 10.1789 1.25C6.68676 1.25 3.67088 3.21387 2.20264 6.07218L5.08953 8.26943C5.81381 6.15972 7.81776 4.63331 10.1789 4.63331Z"
                    fill="#EB4335"
                  />
                </svg>
                Sign in with Google
              </button>
              <button className="inline-flex items-center justify-center gap-3 py-3 text-sm font-normal text-gray-700 transition-colors bg-gray-100 rounded-lg px-7 hover:bg-gray-200 hover:text-gray-800 dark:bg-white/5 dark:text-white/90 dark:hover:bg-white/10">
                <svg
                  width="21"
                  className="fill-current"
                  height="20"
                  viewBox="0 0 21 20"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path d="M15.6705 1.875H18.4272L12.4047 8.75833L19.4897 18.125H13.9422L9.59717 12.4442L4.62554 18.125H1.86721L8.30887 10.7625L1.51221 1.875H7.20054L11.128 7.0675L15.6705 1.875ZM14.703 16.475H16.2305L6.37054 3.43833H4.73137L14.703 16.475Z" />
                </svg>
                Sign in with X
              </button>
            </div> */}
            {/* <div className="relative py-3 sm:py-5">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-200 dark:border-gray-800"></div>
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="p-2 text-gray-400 bg-white dark:bg-gray-900 sm:px-5 sm:py-2">
                  Or
                </span>
              </div>
            </div> */}
            {requires2FA ? (
              <form onSubmit={handleVerify2FA}>
                <div className="space-y-6">
                  {error && <div className="p-3 text-sm text-red-500 bg-red-50 rounded-lg">{error}</div>}
                  <div>
                    <Label>
                      2-Step Verification Code <span className="text-error-500">*</span>{" "}
                    </Label>
                    <div className="flex justify-between gap-2 sm:gap-3">
                      {codeDigits.map((digit, index) => (
                        <input
                          key={index}
                          ref={(el) => (inputRefs.current[index] = el)}
                          type="text"
                          inputMode="numeric"
                          maxLength={1}
                          value={digit}
                          onChange={(e) => handleDigitChange(index, e.target.value)}
                          onKeyDown={(e) => handleKeyDown(index, e)}
                          onFocus={(e) => handleFocus(index, e)}
                          onPaste={index === 0 ? handlePaste : undefined}
                          className="w-10 h-12 sm:w-12 sm:h-14 text-center text-lg sm:text-xl font-bold rounded-lg border border-gray-200 bg-transparent text-gray-800 outline-none transition-colors focus:border-brand-500 focus:ring-1 focus:ring-brand-500 dark:border-gray-800 dark:text-white/90 dark:focus:border-brand-500"
                          required
                        />
                      ))}
                    </div>
                  </div>
                  <div>
                    <Button type="submit" className="w-full" size="sm" disabled={loading}>
                      {loading ? "Verifying..." : "Verify Code"}
                    </Button>
                  </div>
                  <div className="text-center">
                    <button 
                      type="button" 
                      onClick={() => setRequires2FA(false)} 
                      className="text-sm text-brand-500 hover:text-brand-600 dark:text-brand-400"
                    >
                      Back to login
                    </button>
                  </div>
                </div>
              </form>
            ) : (
              <form onSubmit={handleLogin}>
                <div className="space-y-6">
                  {error && <div className="p-3 text-sm text-red-500 bg-red-50 rounded-lg">{error}</div>}
                  <div>
                    <Label>
                      Email <span className="text-error-500">*</span>{" "}
                    </Label>
                    <Input 
                      placeholder="admin@example.com" 
                      type="email" 
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                    />
                  </div>
                  <div>
                    <Label>
                      Password <span className="text-error-500">*</span>{" "}
                    </Label>
                    <div className="relative">
                      <Input
                        type="password"
                        placeholder="Enter your password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                      />
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Checkbox checked={isChecked} onChange={setIsChecked} />
                      <span className="block font-normal text-gray-700 text-theme-sm dark:text-gray-400">
                        Keep me logged in
                      </span>
                    </div>
                    <Link
                      href="/reset-password"
                      className="text-sm text-brand-500 hover:text-brand-600 dark:text-brand-400"
                    >
                      Forgot password?
                    </Link>
                  </div>
                  <div>
                    <Button type="submit" className="w-full" size="sm" disabled={loading}>
                      {loading ? "Signing in..." : "Sign in"}
                    </Button>
                  </div>
                </div>
              </form>
            )}

          </div>
        </div>
      </div>
    </div>
  );
}
