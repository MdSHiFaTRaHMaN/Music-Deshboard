"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { useToast } from "@/components/ui/toast/Toast";

// Failed statuses from the real SunoAPI
const LYRICS_FAILED_STATUSES = ["CREATE_TASK_FAILED", "GENERATE_LYRICS_FAILED", "CALLBACK_EXCEPTION", "SENSITIVE_WORD_ERROR"];
const MUSIC_FAILED_STATUSES = ["CREATE_TASK_FAILED", "GENERATE_AUDIO_FAILED", "CALLBACK_EXCEPTION", "SENSITIVE_WORD_ERROR"];
// Music SUCCESS includes FIRST_SUCCESS (first track ready) and SUCCESS (all tracks ready)
const MUSIC_SUCCESS_STATUSES = ["FIRST_SUCCESS", "SUCCESS"];

// ---- Helper: Poll task status until SUCCESS or FAILED ----
async function pollStatus(taskId, type, onProgress) {
  return new Promise((resolve, reject) => {
    if (!taskId) {
      reject(new Error("No taskId returned from API"));
      return;
    }
    let attempts = 0;
    const maxAttempts = 300; // ~10 minutes max (music can take 2-5 min or more when busy)
    const interval = setInterval(async () => {
      attempts++;
      onProgress && onProgress(Math.min(90, attempts * 0.45));
      try {
        const res = await fetch(`/api/suno/status?taskId=${taskId}&type=${type}`);
        const data = await res.json();

        const failedSet = type === "lyrics" ? LYRICS_FAILED_STATUSES : MUSIC_FAILED_STATUSES;
        const successSet = type === "lyrics" ? ["SUCCESS"] : MUSIC_SUCCESS_STATUSES;

        if (successSet.includes(data.status)) {
          clearInterval(interval);
          onProgress && onProgress(100);
          resolve(data);
        } else if (data.failed || failedSet.includes(data.status) || attempts >= maxAttempts) {
          clearInterval(interval);
          reject(new Error(data.errorMessage || data.error || `Generation ${data.status || "timed out"}`));
        }
      } catch (err) {
        clearInterval(interval);
        reject(err);
      }
    }, 2000);
  });
}

