"use client";
import React, { useState, useRef } from "react";
import { useModal } from "../../hooks/useModal";
import { Modal } from "../ui/modal";
import Button from "../ui/button/Button";
import Input from "../form/input/InputField";
import Label from "../form/Label";
import { useUser } from "@/context/UserContext";

export default function UserSecurityCard() {
  const { user, fetchUser, loading: userLoading } = useUser();
  const { isOpen: isSecurityOpen, openModal: openSecurity, closeModal: closeSecurity } = useModal();
  const { isOpen: is2FAOpen, openModal: open2FA, closeModal: close2FA } = useModal();

  // Security Update State
  const [securityData, setSecurityData] = useState({
    currentPassword: "",
    newEmail: "",
    newPassword: "",
  });
  const [securityLoading, setSecurityLoading] = useState(false);
  const [securityMessage, setSecurityMessage] = useState({ type: "", text: "" });

  // 2FA Setup State
  const [twoFactorStep, setTwoFactorStep] = useState(1);
  const [qrCodeUrl, setQrCodeUrl] = useState("");
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
  const [twoFactorLoading, setTwoFactorLoading] = useState(false);
  const [twoFactorMessage, setTwoFactorMessage] = useState({ type: "", text: "" });
  const [disablePassword, setDisablePassword] = useState("");

  const handleSecurityChange = (e) => {
    setSecurityData({ ...securityData, [e.target.name]: e.target.value });
  };

  const handleSecuritySubmit = async (e) => {
    e.preventDefault();
    setSecurityLoading(true);
    setSecurityMessage({ type: "", text: "" });

    try {
      const res = await fetch("/api/users/security", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(securityData),
      });
      const data = await res.json();
      if (res.ok) {
        setSecurityMessage({ type: "success", text: "Security settings updated successfully!" });
        setSecurityData({ currentPassword: "", newEmail: "", newPassword: "" });
        await fetchUser();
        setTimeout(closeSecurity, 1500);
      } else {
        setSecurityMessage({ type: "error", text: data.error || "Update failed" });
      }
    } catch (err) {
      setSecurityMessage({ type: "error", text: "An unexpected error occurred" });
    } finally {
      setSecurityLoading(false);
    }
  };

  const start2FASetup = async () => {
    setTwoFactorLoading(true);
    setTwoFactorMessage({ type: "", text: "" });
    try {
      const res = await fetch("/api/auth/2fa/generate", { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        setQrCodeUrl(data.qrCodeUrl);
        setTwoFactorStep(2);
      } else {
        setTwoFactorMessage({ type: "error", text: data.error || "Failed to generate 2FA" });
      }
    } catch (err) {
      setTwoFactorMessage({ type: "error", text: "An unexpected error occurred" });
    } finally {
      setTwoFactorLoading(false);
    }
  };

  const verify2FASetup = async (e) => {
    e.preventDefault();
    setTwoFactorLoading(true);
    setTwoFactorMessage({ type: "", text: "" });
    try {
      const res = await fetch("/api/auth/2fa/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: twoFactorCode }),
      });
      const data = await res.json();
      if (res.ok) {
        setTwoFactorMessage({ type: "success", text: "2FA Enabled Successfully!" });
        await fetchUser();
        setTimeout(() => {
          close2FA();
          setTwoFactorStep(1);
          setTwoFactorCode("");
        }, 1500);
      } else {
        setTwoFactorMessage({ type: "error", text: data.error || "Invalid code" });
      }
    } catch (err) {
      setTwoFactorMessage({ type: "error", text: "An unexpected error occurred" });
    } finally {
      setTwoFactorLoading(false);
    }
  };

  const disable2FA = async (e) => {
    e.preventDefault();
    setTwoFactorLoading(true);
    setTwoFactorMessage({ type: "", text: "" });
    try {
      const res = await fetch("/api/auth/2fa/disable", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: disablePassword }),
      });
      const data = await res.json();
      if (res.ok) {
        setTwoFactorMessage({ type: "success", text: "2FA Disabled Successfully!" });
        await fetchUser();
        setTimeout(() => {
          close2FA();
          setDisablePassword("");
        }, 1500);
      } else {
        setTwoFactorMessage({ type: "error", text: data.error || "Failed to disable" });
      }
    } catch (err) {
      setTwoFactorMessage({ type: "error", text: "An unexpected error occurred" });
    } finally {
      setTwoFactorLoading(false);
    }
  };

  const open2FAModal = () => {
    setTwoFactorMessage({ type: "", text: "" });
    setTwoFactorStep(1);
    open2FA();
  };

  if (userLoading) {
    return <div className="p-5 border border-gray-200 rounded-2xl dark:border-gray-800 lg:p-6 animate-pulse bg-gray-100 dark:bg-gray-800/50 h-[300px]"></div>;
  }
  if (!user) return null;

  return (
    <div className="p-5 border border-gray-200 rounded-2xl dark:border-gray-800 lg:p-6 mt-6">
      <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex-1">
          <h4 className="text-lg font-semibold text-gray-800 dark:text-white/90 lg:mb-6">
            Security Settings
          </h4>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 lg:gap-7 2xl:gap-x-32">
            <div>
              <p className="mb-2 text-xs leading-normal text-gray-500 dark:text-gray-400">
                Password
              </p>
              <p className="text-sm font-medium text-gray-800 dark:text-white/90">
                ••••••••
              </p>
            </div>

            <div>
              <p className="mb-2 text-xs leading-normal text-gray-500 dark:text-gray-400">
                Two-Factor Authentication (2FA)
              </p>
              <p className="text-sm font-medium text-gray-800 dark:text-white/90">
                {user.isTwoFactorEnabled ? (
                  <span className="text-green-500 font-semibold">Enabled</span>
                ) : (
                  <span className="text-gray-500">Disabled</span>
                )}
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-3">
          <button
            onClick={openSecurity}
            className="flex w-full items-center justify-center gap-2 rounded-full border border-gray-300 bg-white px-4 py-3 text-sm font-medium text-gray-700 shadow-theme-xs hover:bg-gray-50 hover:text-gray-800 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-white/[0.03] dark:hover:text-gray-200 lg:inline-flex lg:w-auto"
          >
            Update Password / Email
          </button>
          
          <button
            onClick={open2FAModal}
            className={`flex w-full items-center justify-center gap-2 rounded-full border px-4 py-3 text-sm font-medium shadow-theme-xs lg:inline-flex lg:w-auto ${
              user.isTwoFactorEnabled 
                ? "border-red-200 bg-red-50 text-red-700 hover:bg-red-100 dark:border-red-800 dark:bg-red-900/30 dark:text-red-400 dark:hover:bg-red-900/50"
                : "border-brand-500 bg-brand-500 text-white hover:bg-brand-600 dark:border-brand-500 dark:bg-brand-500 dark:hover:bg-brand-600"
            }`}
          >
            {user.isTwoFactorEnabled ? "Disable 2FA" : "Enable 2FA"}
          </button>
        </div>
      </div>

      {/* Security Update Modal */}
      <Modal isOpen={isSecurityOpen} onClose={closeSecurity} className="max-w-[600px] m-4">
        <div className="relative w-full max-w-[600px] rounded-3xl bg-white p-4 dark:bg-gray-900 lg:p-11">
          <div className="px-2 pr-14 mb-6">
            <h4 className="mb-2 text-2xl font-semibold text-gray-800 dark:text-white/90">
              Update Security Details
            </h4>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Change your email address or password. You must enter your current password to save changes.
            </p>
          </div>
          
          <form className="flex flex-col px-2" onSubmit={handleSecuritySubmit}>
            {securityMessage.text && (
              <div className={`p-3 mb-4 text-sm rounded-lg ${securityMessage.type === "success" ? "bg-green-50 text-green-600" : "bg-red-50 text-red-500"}`}>
                {securityMessage.text}
              </div>
            )}
            
            <div className="space-y-5">
              <div>
                <Label>New Email Address (Optional)</Label>
                <Input 
                  type="email" 
                  name="newEmail" 
                  value={securityData.newEmail} 
                  onChange={handleSecurityChange} 
                  placeholder={user.email}
                />
              </div>

              <div>
                <Label>New Password (Optional)</Label>
                <Input 
                  type="password" 
                  name="newPassword" 
                  value={securityData.newPassword} 
                  onChange={handleSecurityChange} 
                  placeholder="Enter a new password"
                />
              </div>

              <div className="pt-4 border-t border-gray-200 dark:border-gray-800">
                <Label>Current Password <span className="text-red-500">*</span></Label>
                <Input 
                  type="password" 
                  name="currentPassword" 
                  value={securityData.currentPassword} 
                  onChange={handleSecurityChange} 
                  required 
                  placeholder="Required to save changes"
                />
              </div>
            </div>
            
            <div className="flex items-center gap-3 mt-8 justify-end">
              <Button type="button" size="sm" variant="outline" onClick={closeSecurity} disabled={securityLoading}>
                Cancel
              </Button>
              <Button type="submit" size="sm" disabled={securityLoading}>
                {securityLoading ? "Saving..." : "Save Security Changes"}
              </Button>
            </div>
          </form>
        </div>
      </Modal>

      {/* 2FA Setup/Disable Modal */}
      <Modal isOpen={is2FAOpen} onClose={close2FA} className="max-w-[500px] m-4">
        <div className="relative w-full max-w-[500px] rounded-3xl bg-white p-6 dark:bg-gray-900 lg:p-8">
          <div className="mb-6">
            <h4 className="mb-2 text-xl font-semibold text-gray-800 dark:text-white/90">
              {user.isTwoFactorEnabled ? "Disable 2-Step Verification" : "Enable 2-Step Verification"}
            </h4>
          </div>

          {twoFactorMessage.text && (
            <div className={`p-3 mb-4 text-sm rounded-lg ${twoFactorMessage.type === "success" ? "bg-green-50 text-green-600" : "bg-red-50 text-red-500"}`}>
              {twoFactorMessage.text}
            </div>
          )}

          {user.isTwoFactorEnabled ? (
            <form onSubmit={disable2FA} className="space-y-5">
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Enter your password to disable two-factor authentication.
              </p>
              <div>
                <Label>Password</Label>
                <Input 
                  type="password" 
                  value={disablePassword} 
                  onChange={(e) => setDisablePassword(e.target.value)} 
                  required 
                  placeholder="Your current password"
                />
              </div>
              <div className="flex justify-end gap-3 mt-6">
                <Button type="button" size="sm" variant="outline" onClick={close2FA} disabled={twoFactorLoading}>
                  Cancel
                </Button>
                <Button type="submit" size="sm" disabled={twoFactorLoading} className="bg-red-500 hover:bg-red-600 border-red-500">
                  {twoFactorLoading ? "Disabling..." : "Disable 2FA"}
                </Button>
              </div>
            </form>
          ) : (
            <div>
              {twoFactorStep === 1 && (
                <div className="space-y-4">
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Two-factor authentication adds an extra layer of security to your account. You&apos;ll need an authenticator app (like Google Authenticator or Authy) to scan a QR code.
                  </p>
                  <div className="flex justify-end gap-3 mt-6">
                    <Button type="button" size="sm" variant="outline" onClick={close2FA} disabled={twoFactorLoading}>
                      Cancel
                    </Button>
                    <Button type="button" size="sm" onClick={start2FASetup} disabled={twoFactorLoading}>
                      {twoFactorLoading ? "Generating..." : "Get Started"}
                    </Button>
                  </div>
                </div>
              )}
              
              {twoFactorStep === 2 && (
                <form onSubmit={verify2FASetup} className="space-y-5">
                  <p className="text-sm text-gray-600 dark:text-gray-400 text-center">
                    Scan this QR code with your authenticator app.
                  </p>
                  
                  {qrCodeUrl && (
                    <div className="flex justify-center my-4 bg-white p-4 rounded-xl shadow-sm border mx-auto w-fit">
                      <img src={qrCodeUrl} alt="2FA QR Code" className="w-48 h-48" />
                    </div>
                  )}

                  <div>
                    <Label>Verification Code</Label>
                    <div className="flex justify-between gap-2 sm:gap-3 mt-1">
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
                  
                  <div className="flex justify-end gap-3 mt-6">
                    <Button type="button" size="sm" variant="outline" onClick={close2FA} disabled={twoFactorLoading}>
                      Cancel
                    </Button>
                    <Button type="submit" size="sm" disabled={twoFactorLoading}>
                      {twoFactorLoading ? "Verifying..." : "Verify & Enable"}
                    </Button>
                  </div>
                </form>
              )}
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
}