export default function GenerateForm() {
  const showToast = useToast();
  const [currentStep, setCurrentStep] = useState(1);
  const totalSteps = 11;

  const [formData, setFormData] = useState({
    occasion: "", forWho: "specific", recipientName: "",
    creationMethod: "write_for_us", storyText: "", lyrics: "",
    email: "", genre: "", voice: "", mood: "",
    selectedDemo: "", selectedPackage: "digitaal",
    orderNotes: "", agreeTerms: false, taskId: ""
  });

  // API state
  const [lyricsLoading, setLyricsLoading] = useState(false);
  const [lyricsError, setLyricsError] = useState("");
  const [lyricsVariations, setLyricsVariations] = useState([]);
  const [selectedLyricsIndex, setSelectedLyricsIndex] = useState(null);
  
  // Audio finalization states
  const [isAudioReady, setIsAudioReady] = useState(true);
  const [backgroundPollingTaskId, setBackgroundPollingTaskId] = useState(null);

  // Background polling for final audioUrl and duration
  useEffect(() => {
    if (!backgroundPollingTaskId) return;

    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/suno/status?taskId=${backgroundPollingTaskId}&type=music`);
        const data = await res.json();
        if (data.isFullySaved) {
          setIsAudioReady(true);
          setBackgroundPollingTaskId(null);
          clearInterval(interval);
        }
      } catch (err) {
        console.error("Background polling error:", err);
      }
    }, 5000); // Check every 5 seconds

    return () => clearInterval(interval);
  }, [backgroundPollingTaskId]);

  const [musicTracks, setMusicTracks] = useState([]);
  const [generationProgress, setGenerationProgress] = useState(0);
  const [generationError, setGenerationError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Dynamic Options State
  const [optionsLoading, setOptionsLoading] = useState(true);
  const [options, setOptions] = useState({
    occasions: [],
    genres: [],
    voices: [],
    moods: [],
    packages: [],
  });

  useEffect(() => {
    const fetchOptions = async () => {
      try {
        const res = await fetch("/api/form-options");
        const json = await res.json();
        if (json.success && json.data) {
          setOptions(json.data);
          // Set default package if available
          if (json.data.packages && json.data.packages.length > 0) {
            setFormData(prev => ({ ...prev, selectedPackage: json.data.packages[0].id }));
          }
        }
      } catch (err) {
        console.error("Failed to load options", err);
      } finally {
        setOptionsLoading(false);
      }
    };
    fetchOptions();
  }, []);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({ ...prev, [name]: type === "checkbox" ? checked : value }));
  };

  const handlePillSelect = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  // ---- STEP 3: Generate lyrics from story via API ----
  const handleGenerateLyrics = async () => {
    if (!formData.storyText) return;
    setLyricsLoading(true);
    setLyricsError("");
    try {
      // SunoAPI lyrics prompt max is 200 characters
      const rawPrompt = `${formData.occasion} song for ${formData.forWho === "general" ? "someone special" : formData.recipientName}. ${formData.storyText}. ${formData.mood || "emotional"} ${formData.genre || "pop"} style.`;
      const prompt = rawPrompt.substring(0, 200);

      const res = await fetch("/api/suno/generate-lyrics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt }),
      });
      const data = await res.json();
      if (!res.ok || !data.taskId) throw new Error(data.error || "Failed to generate lyrics");

      // Poll for result
      const result = await pollStatus(data.taskId, "lyrics", null);
      if (result.allVariations && result.allVariations.length > 0) {
        setLyricsVariations(result.allVariations);
        setSelectedLyricsIndex(0); // Default to the first one
        setFormData(prev => ({ ...prev, lyrics: result.allVariations[0].text }));
      } else if (result.lyrics) {
        setFormData(prev => ({ ...prev, lyrics: result.lyrics }));
      } else {
        throw new Error("Lyrics generated but no text returned");
      }
    } catch (err) {
      setLyricsError(err.message);
    } finally {
      setLyricsLoading(false);
    }
  };

  // ---- STEP 7: Auto-generate music when step 7 is reached ----
  useEffect(() => {
    if (currentStep !== 7) return;
    setGenerationProgress(0);
    setGenerationError("");
    setMusicTracks([]);

    const generate = async () => {
      try {
        // style max 200 chars for V4, title max 80 chars
        const rawStyle = [formData.genre, formData.voice, formData.mood].filter(Boolean).join(", ");
        const style = rawStyle.substring(0, 200) || "Pop";
        const rawTitle = `${formData.occasion} song for ${formData.forWho === "general" ? "someone special" : formData.recipientName}`;
        const title = rawTitle.substring(0, 80);

        const res = await fetch("/api/suno/generate-music", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            lyrics: formData.lyrics || "[Verse]\nA beautiful song\n[Chorus]\nFull of love and joy",
            style,
            title,
            formData,
          }),
        });
        const data = await res.json();
        if (!res.ok || !data.taskId) throw new Error(data.error || "Failed to start music generation");

        setFormData(prev => ({ ...prev, taskId: data.taskId }));

        const result = await pollStatus(data.taskId, "music", setGenerationProgress);
        setMusicTracks(result.tracks || []);
        
        setIsAudioReady(result.isFullySaved);
        if (!result.isFullySaved) {
          setBackgroundPollingTaskId(data.taskId);
        }

        // Auto-advance to Step 8 when done
        setCurrentStep(8);
      } catch (err) {
        setGenerationError(err.message);
      }
    };

    generate();
  }, [currentStep]);

  const nextStep = async () => {
    if (currentStep === 1 && !formData.occasion) {
      showToast({ variant: "warning", title: "Required", message: "Please select an occasion." });
      return;
    }
    if (currentStep === 2 && formData.forWho === "specific" && !formData.recipientName) {
      showToast({ variant: "warning", title: "Required", message: "Please enter a recipient name." });
      return;
    }
    if (currentStep === 3 && formData.creationMethod === "write_for_us" && !formData.storyText) {
      showToast({ variant: "warning", title: "Required", message: "Please provide a story." });
      return;
    }
    if (currentStep === 3 && formData.creationMethod === "own_lyrics" && !formData.lyrics) {
      showToast({ variant: "warning", title: "Required", message: "Please paste your lyrics." });
      return;
    }
    if (currentStep === 5 && !formData.email) {
      showToast({ variant: "warning", title: "Required", message: "Please enter an email address." });
      return;
    }
    if (currentStep === 6 && (!formData.genre || !formData.voice || !formData.mood)) {
      showToast({ variant: "warning", title: "Required", message: "Please complete all music style selections." });
      return;
    }
    
    // Check if we are at the final step to submit to database
    if (currentStep === totalSteps) {
      if (!formData.agreeTerms) {
        showToast({ variant: "warning", title: "Required", message: "Please agree to the Terms and Conditions." });
        return;
      }
      
      setIsSubmitting(true);

      // Wait silently for audio to be fully ready if it isn't already
      if (!isAudioReady && formData.taskId) {
        let ready = false;
        let attempts = 0;
        while (!ready && attempts < 30) { // max 60 seconds
          await new Promise(resolve => setTimeout(resolve, 2000));
          attempts++;
          try {
            const res = await fetch(`/api/suno/status?taskId=${formData.taskId}&type=music`);
            const data = await res.json();
            if (data.isFullySaved) {
              ready = true;
            }
          } catch (e) {
            console.error("Silent polling error:", e);
          }
        }
      }

      try {
        const res = await fetch("/api/orders", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            formData,
            musicTracks,
            taskId: formData.taskId
          })
        });
        
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to save order");
        
        showToast({ variant: "success", title: "Order Placed!", message: "Order saved successfully. Redirecting to checkout..." });
        // window.location.href = "https://your-shopify-store.com/checkout";
      } catch (err) {
        showToast({ variant: "error", title: "Error", message: "Error saving order: " + err.message });
      } finally {
        setIsSubmitting(false);
      }
      return;
    }

    if (currentStep < totalSteps) setCurrentStep(currentStep + 1);
  };

  const prevStep = () => { if (currentStep > 1) setCurrentStep(currentStep - 1); };

  const progressPercentage = ((currentStep - 1) / (totalSteps - 1)) * 100;

  return (
    <div className="mx-auto max-w-4xl rounded-2xl border border-gray-200 bg-white p-5 shadow-theme-sm dark:border-gray-800 dark:bg-gray-dark lg:p-10">
      
      {/* Progress Bar */}
      {currentStep !== 7 && (
        <div className="mb-8">
          <div className="mb-2 flex items-center justify-between text-sm font-medium text-gray-500 dark:text-gray-400">
            <span>Step {currentStep} of {totalSteps}</span>
            <span>{Math.round(progressPercentage)}% Complete</span>
          </div>
          <div className="h-2.5 w-full rounded-full bg-gray-100 dark:bg-gray-800">
            <div className="h-2.5 rounded-full bg-brand-500 transition-all duration-300 ease-in-out" style={{ width: `${progressPercentage}%` }}></div>
          </div>
        </div>
      )}

      <div className="min-h-[400px]">

        {/* STEP 1: Occasion */}
        {currentStep === 1 && (
          <div className="animate-fade-in space-y-6">
            <div className="text-center">
              <h2 className="text-2xl font-bold text-gray-800 dark:text-white/90 sm:text-3xl">What&apos;s the occasion?</h2>
              <p className="mt-2 text-gray-500 dark:text-gray-400">Select the event or reason for your custom song.</p>
            </div>
            <div className="flex flex-wrap justify-center gap-3 pt-4">
              {optionsLoading ? (
                <div className="text-gray-500">Loading occasions...</div>
              ) : (
                options.occasions.map((occ) => (
                  <button key={occ} onClick={() => handlePillSelect("occasion", occ)}
                    className={`rounded-full border px-6 py-2.5 text-sm font-medium transition-all duration-200 ${formData.occasion === occ ? "border-brand-500 bg-brand-50 text-brand-500 dark:bg-brand-500/10 dark:text-brand-400" : "border-gray-200 text-gray-600 hover:border-brand-300 hover:bg-gray-50 dark:border-gray-800 dark:text-gray-300 dark:hover:border-gray-700 dark:hover:bg-white/5"}`}>
                    {occ}
                  </button>
                ))
              )}
            </div>
          </div>
        )}

        {/* STEP 2: For Whom */}
        {currentStep === 2 && (
          <div className="animate-fade-in space-y-6">
            <div className="text-center">
              <h2 className="text-2xl font-bold text-gray-800 dark:text-white/90 sm:text-3xl">Who is this song for?</h2>
              <p className="mt-2 text-gray-500 dark:text-gray-400">Enter the name(s) that should be in the song.</p>
            </div>
            <div className="mx-auto max-w-md space-y-5 pt-4">
              <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-gray-200 p-4 transition-colors hover:bg-gray-50 dark:border-gray-800 dark:hover:bg-white/5">
                <input type="checkbox" className="h-5 w-5 rounded border-gray-300 text-brand-500 focus:ring-brand-500"
                  checked={formData.forWho === "general"}
                  onChange={(e) => handlePillSelect("forWho", e.target.checked ? "general" : "specific")} />
                <span className="text-gray-700 dark:text-gray-300">General (not for a specific person)</span>
              </label>
              {formData.forWho !== "general" && (
                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">Name 1</label>
                  <input type="text" name="recipientName" value={formData.recipientName} onChange={handleChange}
                    placeholder="e.g. Lisa, Thomas, Sophie..." className="w-full rounded-xl border border-gray-200 bg-transparent px-4 py-3 text-gray-800 outline-none transition-colors focus:border-brand-500 focus:ring-1 focus:ring-brand-500 dark:border-gray-800 dark:text-white/90" />
                </div>
              )}
            </div>
          </div>
        )}

        {/* STEP 3: Creation Method & Story with AI Lyrics */}
        {currentStep === 3 && (
          <div className="animate-fade-in space-y-6">
            <div className="text-center">
              <h2 className="text-2xl font-bold text-gray-800 dark:text-white/90 sm:text-3xl">How do you want to create your song?</h2>
            </div>
            <div className="mx-auto max-w-2xl space-y-6 pt-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {["write_for_us", "own_lyrics"].map((method) => (
                  <button key={method} onClick={() => handlePillSelect("creationMethod", method)}
                    className={`flex flex-col items-center gap-2 rounded-2xl border p-6 text-center transition-all duration-200 ${formData.creationMethod === method ? "border-brand-500 bg-brand-50 dark:bg-brand-500/10" : "border-gray-200 hover:border-brand-300 dark:border-gray-800 dark:hover:border-gray-700"}`}>
                    <span className={`text-lg font-semibold ${formData.creationMethod === method ? "text-brand-500 dark:text-brand-400" : "text-gray-700 dark:text-gray-300"}`}>
                      {method === "write_for_us" ? "Let us write it" : "I already have lyrics"}
                    </span>
                    <span className="text-sm text-gray-500 dark:text-gray-400">
                      {method === "write_for_us" ? "Tell your story and our AI will make the lyrics." : "Paste your custom lyrics directly."}
                    </span>
                  </button>
                ))}
              </div>

              {formData.creationMethod === "write_for_us" ? (
                <div className="space-y-3">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">What makes this song special?</label>
                  <p className="text-xs text-gray-500">Include how you met, memories, nicknames, hobbies, character traits...</p>
                  <textarea name="storyText" value={formData.storyText} onChange={handleChange} rows={6}
                    placeholder="We met at a coffee shop in 2018. She loves hiking and reading..." className="w-full rounded-xl border border-gray-200 bg-transparent p-4 text-gray-800 outline-none transition-colors focus:border-brand-500 focus:ring-1 focus:ring-brand-500 dark:border-gray-800 dark:text-white/90" />

                  {/* AI Lyrics Generation Button */}
                  {lyricsVariations.length === 0 && !formData.lyrics && (
                    <button onClick={handleGenerateLyrics} disabled={lyricsLoading || !formData.storyText}
                      className="flex items-center gap-2 rounded-xl bg-brand-500 px-6 py-2.5 text-sm font-semibold text-white transition-all hover:bg-brand-600 disabled:opacity-60 disabled:cursor-not-allowed">
                      {lyricsLoading ? (
                        <><span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white"></span> Generating lyrics...</>
                      ) : (
                        <><span>✨</span> Generate AI Lyrics</>
                      )}
                    </button>
                  )}
                  {lyricsError && <p className="text-sm text-red-500">{lyricsError}</p>}

                  {lyricsVariations.length > 0 ? (
                    <div className="animate-fade-in space-y-4">
                      <label className="block text-sm font-medium text-green-600 dark:text-green-400">✓ Lyrics generated! Choose your favorite:</label>
                      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                        {lyricsVariations.map((variation, idx) => (
                          <div 
                            key={idx}
                            onClick={() => {
                              setSelectedLyricsIndex(idx);
                              setFormData(prev => ({ ...prev, lyrics: variation.text }));
                            }}
                            className={`cursor-pointer rounded-xl border p-4 transition-all duration-200 ${selectedLyricsIndex === idx ? "border-brand-500 bg-brand-50 dark:border-brand-400 dark:bg-brand-500/10" : "border-gray-200 bg-white hover:border-brand-300 dark:border-gray-800 dark:bg-gray-900"}`}
                          >
                            <h3 className="font-bold text-gray-800 dark:text-white mb-2">{variation.title || `Option ${idx + 1}`}</h3>
                            <div className="whitespace-pre-wrap text-sm text-gray-600 dark:text-gray-400 h-48 overflow-y-auto pr-2 custom-scrollbar">
                              {variation.text}
                            </div>
                            <div className="mt-3 flex justify-center">
                              {selectedLyricsIndex === idx ? (
                                <div className="rounded-full bg-brand-500 px-4 py-1 text-xs font-semibold text-white">✓ Selected</div>
                              ) : (
                                <div className="rounded-full border border-gray-300 px-4 py-1 text-xs font-semibold text-gray-500 transition-colors hover:border-brand-500 hover:text-brand-500 dark:border-gray-600 dark:text-gray-400">Select</div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                      <div className="mt-4">
                         <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">You can edit the selected lyrics below:</label>
                         <textarea name="lyrics" value={formData.lyrics} onChange={handleChange} rows={6}
                           className="w-full rounded-xl border border-gray-200 bg-transparent p-4 text-gray-800 outline-none transition-colors focus:border-brand-500 focus:ring-1 focus:ring-brand-500 dark:border-gray-800 dark:text-white/90" />
                      </div>
                      <div className="flex justify-center pt-2">
                        <button
                          onClick={handleGenerateLyrics}
                          disabled={lyricsLoading}
                          className="flex items-center gap-2 rounded-xl border border-gray-200 px-6 py-3 text-sm font-semibold text-gray-600 transition-all hover:bg-gray-50 disabled:opacity-60 disabled:cursor-not-allowed dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800">
                          {lyricsLoading ? (
                            <><span className="h-4 w-4 animate-spin rounded-full border-2 border-gray-300 border-t-gray-600 dark:border-gray-600 dark:border-t-gray-300"></span> Regenerating...</>
                          ) : (
                            <><svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                            Regenerate Lyrics</>
                          )}
                        </button>
                      </div>
                    </div>
                  ) : formData.lyrics && (
                    <div className="animate-fade-in space-y-2">
                      <label className="block text-sm font-medium text-green-600 dark:text-green-400">✓ Lyrics generated! You can edit them below:</label>
                      <textarea name="lyrics" value={formData.lyrics} onChange={handleChange} rows={8}
                        className="w-full rounded-xl border border-green-300 bg-transparent p-4 text-gray-800 outline-none transition-colors focus:border-brand-500 focus:ring-1 focus:ring-brand-500 dark:border-green-700 dark:text-white/90" />
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-3">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Paste your lyrics below</label>
                  <textarea name="lyrics" value={formData.lyrics} onChange={handleChange} rows={8}
                    placeholder={"Verse 1:\nYour lyrics here...\n\nChorus:\nThe chorus..."} className="w-full rounded-xl border border-gray-200 bg-transparent p-4 text-gray-800 outline-none transition-colors focus:border-brand-500 focus:ring-1 focus:ring-brand-500 dark:border-gray-800 dark:text-white/90" />
                </div>
              )}
            </div>
          </div>
        )}

        {/* STEP 4: Lyrics Review */}
        {currentStep === 4 && (
          <div className="animate-fade-in space-y-6">
            <div className="text-center">
              <h2 className="text-2xl font-bold text-gray-800 dark:text-white/90 sm:text-3xl">Review your lyrics</h2>
              <p className="mt-2 text-gray-500 dark:text-gray-400">Make any final edits before we compose your song.</p>
            </div>
            <div className="mx-auto max-w-2xl pt-4">
              <textarea name="lyrics" value={formData.lyrics} onChange={handleChange} rows={10}
                className="w-full rounded-xl border border-gray-200 bg-transparent p-4 text-gray-800 outline-none transition-colors focus:border-brand-500 focus:ring-1 focus:ring-brand-500 dark:border-gray-800 dark:text-white/90" />
              <p className="mt-2 text-xs text-gray-500">You can edit the lyrics directly above!</p>
            </div>
          </div>
        )}

        {/* STEP 5: Email */}
        {currentStep === 5 && (
          <div className="animate-fade-in space-y-6">
            <div className="text-center">
              <h2 className="text-2xl font-bold text-gray-800 dark:text-white/90 sm:text-3xl">Where should we send it?</h2>
            </div>
            <div className="mx-auto max-w-md pt-8">
              <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">Your Email Address</label>
              <input type="email" name="email" value={formData.email} onChange={handleChange} placeholder="you@email.com"
                className="w-full rounded-xl border border-gray-200 bg-transparent px-4 py-3 text-gray-800 outline-none transition-colors focus:border-brand-500 focus:ring-1 focus:ring-brand-500 dark:border-gray-800 dark:text-white/90" />
            </div>
          </div>
        )}

        {/* STEP 6: Music Style */}
        {currentStep === 6 && (
          <div className="animate-fade-in space-y-8">
            <div className="text-center">
              <h2 className="text-2xl font-bold text-gray-800 dark:text-white/90 sm:text-3xl">Choose your style</h2>
              <p className="mt-2 text-gray-500 dark:text-gray-400">Pick the genre, voice, and mood for your song.</p>
            </div>
            <div className="space-y-6">
              {optionsLoading ? (
                <div className="text-gray-500 text-center">Loading style options...</div>
              ) : (
                [
                  { label: "Genre", field: "genre", optionsList: options.genres },
                  { label: "Voice", field: "voice", optionsList: options.voices },
                  { label: "Mood", field: "mood", optionsList: options.moods },
                ].map(({ label, field, optionsList }) => (
                  <div key={field}>
                    <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">{label}</h3>
                    <div className="flex flex-wrap gap-2">
                      {optionsList.map((opt) => (
                        <button key={opt} onClick={() => handlePillSelect(field, opt)}
                          className={`rounded-full border px-4 py-2 text-sm font-medium transition-all duration-200 ${formData[field] === opt ? "border-brand-500 bg-brand-50 text-brand-500 dark:bg-brand-500/10 dark:text-brand-400" : "border-gray-200 text-gray-600 hover:border-brand-300 dark:border-gray-800 dark:text-gray-300"}`}>
                          {opt}
                        </button>
                      ))}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* STEP 7: Generating Music (auto-triggered) */}
        {currentStep === 7 && (
          <div className="flex flex-col items-center justify-center space-y-6 py-20 text-center">
            {generationError ? (
              <div className="space-y-4">
                <div className="text-5xl">❌</div>
                <h2 className="text-2xl font-bold text-gray-800 dark:text-white/90">Generation Failed</h2>
                <p className="text-red-500">{generationError}</p>
                <button onClick={() => setCurrentStep(6)} className="rounded-xl border border-gray-200 px-6 py-3 font-semibold text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800">
                  Go Back & Try Again
                </button>
              </div>
            ) : (
              <>
                <div className="relative h-24 w-24">
                  <div className="absolute inset-0 rounded-full border-4 border-gray-100 dark:border-gray-800"></div>
                  <div className="absolute inset-0 animate-spin rounded-full border-4 border-brand-500 border-t-transparent"></div>
                </div>
                <h2 className="text-3xl font-bold text-gray-800 dark:text-white/90">Composing your melody...</h2>
                <p className="text-lg text-gray-500 dark:text-gray-400">We are generating two unique versions of your song. This may take 20-60 seconds.</p>
                <div className="mt-6 w-full max-w-md overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
                  <div className="h-2 bg-brand-500 transition-all duration-300 ease-out" style={{ width: `${generationProgress}%` }}></div>
                </div>
                <p className="text-sm font-medium text-brand-500">{Math.round(generationProgress)}%</p>
              </>
            )}
          </div>
        )}

        {/* STEP 8: Listen to Demos */}
        {currentStep === 8 && (
          <div className="animate-fade-in space-y-8">
            <div className="text-center">
              <h2 className="text-2xl font-bold text-gray-800 dark:text-white/90 sm:text-3xl">Listen to your songs</h2>
              <p className="mt-2 text-gray-500 dark:text-gray-400">We&apos;ve generated {musicTracks.length || 2} versions. Pick your favorite!</p>
            </div>

            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              {(musicTracks.length > 0 ? musicTracks : [{ id: "demo1", title: "Unique Song 1" }, { id: "demo2", title: "Unique Song 2" }]).map((track, idx) => (
                <div key={track.id}
                  onClick={() => handlePillSelect("selectedDemo", track.id)}
                  className={`relative cursor-pointer rounded-2xl border p-6 text-center transition-all duration-300 ${formData.selectedDemo === track.id ? "border-brand-500 bg-brand-50 shadow-theme-sm dark:border-brand-400 dark:bg-brand-500/10" : "border-gray-200 bg-white hover:border-brand-300 hover:shadow-theme-sm dark:border-gray-800 dark:bg-gray-900"}`}>

                  {/* Absolute Selected Button */}
                  <div className="absolute top-4 right-4 z-10">
                    {formData.selectedDemo === track.id ? (
                      <div className="flex items-center gap-1 rounded-full bg-brand-500 px-3 py-1.5 text-xs font-bold text-white shadow-md">
                        ✓ Selected
                      </div>
                    ) : (
                      <div className="rounded-full border border-gray-300 bg-white/80 px-3 py-1.5 text-xs font-semibold text-gray-500 shadow-sm transition-all hover:border-brand-500 hover:text-brand-500 dark:border-gray-600 dark:bg-gray-800/80 dark:text-gray-400">
                        Select
                      </div>
                    )}
                  </div>

                  {/* Album Art */}
                  {track.imageUrl ? (
                    <div className="relative mx-auto mb-4 h-40 w-40 overflow-hidden rounded-2xl shadow-theme-md">
                      <img
                        src={track.imageUrl}
                        alt={track.title || `Song ${idx + 1}`}
                        className="h-full w-full object-cover"
                        onError={(e) => { e.target.style.display = "none"; }}
                      />
                      {formData.selectedDemo === track.id && (
                        <div className="absolute inset-0 flex items-center justify-center bg-brand-500/30 backdrop-blur-sm">
                          <span className="text-3xl">✓</span>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="mx-auto mb-4 flex h-40 w-40 items-center justify-center rounded-2xl bg-brand-50 dark:bg-brand-500/10">
                      <svg className="h-16 w-16 text-brand-300" fill="currentColor" viewBox="0 0 24 24"><path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z" /></svg>
                    </div>
                  )}

                  <h3 className="text-lg font-bold text-gray-900 dark:text-white">{track.title || `Version ${idx + 1}`}</h3>

                  {track.duration && (
                    <p className="mt-1 text-xs text-gray-400">{Math.floor(track.duration / 60)}:{String(Math.floor(track.duration % 60)).padStart(2, "0")} min</p>
                  )}

                  {/* Secure audio player — uses streamAudioUrl which cannot be downloaded */}
                  {track.streamAudioUrl ? (
                    <div className="mt-4" onClick={(e) => e.stopPropagation()}>
                      <audio
                        controls
                        controlsList="nodownload"
                        className="w-full"
                        style={{ colorScheme: "light" }}
                        onPlay={(e) => {
                          // Pause all other audio elements on the page
                          const audios = document.querySelectorAll("audio");
                          audios.forEach(audio => {
                            if (audio !== e.target) {
                              audio.pause();
                            }
                          });
                        }}
                      >
                        <source src={track.streamAudioUrl} type="audio/mpeg" />
                        Your browser does not support audio.
                      </audio>
                    </div>
                  ) : (
                    <div className="mx-auto my-4 flex h-12 w-12 items-center justify-center rounded-full bg-brand-100 text-brand-500 dark:bg-brand-500/20">
                      <svg className="h-6 w-6 ml-1" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Regenerate Button */}
            <div className="flex justify-center pt-2">
              <button
                onClick={() => {
                  setMusicTracks([]);
                  setGenerationError("");
                  setCurrentStep(7);
                }}
                className="flex items-center gap-2 rounded-xl border border-gray-200 px-6 py-3 text-sm font-semibold text-gray-600 transition-all hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800">
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                Regenerate Songs
              </button>
            </div>
          </div>
        )}

        {/* STEP 9: Choose Package */}
        {currentStep === 9 && (
          <div className="animate-fade-in space-y-8">
            <div className="text-center">
              <h2 className="text-2xl font-bold text-gray-800 dark:text-white/90 sm:text-3xl">Choose Your Package</h2>
            </div>
            <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
              {optionsLoading ? (
                <div className="text-gray-500 text-center col-span-3">Loading packages...</div>
              ) : (
                options.packages.map((pkg) => (
                  <div key={pkg.id} onClick={() => handlePillSelect("selectedPackage", pkg.id)}
                    className={`relative flex cursor-pointer flex-col overflow-hidden rounded-2xl border transition-all duration-300 hover:shadow-theme-md ${formData.selectedPackage === pkg.id ? "border-brand-500 bg-brand-50/50 shadow-theme-md dark:border-brand-400 dark:bg-brand-500/5" : "border-gray-200 bg-gray-50 dark:border-gray-800 dark:bg-white/[0.02]"}`}>
                    {pkg.tagline && (
                      <div className="absolute top-0 left-1/2 flex w-full -translate-x-1/2 justify-center">
                        <span className="rounded-b-lg bg-brand-500 px-4 py-1 text-xs font-semibold tracking-wider text-white shadow-sm">{pkg.tagline}</span>
                      </div>
                    )}
                    <div className="flex flex-col items-center p-6 pt-10">
                      <h3 className="text-xl font-bold text-gray-900 dark:text-white">{pkg.title}</h3>
                      <div className="mt-2 text-3xl font-extrabold text-brand-500">{pkg.price}</div>
                      <div className="mt-4"><img src={pkg.image} alt={pkg.title} className="h-40 w-40 rounded-xl object-cover shadow-sm" /></div>
                      <div className="mt-6 w-full space-y-3">
                        <div className="rounded-lg bg-white p-3 text-center text-sm font-medium text-gray-700 shadow-sm dark:bg-gray-800 dark:text-gray-300">📦 What&apos;s included?</div>
                        <ul className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
                          {pkg.features.map((f, i) => <li key={i} className="flex items-center gap-2"><span className="text-brand-500">✓</span> {f}</li>)}
                        </ul>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* STEP 10: Extra Options */}
        {currentStep === 10 && (
          <div className="animate-fade-in space-y-6">
            <div className="text-center">
              <h2 className="text-2xl font-bold text-gray-800 dark:text-white/90 sm:text-3xl">Extra Options</h2>
              <p className="mt-2 text-gray-500 dark:text-gray-400">Any final notes for your order?</p>
            </div>
            <div className="mx-auto max-w-2xl pt-4">
              <textarea name="orderNotes" value={formData.orderNotes} onChange={handleChange} rows={4}
                placeholder="Special instructions for delivery, or any other remarks..."
                className="w-full rounded-xl border border-gray-200 bg-transparent p-4 text-gray-800 outline-none transition-colors focus:border-brand-500 focus:ring-1 focus:ring-brand-500 dark:border-gray-800 dark:text-white/90" />
            </div>
          </div>
        )}

        {/* STEP 11: Confirm Order */}
        {currentStep === 11 && (
          <div className="animate-fade-in space-y-8">
            <div className="text-center">
              <h2 className="text-2xl font-bold text-gray-800 dark:text-white/90 sm:text-3xl">Confirm your order</h2>
              <p className="mt-2 text-gray-500 dark:text-gray-400">Review your choices and proceed to checkout.</p>
            </div>
            <div className="mx-auto max-w-xl rounded-2xl border border-gray-200 bg-gray-50 p-6 dark:border-gray-800 dark:bg-gray-900/50">
              <h3 className="mb-4 text-lg font-bold text-gray-800 dark:text-white">Order Summary</h3>
              <ul className="space-y-3 text-sm text-gray-600 dark:text-gray-400">
                {[
                  ["Occasion", formData.occasion],
                  ["Recipient", formData.forWho === "general" ? "General" : formData.recipientName],
                  ["Music Style", [formData.genre, formData.voice, formData.mood].filter(Boolean).join(" • ")],
                  ["Package", formData.selectedPackage?.toUpperCase()],
                  ["Email", formData.email],
                ].map(([label, value]) => (
                  <li key={label} className={`flex justify-between border-b border-gray-200 pb-2 dark:border-gray-800 ${label === "Email" ? "border-none pb-0" : ""}`}>
                    <span>{label}:</span>
                    <span className="font-medium text-gray-900 dark:text-gray-200">{value || "—"}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-8">
                <label className="flex cursor-pointer items-start gap-3">
                  <input type="checkbox" name="agreeTerms" checked={formData.agreeTerms} onChange={handleChange}
                    className="mt-1 h-5 w-5 rounded border-gray-300 text-brand-500 focus:ring-brand-500" />
                  <span className="text-sm text-gray-600 dark:text-gray-400">
                    I agree to the Terms and Conditions and understand that custom generated songs cannot be refunded.
                  </span>
                </label>
              </div>
            </div>
          </div>
        )}

      </div>

      {/* Navigation Buttons */}
      {currentStep !== 7 && (
        <div className="mt-10 flex items-center justify-between border-t border-gray-100 pt-6 dark:border-gray-800">
          <button onClick={prevStep} disabled={currentStep === 1}
            className={`rounded-xl px-6 py-3 font-semibold transition-all duration-200 ${currentStep === 1 ? "invisible" : "border border-gray-200 text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"}`}>
            Back
          </button>

          {currentStep < totalSteps ? (
            <button onClick={nextStep} className="rounded-xl bg-brand-500 px-8 py-3 font-semibold text-white shadow-sm transition-all duration-200 hover:bg-brand-600 hover:shadow-theme-md active:scale-95">
              Next Step
            </button>
          ) : (
            <button onClick={nextStep} disabled={isSubmitting} className="flex items-center gap-2 rounded-xl bg-green-500 px-8 py-3 font-semibold text-white shadow-sm transition-all duration-200 hover:bg-green-600 hover:shadow-theme-md active:scale-95 disabled:opacity-70 disabled:cursor-not-allowed">
              {isSubmitting ? (
                 <><span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white"></span> Processing...</>
              ) : "Checkout & Pay"}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
