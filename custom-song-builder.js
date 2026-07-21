/* Custom Song Builder — vanilla JS controller
   Replicates the React GenerateForm component's logic without a framework.
   One instance is created per section (supports multiple sections / theme editor reloads).
*/
(function () {
  "use strict";

  var LYRICS_FAILED_STATUSES = ["CREATE_TASK_FAILED", "GENERATE_LYRICS_FAILED", "GENERATE_LYRIC_FAILED", "CALLBACK_EXCEPTION", "SENSITIVE_WORD_ERROR"];
  var MUSIC_FAILED_STATUSES = ["CREATE_TASK_FAILED", "GENERATE_AUDIO_FAILED", "CALLBACK_EXCEPTION", "SENSITIVE_WORD_ERROR"];
  var MUSIC_SUCCESS_STATUSES = ["FIRST_SUCCESS", "SUCCESS"];
  var TOTAL_STEPS = 10;

  function initSection(root) {
    var backendUrl = (root.getAttribute("data-backend-url") || "").replace(/\/$/, "");
    var productId = root.getAttribute("data-product-id") || "";
    var variantId = root.getAttribute("data-variant-id") || "";
    var productHandle = root.getAttribute("data-product-handle") || "";
    var sectionId = root.getAttribute("data-section-id") || "";

    function apiUrl(path) {
      return backendUrl + path;
    }

    // ---- State ----
    var turnstileToken = "";
    var visitorId = "";

    window.onTurnstileSuccess = function(token) {
      turnstileToken = token;
    };

    function initFingerprint() {
      var script = document.createElement("script");
      script.src = "https://openfpcdn.io/fingerprintjs/v4";
      script.async = true;
      script.onload = function() {
        if (window.FingerprintJS) {
          window.FingerprintJS.load().then(function(fp) {
            fp.get().then(function(result) {
              visitorId = result.visitorId;
            });
          });
        }
      };
      document.head.appendChild(script);
    }

    if (window.requestIdleCallback) {
      requestIdleCallback(initFingerprint);
    } else {
      setTimeout(initFingerprint, 500);
    }

    var state = {
      currentStep: 1,
      occasion: "",
      occasionIsOther: false,
      customOccasion: "",
      recipients: [{ name: "", pronunciationMode: "Original", pronunciation: "" }],
      creationMethod: "write_for_us",
      storyText: "",
      lyricsLanguage: "English",
      lyrics: "",
      email: "",
      genre: "",
      voice: "",
      mood: "",
      selectedDemo: "",
      selectedPackage: "",
      rushOrder: true,
      agreeTerms: false,
      taskId: ""
    };

    var lyricsVariations = [];
    var selectedLyricsIndex = null;
    var lyricsLoading = false;
    var lyricsError = "";

    var isAudioReady = true;
    var backgroundPollingTaskId = null;
    var backgroundPollTimer = null;

    var musicTracks = [];
    var generationProgress = 0;
    var generationError = "";
    var generationErrorIsTimeout = false;
    var isSubmitting = false;

    // ---- Persistence (survives tab close / page reload) ----
    // Keyed per-product so different product pages don't clash. Saved
    // progress older than STORAGE_MAX_AGE_MS is treated as stale and ignored
    // (audio/lyrics links returned by the backend won't live forever).
    var STORAGE_KEY = "csb_wizard_" + (productId || productHandle || "default") + "_" + sectionId;
    var STORAGE_MAX_AGE_MS = 24 * 60 * 60 * 1000; // 24 hours
    var pendingLyricsTaskId = null; // in-flight lyrics generation task, kept so a reload can resume polling it

    var optionsLoading = true;
    var options = { occasions: [], genres: [], voices: [], moods: [], packages: [] };

    // Package id -> { productId, variantId }, built from the shopifyProductId /
    // shopifyVariantId fields on each package returned by /api/form-options.
    // Lets a selected package add its OWN Shopify product to the cart instead
    // of always reusing this section's product/variant.
    var packageProductMap = {};

    // ---- DOM refs ----
    var $ = function (sel) { return root.querySelector(sel); };
    var $$ = function (sel) { return root.querySelectorAll(sel); };

    var stepLabel = $("[data-csb-step-label]");
    var percentLabel = $("[data-csb-percent-label]");
    var progressFill = $("[data-csb-progress-fill]");
    var progressWrap = $("[data-csb-progress-wrap]");
    var navWrap = $("[data-csb-nav]");
    var backBtn = $("[data-csb-back]");
    var nextBtn = $("[data-csb-next]");
    var checkoutBtn = $("[data-csb-checkout]");
    var checkoutSpinner = $("[data-csb-checkout-spinner]");
    var checkoutLabel = $("[data-csb-checkout-label]");

    function showToast(opts) {
      // Minimal built-in toast. Replace with theme's own notification system if available.
      var existing = root.querySelector(".csb-toast");
      if (existing) existing.remove();
      var el = document.createElement("div");
      el.className = "csb-toast csb-toast-" + (opts.variant || "info");
      el.style.position = "fixed";
      el.style.bottom = "1.5rem";
      el.style.right = "1.5rem";
      el.style.zIndex = "9999";
      el.style.maxWidth = "320px";
      el.style.padding = "0.875rem 1.125rem";
      el.style.borderRadius = "0.75rem";
      el.style.boxShadow = "0 4px 12px rgba(0,0,0,0.15)";
      el.style.fontSize = "0.875rem";
      el.style.color = "#fff";
      el.style.background =
        opts.variant === "error" ? "#f04438" :
          opts.variant === "warning" ? "#f79009" :
            opts.variant === "success" ? "#12b76a" : "#475467";
      el.innerHTML = "<strong>" + (opts.title || "") + "</strong><div>" + (opts.message || "") + "</div>";
      document.body.appendChild(el);
      setTimeout(function () { el.remove(); }, 4000);
    }

    // ---- Persistence helpers ----
    // Saves everything needed to put the user back exactly where they left
    // off: which step they're on, every answer so far, generated lyrics
    // variations, generated music tracks, and any in-flight generation task
    // so it can be resumed after a reload/tab close instead of restarting.
    function saveProgress() {
      try {
        var payload = {
          savedAt: Date.now(),
          state: state,
          lyricsVariations: lyricsVariations,
          selectedLyricsIndex: selectedLyricsIndex,
          musicTracks: musicTracks,
          isAudioReady: isAudioReady,
          backgroundPollingTaskId: backgroundPollingTaskId,
          lyricsLoading: lyricsLoading,
          pendingLyricsTaskId: pendingLyricsTaskId
        };
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
      } catch (e) {
        console.warn("[Custom Song Builder] Could not save progress", e);
      }
    }

    function loadProgress() {
      try {
        var raw = window.localStorage.getItem(STORAGE_KEY);
        if (!raw) return null;
        var parsed = JSON.parse(raw);
        if (!parsed || !parsed.savedAt || (Date.now() - parsed.savedAt) > STORAGE_MAX_AGE_MS) {
          window.localStorage.removeItem(STORAGE_KEY);
          return null;
        }
        return parsed;
      } catch (e) {
        return null;
      }
    }

    function clearProgress() {
      try { window.localStorage.removeItem(STORAGE_KEY); } catch (e) { /* ignore */ }
    }

    // ---- Polling helper ----
    // Note: a single failed fetch/parse (network blip, transient 502, etc.) does
    // NOT fail the whole poll — only an explicit failed status from the backend,
    // or running out of attempts, ends the poll early. This avoids the wizard
    // showing "Generation Failed" while Suno is still generating successfully
    // in the background (confirmed by a manual status check after the fact).
    function pollStatus(taskId, type, onProgress) {
      return new Promise(function (resolve, reject) {
        if (!taskId) {
          var noTaskErr = new Error("No taskId returned from API");
          noTaskErr.isTimeout = false;
          reject(noTaskErr);
          return;
        }
        var attempts = 0;
        var maxAttempts = 180; // 180 * 2s = 6 minutes
        var interval = setInterval(function () {
          attempts++;
          if (onProgress) onProgress(Math.min(90, Math.round((attempts / maxAttempts) * 90)));
          fetch(apiUrl("/api/suno/status?taskId=" + encodeURIComponent(taskId) + "&type=" + type))
            .then(function (res) { return res.json(); })
            .then(function (data) {
              var failedSet = type === "lyrics" ? LYRICS_FAILED_STATUSES : MUSIC_FAILED_STATUSES;
              var successSet = type === "lyrics" ? ["SUCCESS"] : MUSIC_SUCCESS_STATUSES;

              if (successSet.indexOf(data.status) !== -1) {
                clearInterval(interval);
                if (onProgress) onProgress(100);
                resolve(data);
              } else if (data.failed || failedSet.indexOf(data.status) !== -1) {
                // Explicit failure reported by the backend — stop immediately.
                clearInterval(interval);
                var explicitErr = new Error(data.errorMessage || data.error || ("Generation " + (data.status || "failed")));
                explicitErr.isTimeout = false;
                reject(explicitErr);
              } else if (attempts >= maxAttempts) {
                // Ran out of time, but never got an explicit failure — treat as timeout.
                clearInterval(interval);
                var timeoutErr = new Error("Generation is taking longer than expected. Please try again in a few minutes.");
                timeoutErr.isTimeout = true;
                reject(timeoutErr);
              }
              // Otherwise: still pending (e.g. PENDING/PROCESSING) — keep polling.
            })
            .catch(function (err) {
              // Transient error talking to OUR backend (network blip, bad JSON, etc.)
              // Don't fail the whole poll on a single bad attempt — just skip this
              // tick and try again on the next interval, unless we've also run out
              // of attempts.
              console.warn("[Custom Song Builder] Status check attempt failed, will retry:", err);
              if (attempts >= maxAttempts) {
                clearInterval(interval);
                var networkErr = new Error("Generation is taking longer than expected. Please try again in a few minutes.");
                networkErr.isTimeout = true;
                reject(networkErr);
              }
            });
        }, 2000);
      });
    }

    // ---- Load dynamic form options ----
    function fetchOptions() {
      fetch(apiUrl("/api/form-options"))
        .then(function (res) { return res.json(); })
        .then(function (json) {
          if (json.success && json.data) {
            options = json.data;
            if (options.packages && options.packages.length > 0) {
              var hasValidSelection = state.selectedPackage &&
                options.packages.some(function (p) { return p.id === state.selectedPackage; });
              if (!hasValidSelection) {
                state.selectedPackage = options.packages[0].id;
              }
            }
            // Build the package -> Shopify product/variant map straight from
            // the backend's package data (set via the admin "Shopify Linking"
            // fields). A package only gets its own cart line item if both
            // IDs are actually filled in — otherwise it's just a text label.
            packageProductMap = {};
            (options.packages || []).forEach(function (pkg) {
              if (pkg.shopifyVariantId) {
                packageProductMap[pkg.id] = {
                  productId: pkg.shopifyProductId || "",
                  variantId: pkg.shopifyVariantId
                };
              }
            });
          }
        })
        .catch(function (err) { console.error("Failed to load options", err); })
        .finally(function () {
          optionsLoading = false;
          renderOccasions();
          renderRecipients();
          renderStyleGroups();
          renderLanguages();
          renderPackages();
          if (state.currentStep === 10) renderSummary();
        });
    }

    // ---- Renderers ----
    function isOtherOccasionLabel(val) {
      return typeof val === "string" && val.trim().toLowerCase().indexOf("other") === 0;
    }

    function toggleOtherOccasionField() {
      var otherWrap = $("[data-csb-occasion-other-wrap]");
      if (otherWrap) otherWrap.hidden = !state.occasionIsOther;
    }


    function formatRecipients(arr, includePronunciation) {
      if (!arr || arr.length === 0) return "someone special";
      return arr.map(function (r) {
        var res = r.name || "";
        if (includePronunciation && r.pronunciationMode === "Manual" && r.pronunciation) {
          res += " (pronounced: " + r.pronunciation + ")";
        }
        return res;
      }).filter(Boolean).join(", ");
    }

    function renderRecipients() {
      var wrap = $("[data-csb-recipients-wrap]");
      if (!wrap) return;
      wrap.innerHTML = "";
      state.recipients.forEach(function (rec, idx) {
        var row = document.createElement("div");
        row.className = "csb-recipient-row csb-gap-top";

        var nameDiv = document.createElement("div");
        nameDiv.innerHTML = '<label class="csb-label">Name</label><input type="text" class="csb-input" placeholder="e.g. John" value="' + (rec.name || '').replace(/"/g, '&quot;') + '">';
        var nameInput = nameDiv.querySelector("input");
        nameInput.addEventListener("input", function (e) {
          state.recipients[idx].name = e.target.value;
          saveProgress();
        });
        row.appendChild(nameDiv);

        var modeDiv = document.createElement("div");
        modeDiv.className = "csb-gap-top-sm";
        modeDiv.innerHTML = '<label class="csb-label">How do you pronounce this name?</label><select class="csb-select"><option value="Original">Original</option><option value="Manual">Enter manually</option></select>';
        var select = modeDiv.querySelector("select");
        select.value = rec.pronunciationMode || "Original";
        select.addEventListener("change", function (e) {
          state.recipients[idx].pronunciationMode = e.target.value;
          renderRecipients();
          saveProgress();
        });
        row.appendChild(modeDiv);

        if (rec.pronunciationMode === "Manual") {
          var pronDiv = document.createElement("div");
          pronDiv.className = "csb-gap-top-sm";
          pronDiv.innerHTML = '<input type="text" class="csb-input" placeholder="e.g. J-on" value="' + (rec.pronunciation || '').replace(/"/g, '&quot;') + '">';
          var pronInput = pronDiv.querySelector("input");
          pronInput.addEventListener("input", function (e) {
            state.recipients[idx].pronunciation = e.target.value;
            saveProgress();
          });
          row.appendChild(pronDiv);
        }

        if (state.recipients.length > 1) {
          var removeBtn = document.createElement("button");
          removeBtn.type = "button";
          removeBtn.className = "csb-btn-outline csb-gap-top-sm";
          removeBtn.textContent = "Remove";
          removeBtn.addEventListener("click", function () {
            state.recipients.splice(idx, 1);
            renderRecipients();
            saveProgress();
          });
          row.appendChild(removeBtn);
        }

        wrap.appendChild(row);
      });
    }

    function renderOccasions() {
      var wrap = $("[data-csb-occasions]");
      if (!wrap) return;
      if (optionsLoading) {
        wrap.innerHTML = '<div class="csb-loading-text">Loading occasions...</div>';
        return;
      }
      wrap.innerHTML = "";
      (options.occasions || []).forEach(function (occ) {
        var isOtherPill = isOtherOccasionLabel(occ);
        var isSelected = isOtherPill ? state.occasionIsOther : (!state.occasionIsOther && state.occasion === occ);
        var btn = document.createElement("button");
        btn.type = "button";
        btn.className = "csb-pill" + (isSelected ? " is-selected" : "");
        btn.textContent = occ;
        btn.addEventListener("click", function () {
          if (isOtherPill) {
            state.occasionIsOther = true;
            state.occasion = state.customOccasion || "";
            renderOccasions();
            syncFieldInputs();
            // Give the newly-shown text field focus so the customer can type right away.
            var otherInput = root.querySelector('[data-csb-field="customOccasion"]');
            if (otherInput) otherInput.focus();
          } else {
            state.occasionIsOther = false;
            state.customOccasion = "";
            state.occasion = occ;
            renderOccasions();
          }
          saveProgress();
        });
        wrap.appendChild(btn);
      });
      toggleOtherOccasionField();
    }

    function renderStyleGroups() {
      var wrap = $("[data-csb-style-groups]");
      if (!wrap) return;
      if (optionsLoading) {
        wrap.innerHTML = '<div class="csb-loading-text csb-center">Loading style options...</div>';
        return;
      }
      var groups = [
        { label: "Genre", field: "genre", list: options.genres || [] },
        { label: "Voice", field: "voice", list: options.voices || [] },
        { label: "Mood", field: "mood", list: options.moods || [] }
      ];
      wrap.innerHTML = "";
      groups.forEach(function (g) {
        var section = document.createElement("div");
        section.style.marginBottom = "1.5rem";
        var h = document.createElement("h3");
        h.style.fontSize = "0.8rem";
        h.style.fontWeight = "600";
        h.style.textTransform = "uppercase";
        h.style.letterSpacing = "0.05em";
        h.style.color = "#667085";
        h.style.marginBottom = "0.75rem";
        h.textContent = g.label;
        section.appendChild(h);

        var pillRow = document.createElement("div");
        pillRow.className = "csb-center";
        pillRow.style.justifyContent = "flex-start";

        g.list.forEach(function (opt) {
          var btn = document.createElement("button");
          btn.type = "button";
          btn.className = "csb-pill" + (state[g.field] === opt ? " is-selected" : "");
          btn.textContent = opt;
          btn.addEventListener("click", function () {
            state[g.field] = opt;
            renderStyleGroups();
            saveProgress();
          });
          pillRow.appendChild(btn);
        });

        section.appendChild(pillRow);
        wrap.appendChild(section);
      });
    }

    function renderLanguages() {
      var select = root.querySelector('[data-csb-field="lyricsLanguage"]');
      if (!select) return;
      if (optionsLoading) {
        select.innerHTML = '<option value="">Loading...</option>';
        return;
      }
      select.innerHTML = "";
      (options.languages || []).forEach(function (lang) {
        var opt = document.createElement("option");
        opt.value = lang;
        opt.textContent = lang;
        select.appendChild(opt);
      });
      if (!state.lyricsLanguage && options.languages && options.languages.length > 0) {
        state.lyricsLanguage = options.languages[0];
      }
      select.value = state.lyricsLanguage || "";
    }

    // Helper: extract the "Compare At Price" value from a package object.
    // The admin panel calls it "Compare At Price" — the backend may expose
    // it as compareAtPrice, originalPrice, or compare_at_price.
    function getCompareAtPrice(pkg) {
      return pkg.compareAtPrice || pkg.originalPrice || pkg.compare_at_price || "";
    }

    // Helper: auto-calculate discount percentage from compare-at and current price.
    // Returns a string like "30% OFF" or "" if no valid discount.
    function calcDiscountLabel(pkg) {
      if (pkg.discount) return pkg.discount; // explicit label from admin takes priority
      var compareStr = getCompareAtPrice(pkg);
      var priceStr = pkg.price;
      if (!compareStr || !priceStr) return "";
      var compare = parseFloat(String(compareStr).replace(/[^\d.,]/g, "").replace(",", "."));
      var current = parseFloat(String(priceStr).replace(/[^\d.,]/g, "").replace(",", "."));
      if (isNaN(compare) || isNaN(current) || compare <= current) return "";
      var pct = Math.round(((compare - current) / compare) * 100);
      return pct > 0 ? (pct + "% OFF") : "";
    }

    function renderPackages() {
      var wrap = $("[data-csb-packages-grid]");
      if (!wrap) return;
      if (optionsLoading) {
        wrap.innerHTML = '<div class="csb-loading-text csb-center">Loading packages...</div>';
        return;
      }
      wrap.innerHTML = "";
      (options.packages || []).forEach(function (pkg) {
        var card = document.createElement("div");
        card.className = "csb-package-card" + (state.selectedPackage === pkg.id ? " is-selected" : "");

        if (pkg.tagline) {
          var tag = document.createElement("div");
          tag.className = "csb-package-tag";
          tag.textContent = pkg.tagline;
          card.appendChild(tag);
        }

        var body = document.createElement("div");
        body.className = "csb-package-body";

        var title = document.createElement("h3");
        title.className = "csb-package-title";
        title.textContent = pkg.title;
        body.appendChild(title);

        var priceWrap = document.createElement("div");
        priceWrap.className = "csb-package-price-wrap";

        var compareAt = getCompareAtPrice(pkg);
        if (compareAt && compareAt !== pkg.price) {
          var originalPrice = document.createElement("span");
          originalPrice.className = "csb-package-original-price";
          originalPrice.textContent = compareAt;
          priceWrap.appendChild(originalPrice);
        }

        var price = document.createElement("div");
        price.className = "csb-package-price";
        price.textContent = pkg.price;
        priceWrap.appendChild(price);

        var discountLabel = calcDiscountLabel(pkg);
        if (discountLabel) {
          var discountBadge = document.createElement("span");
          discountBadge.className = "csb-package-discount-badge";
          discountBadge.textContent = discountLabel;
          priceWrap.appendChild(discountBadge);
        }

        body.appendChild(priceWrap);

        if (pkg.image) {
          var imgWrap = document.createElement("div");
          imgWrap.className = "csb-package-image";
          var img = document.createElement("img");
          img.src = pkg.image;
          img.alt = pkg.title;
          imgWrap.appendChild(img);
          body.appendChild(imgWrap);
        }

        var featuresWrap = document.createElement("div");
        featuresWrap.className = "csb-package-features";
        var label = document.createElement("div");
        label.className = "csb-package-features-label";
        label.textContent = "📦 What's included?";
        featuresWrap.appendChild(label);
        var ul = document.createElement("ul");
        (pkg.features || []).forEach(function (f) {
          var li = document.createElement("li");
          li.textContent = f;
          ul.appendChild(li);
        });
        featuresWrap.appendChild(ul);
        body.appendChild(featuresWrap);

        card.appendChild(body);
        card.addEventListener("click", function () {
          state.selectedPackage = pkg.id;
          renderPackages();
          saveProgress();
        });
        wrap.appendChild(card);
      });
    }

    function renderLyricsVariations() {
      var panel = $("[data-csb-lyrics-variations]");
      var grid = $("[data-csb-variations-grid]");
      if (!panel || !grid) return;

      if (lyricsVariations.length === 0) {
        panel.hidden = true;
        return;
      }
      panel.hidden = false;
      grid.innerHTML = "";

      lyricsVariations.forEach(function (variation, idx) {
        var card = document.createElement("div");
        card.className = "csb-variation-card" + (selectedLyricsIndex === idx ? " is-selected" : "");

        var h3 = document.createElement("h3");
        h3.textContent = variation.title || ("Option " + (idx + 1));
        card.appendChild(h3);

        var textDiv = document.createElement("div");
        textDiv.className = "csb-variation-text";
        textDiv.textContent = variation.text;
        card.appendChild(textDiv);

        var selectRow = document.createElement("div");
        selectRow.className = "csb-variation-select-row";
        var tag = document.createElement("div");
        tag.className = "csb-variation-tag " + (selectedLyricsIndex === idx ? "is-selected" : "is-not-selected");
        tag.textContent = selectedLyricsIndex === idx ? "✓ Selected" : "Select";
        selectRow.appendChild(tag);
        card.appendChild(selectRow);

        card.addEventListener("click", function () {
          selectedLyricsIndex = idx;
          state.lyrics = variation.text;
          renderLyricsVariations();
          syncFieldInputs();
          saveProgress();
        });

        grid.appendChild(card);
      });

      syncFieldInputs();
    }

    function renderTracks() {
      var grid = $("[data-csb-tracks-grid]");
      var countLabel = $("[data-csb-tracks-count]");
      if (!grid) return;

      var hasRealTracks = musicTracks.length > 0;
      var displayTracks = hasRealTracks ? musicTracks : [
        { id: "demo1", title: "Unique Song 1" },
        { id: "demo2", title: "Unique Song 2" }
      ];

      if (countLabel) {
        countLabel.textContent = "We've generated " + (musicTracks.length || 2) + " versions. Pick your favorite!";
      }

      grid.innerHTML = "";
      displayTracks.forEach(function (track, idx) {
        var card = document.createElement("div");
        card.className = "csb-track-card" + (state.selectedDemo === track.id ? " is-selected" : "");

        var badge = document.createElement("div");
        badge.className = "csb-track-badge " + (state.selectedDemo === track.id ? "is-selected" : "is-not-selected");
        badge.textContent = state.selectedDemo === track.id ? "✓ Selected" : "Select";
        card.appendChild(badge);

        var art = document.createElement("div");
        art.className = "csb-track-art";
        if (track.imageUrl) {
          var img = document.createElement("img");
          img.src = track.imageUrl;
          img.alt = track.title || ("Song " + (idx + 1));
          img.addEventListener("error", function () { img.style.display = "none"; });
          art.appendChild(img);
          if (state.selectedDemo === track.id) {
            var overlay = document.createElement("div");
            overlay.className = "csb-track-art-overlay";
            overlay.textContent = "✓";
            art.appendChild(overlay);
          }
        } else {
          var placeholderSvg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
          placeholderSvg.setAttribute("class", "csb-track-art-placeholder");
          placeholderSvg.setAttribute("viewBox", "0 0 24 24");
          placeholderSvg.setAttribute("fill", "currentColor");
          placeholderSvg.innerHTML = '<path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z" />';
          art.appendChild(placeholderSvg);
        }
        card.appendChild(art);

        var titleEl = document.createElement("h3");
        titleEl.className = "csb-track-title";
        titleEl.textContent = track.title || ("Version " + (idx + 1));
        card.appendChild(titleEl);

        if (track.streamAudioUrl) {
          var audioWrap = document.createElement("div");
          audioWrap.className = "csb-track-audio";
          audioWrap.addEventListener("click", function (e) { e.stopPropagation(); });
          var audio = document.createElement("audio");
          audio.controls = true;
          audio.setAttribute("controlslist", "nodownload");
          audio.style.colorScheme = "light";
          var source = document.createElement("source");
          source.src = track.streamAudioUrl;
          source.type = "audio/mpeg";
          audio.appendChild(source);
          audio.addEventListener("play", function () {
            root.querySelectorAll("audio").forEach(function (a) {
              if (a !== audio) a.pause();
            });
          });
          audioWrap.appendChild(audio);
          card.appendChild(audioWrap);
        } else {
          var fallback = document.createElement("div");
          fallback.className = "csb-track-play-fallback";
          var playSvg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
          playSvg.setAttribute("viewBox", "0 0 24 24");
          playSvg.setAttribute("fill", "currentColor");
          playSvg.style.width = "1.5rem";
          playSvg.style.height = "1.5rem";
          playSvg.style.marginLeft = "2px";
          playSvg.innerHTML = '<path d="M8 5v14l11-7z" />';
          fallback.appendChild(playSvg);
          card.appendChild(fallback);
        }

        // Only real, generated tracks are selectable. The two placeholder
        // "Unique Song 1/2" cards shown before generation finishes are just
        // visual scaffolding — clicking them must not be able to set
        // state.selectedDemo to a fake "demo1"/"demo2" id (which would later
        // leak into buildLineItemProperties/cart if the user somehow reached
        // step 8 before real tracks existed).
        if (hasRealTracks) {
          card.addEventListener("click", function () {
            state.selectedDemo = track.id;
            renderTracks();
            saveProgress();
          });
        } else {
          card.style.cursor = "default";
        }

        grid.appendChild(card);
      });
    }

    function renderSummary() {
      var list = $("[data-csb-summary-list]");
      if (!list) return;
      var rows = [
        ["Occasion", state.occasion],
        ["Recipients", formatRecipients(state.recipients, false)],
        ["Music Style", [state.genre, state.voice, state.mood].filter(Boolean).join(" • ")],
        ["Email", state.email]
      ];
      list.innerHTML = "";
      rows.forEach(function (row) {
        var li = document.createElement("li");
        var label = document.createElement("span");
        label.textContent = row[0] + ":";
        var value = document.createElement("span");
        value.textContent = row[1] || "—";
        li.appendChild(label);
        li.appendChild(value);
        list.appendChild(li);
      });

      renderSummarySong();
      renderSummaryPackage();

      // Total price is always the selected package's own price now, since
      // this section isn't tied to a specific page product — every package
      // is expected to carry its own Shopify product/price via form-options.
      var totalValueEl = $("[data-csb-total-price]");
      if (totalValueEl) {
        var pkg = (options.packages || []).filter(function (p) { return p.id === state.selectedPackage; })[0];
        var pkgPriceStr = (pkg && pkg.price) ? pkg.price : "";
        var total = pkgPriceStr;

        if (state.rushOrder) {
          var rushPriceEl = $("[data-csb-rush-price]");
          var rushPriceStr = rushPriceEl ? rushPriceEl.textContent : "";
          if (pkgPriceStr && rushPriceStr) {
            var p1 = parseFloat(pkgPriceStr.replace(/[^\d.,]/g, "").replace(",", "."));
            var p2 = parseFloat(rushPriceStr.replace(/[^\d.,]/g, "").replace(",", "."));
            if (!isNaN(p1) && !isNaN(p2)) {
              var symbol = pkgPriceStr.replace(/[\d.,\s]/g, "");
              var isCommaDecimal = pkgPriceStr.indexOf(",") !== -1;
              var sumStr = (p1 + p2).toFixed(2);
              if (isCommaDecimal) sumStr = sumStr.replace(".", ",");

              if (pkgPriceStr.indexOf(symbol) === 0) {
                total = symbol + sumStr;
              } else {
                total = sumStr + " " + symbol;
              }
            }
          }
        }

        // Build the total price display with discount info
        totalValueEl.innerHTML = "";
        var totalCompareAt = pkg ? getCompareAtPrice(pkg) : "";
        var hasDiscount = totalCompareAt && totalCompareAt !== (pkg && pkg.price);

        if (hasDiscount) {
          var origTotal = totalCompareAt;
          // If rush order, add rush price to original too
          if (state.rushOrder) {
            var rushPriceEl2 = $("[data-csb-rush-price]");
            var rushPriceStr2 = rushPriceEl2 ? rushPriceEl2.textContent : "";
            if (origTotal && rushPriceStr2) {
              var op1 = parseFloat(origTotal.replace(/[^\d.,]/g, "").replace(",", "."));
              var op2 = parseFloat(rushPriceStr2.replace(/[^\d.,]/g, "").replace(",", "."));
              if (!isNaN(op1) && !isNaN(op2)) {
                var oSymbol = origTotal.replace(/[\d.,\s]/g, "");
                var oIsComma = origTotal.indexOf(",") !== -1;
                var oSumStr = (op1 + op2).toFixed(2);
                if (oIsComma) oSumStr = oSumStr.replace(".", ",");
                origTotal = origTotal.indexOf(oSymbol) === 0 ? (oSymbol + oSumStr) : (oSumStr + " " + oSymbol);
              }
            }
          }

          var origSpan = document.createElement("span");
          origSpan.className = "csb-total-original-price";
          origSpan.textContent = origTotal;
          totalValueEl.appendChild(origSpan);

          var currentSpan = document.createElement("span");
          currentSpan.className = "csb-total-current-price";
          currentSpan.textContent = total || "—";
          totalValueEl.appendChild(currentSpan);

          var totalDiscLabel = pkg ? calcDiscountLabel(pkg) : "";
          if (totalDiscLabel) {
            var saveBadge = document.createElement("span");
            saveBadge.className = "csb-total-discount-badge";
            saveBadge.textContent = totalDiscLabel;
            totalValueEl.appendChild(saveBadge);
          }
        } else {
          totalValueEl.textContent = total || "—";
        }
      }
    }

    // Selected song preview — reuses the same streamAudioUrl already fetched
    // for step 8 (no new endpoint exposure; the real Suno taskId is never used here).
    function renderSummarySong() {
      var wrap = $("[data-csb-summary-song]");
      var artWrap = $("[data-csb-summary-song-art]");
      var titleEl = $("[data-csb-summary-song-title]");
      var audioWrap = $("[data-csb-summary-song-audio]");
      if (!wrap) return;

      var chosen = musicTracks.filter(function (t) { return t.id === state.selectedDemo; })[0];

      if (!chosen) {
        wrap.hidden = true;
        return;
      }
      wrap.hidden = false;

      if (titleEl) titleEl.textContent = chosen.title || "Your custom song";

      if (artWrap) {
        artWrap.innerHTML = "";
        if (chosen.imageUrl) {
          var img = document.createElement("img");
          img.src = chosen.imageUrl;
          img.alt = chosen.title || "Song cover art";
          img.addEventListener("error", function () { img.style.display = "none"; });
          artWrap.appendChild(img);
        } else {
          artWrap.textContent = "🎵";
        }
      }

      if (audioWrap) {
        audioWrap.innerHTML = "";
        if (chosen.streamAudioUrl) {
          var audio = document.createElement("audio");
          audio.controls = true;
          audio.setAttribute("controlslist", "nodownload");
          audio.style.colorScheme = "light";
          var source = document.createElement("source");
          source.src = chosen.streamAudioUrl;
          source.type = "audio/mpeg";
          audio.appendChild(source);
          audio.addEventListener("play", function () {
            root.querySelectorAll("audio").forEach(function (a) {
              if (a !== audio) a.pause();
            });
          });
          audioWrap.appendChild(audio);
        } else {
          var noAudio = document.createElement("p");
          noAudio.className = "csb-hint";
          noAudio.textContent = "Audio preview is still processing — it will be ready in your order email.";
          audioWrap.appendChild(noAudio);
        }
      }
    }

    // Selected package details — pulled from the same options.packages data
    // already loaded for step 9 (no new fetch needed).
    function renderSummaryPackage() {
      var wrap = $("[data-csb-summary-package]");
      var cardWrap = $("[data-csb-summary-package-card]");
      if (!wrap || !cardWrap) return;

      var pkg = (options.packages || []).filter(function (p) { return p.id === state.selectedPackage; })[0];

      if (!pkg) {
        wrap.hidden = true;
        return;
      }
      wrap.hidden = false;
      cardWrap.innerHTML = "";

      if (pkg.image) {
        var imgWrap = document.createElement("div");
        imgWrap.className = "csb-summary-package-image";
        var img = document.createElement("img");
        img.src = pkg.image;
        img.alt = pkg.title || "Package";
        imgWrap.appendChild(img);
        cardWrap.appendChild(imgWrap);
      }

      var info = document.createElement("div");
      info.className = "csb-summary-package-info";

      var titleRow = document.createElement("div");
      titleRow.className = "csb-summary-package-title-row";
      var title = document.createElement("span");
      title.className = "csb-summary-package-title";
      title.textContent = pkg.title || state.selectedPackage;

      var priceCol = document.createElement("div");
      priceCol.className = "csb-summary-package-price-col";

      var pkgCompareAt = getCompareAtPrice(pkg);
      if (pkgCompareAt && pkgCompareAt !== pkg.price) {
        var origPrice = document.createElement("span");
        origPrice.className = "csb-summary-package-original-price";
        origPrice.textContent = pkgCompareAt;
        priceCol.appendChild(origPrice);
      }

      var price = document.createElement("span");
      price.className = "csb-summary-package-price";
      price.textContent = pkg.price || "";
      priceCol.appendChild(price);

      var pkgDiscLabel = calcDiscountLabel(pkg);
      if (pkgDiscLabel) {
        var discBadge = document.createElement("span");
        discBadge.className = "csb-summary-package-discount-badge";
        discBadge.textContent = pkgDiscLabel;
        priceCol.appendChild(discBadge);
      }

      titleRow.appendChild(title);
      titleRow.appendChild(priceCol);
      info.appendChild(titleRow);

      if (pkg.features && pkg.features.length > 0) {
        var ul = document.createElement("ul");
        ul.className = "csb-summary-package-features";
        pkg.features.forEach(function (f) {
          var li = document.createElement("li");
          li.textContent = f;
          ul.appendChild(li);
        });
        info.appendChild(ul);
      }

      cardWrap.appendChild(info);
    }

    function syncFieldInputs() {
      $$("[data-csb-field]").forEach(function (el) {
        var field = el.getAttribute("data-csb-field");

        if (el.type === "checkbox") {
          el.checked = !!state[field];
        } else {
          if (document.activeElement !== el) {
            el.value = state[field] || "";
          }
        }
      });
    }

    function renderMethodCards() {
      $$("[data-csb-method]").forEach(function (btn) {
        var method = btn.getAttribute("data-csb-method");
        btn.classList.toggle("is-selected", state.creationMethod === method);
      });
      $$("[data-csb-panel]").forEach(function (panel) {
        var name = panel.getAttribute("data-csb-panel");
        panel.hidden = state.creationMethod !== name;
      });
    }

    // ---- Progress / step visibility ----
    function renderProgress() {
      var pct = Math.round(((state.currentStep - 1) / (TOTAL_STEPS - 1)) * 100);
      if (stepLabel) stepLabel.textContent = "Step " + state.currentStep + " of " + TOTAL_STEPS;
      if (percentLabel) percentLabel.textContent = pct + "% Complete";
      if (progressFill) progressFill.style.width = pct + "%";
      if (progressWrap) progressWrap.style.display = state.currentStep === 7 ? "none" : "block";
    }

    function renderStepVisibility() {
      $$("[data-csb-step]").forEach(function (stepEl) {
        var n = parseInt(stepEl.getAttribute("data-csb-step"), 10);
        stepEl.hidden = n !== state.currentStep;
      });
      if (navWrap) navWrap.style.display = state.currentStep === 7 ? "none" : "flex";

      if (backBtn) backBtn.classList.toggle("is-invisible", state.currentStep === 1);
      if (nextBtn) nextBtn.hidden = state.currentStep === TOTAL_STEPS;
      if (checkoutBtn) checkoutBtn.hidden = state.currentStep !== TOTAL_STEPS;
    }

    function render() {
      renderProgress();
      renderStepVisibility();
      renderRecipients();
      syncFieldInputs();
      renderMethodCards();
      setEmailLockState();
      if (state.currentStep === 9) renderPackages();
      if (state.currentStep === 10) renderSummary();
      saveProgress();
    }

    // ---- Step 5: Email lock icon ----
    var LOCK_CLOSED_D = "M7 11V7a5 5 0 0 1 10 0v4";
    var LOCK_OPEN_D = "M7 11V7a5 5 0 0 1 9.9-2";

    function setEmailLockState() {
      var box = $("[data-csb-lock-box]");
      if (!box) return;
      var shackle = $("[data-csb-lock-shackle]");
      var isValidEmail = !!state.email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(state.email);

      box.classList.toggle("is-unlocked", isValidEmail);
      if (shackle) shackle.setAttribute("d", isValidEmail ? LOCK_OPEN_D : LOCK_CLOSED_D);
    }

    // ---- Step 3: Generate lyrics ----
    function setLyricsButtonState() {
      var btn = $("[data-csb-generate-lyrics]");
      var spinner = $("[data-csb-lyrics-spinner]");
      var label = $("[data-csb-generate-lyrics-label]");
      var btn2 = $("[data-csb-generate-lyrics-again]");
      var spinner2 = $("[data-csb-lyrics-spinner-2]");
      var regenLabel = $("[data-csb-regen-label]");
      var errorEl = $("[data-csb-lyrics-error]");

      if (btn) {
        btn.disabled = lyricsLoading || !state.storyText;
        btn.hidden = lyricsVariations.length > 0 || !!state.lyrics;
      }
      if (spinner) spinner.hidden = !lyricsLoading;
      if (label) label.textContent = lyricsLoading ? "Generating lyrics..." : "✨ Generate AI Lyrics";

      if (btn2) btn2.disabled = lyricsLoading;
      if (spinner2) spinner2.hidden = !lyricsLoading;
      if (regenLabel) regenLabel.textContent = lyricsLoading ? "Regenerating..." : "↻ Regenerate Lyrics";

      if (errorEl) {
        errorEl.hidden = !lyricsError;
        errorEl.textContent = lyricsError || "";
      }
    }

    function generateLyrics() {
      if (!state.storyText) return;
      lyricsLoading = true;
      lyricsError = "";
      setLyricsButtonState();
      saveProgress();

      var rawPrompt = state.occasion + " song for " +
        formatRecipients(state.recipients, false) +
        ". " + state.storyText + ". " + (state.mood || "emotional") + " " + (state.genre || "pop") + " style." +
        " Write the lyrics in " + (state.lyricsLanguage || "English") + ".";
      var prompt = rawPrompt.substring(0, 200);

      fetch(apiUrl("/api/suno/generate-lyrics"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: prompt })
      })
        .then(function (res) {
          return res.json().then(function (data) { return { ok: res.ok, data: data }; });
        })
        .then(function (wrapped) {
          if (!wrapped.ok || !wrapped.data.taskId) {
            throw new Error(wrapped.data.error || "Failed to generate lyrics");
          }
          // Remember the task so a reload/tab-close while this is still
          // running can resume polling instead of losing the request.
          pendingLyricsTaskId = wrapped.data.taskId;
          saveProgress();
          return pollStatus(wrapped.data.taskId, "lyrics", null);
        })
        .then(function (result) {
          if (result.allVariations && result.allVariations.length > 0) {
            lyricsVariations = result.allVariations;
            selectedLyricsIndex = 0;
            state.lyrics = result.allVariations[0].text;
            renderLyricsVariations();
          } else if (result.lyrics) {
            state.lyrics = result.lyrics;
            syncFieldInputs();
          } else {
            throw new Error("Lyrics generated but no text returned");
          }
        })
        .catch(function (err) {
          lyricsError = err.message;
        })
        .finally(function () {
          lyricsLoading = false;
          pendingLyricsTaskId = null;
          setLyricsButtonState();
          saveProgress();
        });
    }

    // ---- Step 7: Generate music ----
    function startMusicGeneration() {
      generationProgress = 0;
      generationError = "";
      generationErrorIsTimeout = false;
      musicTracks = [];
      updateGeneratingUI();

      var rawStyle = [state.genre, state.voice, state.mood].filter(Boolean).join(", ");
      var style = rawStyle.substring(0, 200) || "Pop";
      var rawTitle = state.occasion + " song for " + formatRecipients(state.recipients, false);
      var title = rawTitle.substring(0, 80);

      var honeypotEl = root.querySelector("[data-csb-field='hp_website']");
      var honeypot = honeypotEl ? honeypotEl.value : "";

      fetch(apiUrl("/api/suno/generate-music"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lyrics: state.lyrics || "[Verse]\nA beautiful song\n[Chorus]\nFull of love and joy",
          style: style,
          title: title,
          formData: state,
          resumeBaseUrl: window.location.href.split("?")[0],
          turnstileToken: turnstileToken,
          visitorId: visitorId,
          hp_website: honeypot
        })
      })
        .then(function (res) {
          return res.json().then(function (data) { return { ok: res.ok, data: data }; });
        })
        .then(function (wrapped) {
          if (!wrapped.ok || !wrapped.data.taskId) {
            var startErr = new Error(wrapped.data.error || "Failed to start music generation");
            startErr.isTimeout = false;
            throw startErr;
          }
          state.taskId = wrapped.data.taskId;
          saveProgress();
          return pollStatus(wrapped.data.taskId, "music", function (p) {
            generationProgress = p;
            updateGeneratingUI();
          });
        })
        .then(function (result) {
          musicTracks = result.tracks || [];
          isAudioReady = !!result.isFullySaved;
          if (!isAudioReady) {
            startBackgroundPolling(state.taskId);
          }
          renderTracks();
          goToStep(8);
        })
        .catch(function (err) {
          generationError = err.message;
          generationErrorIsTimeout = !!err.isTimeout;
          updateGeneratingUI();
          saveProgress();
        });
    }

    // ---- "Try Again" (timeout/network case only) ----
    // The poll may have given up locally while Suno kept working server-side.
    // Check the existing taskId once before deciding whether to kick off a
    // brand new generation request.
    function retryAfterTimeout() {
      var btn = $("[data-csb-gen-back]");
      if (btn) {
        btn.disabled = true;
        btn.textContent = "Checking...";
      }

      if (!state.taskId) {
        // Nothing to check against — just start a fresh generation.
        startMusicGeneration();
        return;
      }

      fetch(apiUrl("/api/suno/status?taskId=" + encodeURIComponent(state.taskId) + "&type=music"))
        .then(function (res) { return res.json(); })
        .then(function (data) {
          if (MUSIC_SUCCESS_STATUSES.indexOf(data.status) !== -1) {
            // It actually finished while we were showing the error — use it.
            musicTracks = data.tracks || [];
            isAudioReady = !!data.isFullySaved;
            if (!isAudioReady) {
              startBackgroundPolling(state.taskId);
            }
            renderTracks();
            goToStep(8);
            return;
          }
          if (MUSIC_FAILED_STATUSES.indexOf(data.status) !== -1 || data.failed) {
            // It really did fail server-side — start over with a new request.
            startMusicGeneration();
            return;
          }
          // Still pending/processing — resume polling instead of starting a
          // brand new (duplicate) generation request.
          generationError = "";
          generationErrorIsTimeout = false;
          updateGeneratingUI();
          pollStatus(state.taskId, "music", function (p) {
            generationProgress = p;
            updateGeneratingUI();
          })
            .then(function (result) {
              musicTracks = result.tracks || [];
              isAudioReady = !!result.isFullySaved;
              if (!isAudioReady) {
                startBackgroundPolling(state.taskId);
              }
              renderTracks();
              goToStep(8);
            })
            .catch(function (err) {
              generationError = err.message;
              generationErrorIsTimeout = !!err.isTimeout;
              updateGeneratingUI();
              saveProgress();
            });
        })
        .catch(function () {
          // Couldn't even check status — fall back to a fresh generation request.
          startMusicGeneration();
        });
    }

    function updateGeneratingUI() {
      var ok = $("[data-csb-generating-ok]");
      var errBox = $("[data-csb-generating-error]");
      var fill = $("[data-csb-gen-progress-fill]");
      var text = $("[data-csb-gen-progress-text]");
      var errText = $("[data-csb-gen-error-text]");
      var backBtn2 = $("[data-csb-gen-back]");

      if (generationError) {
        if (ok) ok.hidden = true;
        if (errBox) errBox.hidden = false;
        if (errText) errText.textContent = generationError;
        if (backBtn2) {
          backBtn2.disabled = false;
          backBtn2.textContent = generationErrorIsTimeout ? "Try Again" : "Go Back & Try Again";
        }
      } else {
        if (ok) ok.hidden = false;
        if (errBox) errBox.hidden = true;
        if (fill) fill.style.width = generationProgress + "%";
        if (text) text.textContent = Math.round(generationProgress) + "%";
      }
    }

    function startBackgroundPolling(taskId) {
      backgroundPollingTaskId = taskId;
      if (backgroundPollTimer) clearInterval(backgroundPollTimer);
      backgroundPollTimer = setInterval(function () {
        fetch(apiUrl("/api/suno/status?taskId=" + encodeURIComponent(taskId) + "&type=music"))
          .then(function (res) { return res.json(); })
          .then(function (data) {
            if (data.isFullySaved) {
              isAudioReady = true;
              backgroundPollingTaskId = null;
              clearInterval(backgroundPollTimer);
              backgroundPollTimer = null;
              saveProgress();
            }
          })
          .catch(function (err) { console.error("Background polling error:", err); });
      }, 5000);
    }

    // ---- Navigation ----
    // FIX: previously this unconditionally called startMusicGeneration()
    // whenever the wizard landed on step 7 — including when the user simply
    // pressed "Back" from step 8. That silently discarded the already-generated
    // tracks and fired a brand new (costly) Suno generation request every time.
    // Now, if tracks already exist, step 7 (the "generating" screen) is skipped
    // entirely and the user is sent straight to step 8 to see them — no
    // regeneration, no flash of the generating screen. Explicit regeneration
    // (the "regen songs" button) still works because it clears musicTracks
    // before calling goToStep(7).
    function goToStep(n) {
      if (n === 7 && musicTracks.length > 0) {
        n = 8;
      }
      state.currentStep = n;
      render();
      if (n === 7) {
        startMusicGeneration();
      }
    }

    function validateStep(step) {
      if (step === 1 && state.occasionIsOther && !state.customOccasion) {
        showToast({ variant: "warning", title: "Required", message: "Please type in your occasion." });
        return false;
      }
      if (step === 1 && !state.occasion) {
        showToast({ variant: "warning", title: "Required", message: "Please select an occasion." });
        return false;
      }
      if (step === 2) {
        var hasEmpty = state.recipients.some(function (r) { return !r.name.trim(); });
        if (hasEmpty) {
          showToast({ variant: "warning", title: "Required", message: "Please enter a name for all recipients." });
          return false;
        }
      }
      if (step === 3 && state.creationMethod === "write_for_us" && !state.storyText) {
        showToast({ variant: "warning", title: "Required", message: "Please provide a story." });
        return false;
      }
      if (step === 3 && state.creationMethod === "write_for_us" && !state.lyrics) {
        showToast({ variant: "warning", title: "Required", message: "Please generate and select your lyrics before continuing." });
        return false;
      }
      if (step === 3 && state.creationMethod === "own_lyrics" && !state.lyrics) {
        showToast({ variant: "warning", title: "Required", message: "Please paste your lyrics." });
        return false;
      }
      if (step === 4 && !state.lyrics) {
        showToast({ variant: "warning", title: "Required", message: "Please add your lyrics before continuing." });
        return false;
      }
      if (step === 5 && !state.email) {
        showToast({ variant: "warning", title: "Required", message: "Please enter an email address." });
        return false;
      }
      if (step === 5 && state.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(state.email)) {
        showToast({ variant: "warning", title: "Invalid email", message: "Please enter a valid email address." });
        return false;
      }
      if (step === 6 && (!state.genre || !state.voice || !state.mood)) {
        showToast({ variant: "warning", title: "Required", message: "Please complete all music style selections." });
        return false;
      }
      if (step === 8 && !state.selectedDemo) {
        showToast({ variant: "warning", title: "Required", message: "Please select one of the generated songs." });
        return false;
      }
      if (step === 9 && !state.selectedPackage) {
        showToast({ variant: "warning", title: "Required", message: "Please choose a package." });
        return false;
      }
      return true;
    }

    // ---- Generate an opaque, non-guessable "Music ID" for the customer-facing
    // line item. The real Suno taskId is kept out of the cart line-item
    // properties (and off the customer-facing order confirmation/emails), since
    // anyone who saw it there could hit /api/suno/status directly and stream the
    // song before paying. This ID is only used as a public reference; the
    // mapping back to taskId lives in our own DB. Note: taskId is still present
    // in wizard state (and therefore in localStorage/network requests) while the
    // wizard itself is running, since the client needs it to poll generation
    // status — this only keeps it out of the cart/order-facing surface.
    function generateMusicId() {
      if (window.crypto && window.crypto.randomUUID) {
        return window.crypto.randomUUID();
      }
      // Fallback UUID v4 generator for older browsers
      return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
        var r = (Math.random() * 16) | 0;
        var v = c === "x" ? r : (r & 0x3) | 0x8;
        return v.toString(16);
      });
    }

    // ---- Build Shopify line item properties from the wizard state ----
    // These show up on the cart page, checkout, and order detail (admin + customer email)
    // so the merchant/fulfiller can see every answer the customer gave.
    function buildLineItemProperties(musicId) {
      var props = {
        "Occasion": state.occasion || "",
        "Recipients": formatRecipients(state.recipients, true),
        "Song Title": (function () {
          if (musicTracks.length > 0 && state.selectedDemo) {
            var chosen = musicTracks.filter(function (t) { return t.id === state.selectedDemo; })[0];
            if (chosen && chosen.title) return chosen.title;
          }
          return state.occasion ? (state.occasion + " song") : "Custom Song";
        })(),
        "Lyrics": state.lyrics || "",
        "Lyrics Language": state.lyricsLanguage || "English",
        "Genre": state.genre || "",
        "Voice": state.voice || "",
        "Mood": state.mood || "",
        "Package": (function () {
          var pkg = (options.packages || []).filter(function (p) { return p.id === state.selectedPackage; })[0];
          return pkg ? (pkg.title || state.selectedPackage) : state.selectedPackage;
        })() || "",
        "Music ID": musicId || ""
      };
      // Strip empty values — Shopify still accepts them, but this keeps the
      // cart/order display clean.
      var cleaned = {};
      Object.keys(props).forEach(function (key) {
        if (props[key]) cleaned[key] = String(props[key]).substring(0, 500); // Shopify property value soft limit safety
      });
      return cleaned;
    }

    function addToShopifyCart(musicId) {
      // If the selected package is linked (via shopifyVariantId in the admin
      // panel) to its own Shopify product, that product is what actually gets
      // added to the cart — NOT this section's base product. All the custom
      // song details (lyrics, occasion, style, Music ID, etc.) travel with it
      // as line item properties either way.
      var targetVariantId = resolveTargetVariantId();

      if (!targetVariantId) {
        return Promise.reject(new Error("The selected package isn't linked to a Shopify product yet. Please link it in the admin panel."));
      }

      var items = [
        {
          id: parseInt(targetVariantId, 10),
          quantity: 1,
          properties: buildLineItemProperties(musicId)
        }
      ];
      var rushVariantId = root.getAttribute("data-rush-variant-id");
      if (state.rushOrder && rushVariantId) {
        items.push({
          id: parseInt(rushVariantId, 10),
          quantity: 1
        });
      }

      return fetch("/cart/add.js", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Accept": "application/json" },
        body: JSON.stringify({ items: items })
      }).then(function (res) {
        return res.json().then(function (data) {
          if (!res.ok) {
            var msg = (data && data.description) || (data && data.message) || "Failed to add product to cart";
            throw new Error(msg);
          }
          return data;
        });
      });
    }

    function setCheckoutButtonState() {
      if (checkoutSpinner) checkoutSpinner.hidden = !isSubmitting;
      if (checkoutLabel) checkoutLabel.textContent = isSubmitting ? "Processing..." : "Checkout & Pay";
      if (checkoutBtn) checkoutBtn.disabled = isSubmitting || !state.agreeTerms;
    }

    // Resolves which Shopify variant will actually be added to the cart for
    // the currently selected package: the package's own linked variant if
    // the admin set one, otherwise this section's page-product variant (if
    // any). Used both to validate before checkout and to build the cart request.
    function resolveTargetVariantId() {
      var mappedPackage = packageProductMap[state.selectedPackage];
      return (mappedPackage && mappedPackage.variantId) ? mappedPackage.variantId : variantId;
    }

    function submitOrder() {
      if (!state.agreeTerms) {
        showToast({ variant: "warning", title: "Required", message: "Please agree to the Terms and Conditions." });
        return;
      }
      if (!resolveTargetVariantId()) {
        showToast({ variant: "error", title: "Configuration Error", message: "The selected package isn't linked to a Shopify product yet. Please contact support." });
        return;
      }

      isSubmitting = true;
      setCheckoutButtonState();

      // Generate the public-facing Music ID once, used both for the DB record
      // (so we can look up the real taskId later) and the cart line item
      // (so the real taskId is never exposed to the browser).
      var musicId = generateMusicId();

      function waitForAudioThenSubmit() {
        return new Promise(function (resolve) {
          if (isAudioReady || !state.taskId) {
            resolve();
            return;
          }
          var attempts = 0;
          var maxAttempts = 30;
          var interval = setInterval(function () {
            attempts++;
            fetch(apiUrl("/api/suno/status?taskId=" + encodeURIComponent(state.taskId) + "&type=music"))
              .then(function (res) { return res.json(); })
              .then(function (data) {
                if (data.isFullySaved || attempts >= maxAttempts) {
                  clearInterval(interval);
                  resolve();
                }
              })
              .catch(function (e) {
                console.error("Silent polling error:", e);
                if (attempts >= maxAttempts) {
                  clearInterval(interval);
                  resolve();
                }
              });
          }, 2000);
        });
      }

      waitForAudioThenSubmit()
        .then(function () {
          // 1) Save/backup the order in our own DB (existing behavior, unchanged)
          //    musicId is stored here so we can map it back to the real taskId later.
          return fetch(apiUrl("/api/orders"), {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              formData: state,
              musicTracks: musicTracks,
              taskId: state.taskId,
              musicId: musicId,
              productId: productId,
              variantId: variantId
            })
          });
        })
        .then(function (res) {
          return res.json().then(function (data) { return { ok: res.ok, data: data }; });
        })
        .then(function (wrapped) {
          if (!wrapped.ok) throw new Error(wrapped.data.error || "Failed to save order");
          // 2) Add the product to the Shopify cart with all wizard answers attached
          //    (the real taskId is NOT included — only the opaque Music ID)
          return addToShopifyCart(musicId);
        })
        .then(function () {
          clearProgress();
          showToast({ variant: "success", title: "Added to cart!", message: "Your custom song has been added to your cart. Redirecting..." });
          setTimeout(function () {
            window.location.href = "/checkout";
          }, 900);
        })
        .catch(function (err) {
          showToast({ variant: "error", title: "Error", message: err.message });
        })
        .finally(function () {
          isSubmitting = false;
          setCheckoutButtonState();
        });
    }

    function handleNext() {
      if (!validateStep(state.currentStep)) return;
      if (state.currentStep < TOTAL_STEPS) {
        goToStep(state.currentStep + 1);
      }
    }

    function handleBack() {
      if (state.currentStep <= 1) return;
      // Step 7 is just the "generating..." screen, not a real answerable
      // step — going back from step 8 should return the user to the music
      // style selections (step 6), not flash through step 7 again.
      var target = state.currentStep - 1;
      if (target === 7) target = 6;
      goToStep(target);
    }

    // ---- Event wiring ----
    root.addEventListener("input", function (e) {
      var field = e.target.getAttribute && e.target.getAttribute("data-csb-field");
      if (!field) return;


      if (field === "customOccasion") {
        state.customOccasion = e.target.value;
        state.occasion = e.target.value;
        saveProgress();
        return;
      }
      if (e.target.type === "checkbox") {
        state[field] = e.target.checked;
      } else {
        state[field] = e.target.value;
      }

      // Keep the "Generate AI Lyrics" button's disabled/enabled state in sync
      // as the user types the story (it depends on state.storyText).
      if (field === "storyText") {
        setLyricsButtonState();
      }

      // Update summary totals when rush order changes
      if (field === "rushOrder") {
        renderSummary();
      }
      if (field === "agreeTerms") {
        setCheckoutButtonState();
      }

      // Keep the Step 5 lock icon in sync as the user types their email.
      if (field === "email") {
        setEmailLockState();
      }

      saveProgress();
    });

    $$("[data-csb-method]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        state.creationMethod = btn.getAttribute("data-csb-method");
        renderMethodCards();
        saveProgress();
      });
    });

    var generateBtn = $("[data-csb-generate-lyrics]");
    if (generateBtn) generateBtn.addEventListener("click", generateLyrics);
    var generateAgainBtn = $("[data-csb-generate-lyrics-again]");
    if (generateAgainBtn) generateAgainBtn.addEventListener("click", generateLyrics);

    var genBackBtn = $("[data-csb-gen-back]");
    if (genBackBtn) {
      genBackBtn.addEventListener("click", function () {
        if (generationErrorIsTimeout) {
          retryAfterTimeout();
        } else {
          goToStep(6);
        }
      });
    }

    var regenSongsBtn = $("[data-csb-regen-songs]");
    if (regenSongsBtn) {
      regenSongsBtn.addEventListener("click", function () {
        musicTracks = [];
        generationError = "";
        generationErrorIsTimeout = false;
        goToStep(7);
      });
    }


    var addRecBtn = $("[data-csb-add-recipient]");
    if (addRecBtn) {
      addRecBtn.addEventListener("click", function () {
        state.recipients.push({ name: "", pronunciationMode: "Original", pronunciation: "" });
        renderRecipients();
        saveProgress();
      });
    }

    if (backBtn) backBtn.addEventListener("click", handleBack);
    if (nextBtn) nextBtn.addEventListener("click", handleNext);
    if (checkoutBtn) checkoutBtn.addEventListener("click", submitOrder);

    // Resumes anything that was still generating when the user left. Called
    // once at startup, after any saved state has been restored into `state`.
    function resumeInFlightGeneration(saved) {
      if (!saved) return;

      // A lyrics request was in flight — poll it instead of losing it.
      if (saved.lyricsLoading && saved.pendingLyricsTaskId && !state.lyrics) {
        pendingLyricsTaskId = saved.pendingLyricsTaskId;
        lyricsLoading = true;
        lyricsError = "";
        setLyricsButtonState();
        pollStatus(pendingLyricsTaskId, "lyrics", null)
          .then(function (result) {
            if (result.allVariations && result.allVariations.length > 0) {
              lyricsVariations = result.allVariations;
              selectedLyricsIndex = 0;
              state.lyrics = result.allVariations[0].text;
              renderLyricsVariations();
            } else if (result.lyrics) {
              state.lyrics = result.lyrics;
              syncFieldInputs();
            }
          })
          .catch(function (err) {
            lyricsError = err.message;
          })
          .finally(function () {
            lyricsLoading = false;
            pendingLyricsTaskId = null;
            setLyricsButtonState();
            saveProgress();
          });
      }

      // Left the page while music was being composed (step 7) — resume
      // checking status rather than restarting the wizard from scratch.
      if (state.currentStep === 7 && musicTracks.length === 0) {
        if (state.taskId) {
          retryAfterTimeout();
        } else {
          startMusicGeneration();
        }
      }

      // Music finished but was still being saved server-side — keep checking.
      if (saved.backgroundPollingTaskId && !saved.isAudioReady) {
        startBackgroundPolling(saved.backgroundPollingTaskId);
      }
    }

    // ---- Init ----
    if (!backendUrl || backendUrl.indexOf("YOUR_BACKEND_URL") !== -1) {
      console.warn("[Custom Song Builder] Backend URL is not configured. Set it in the section settings (theme editor) before going live.");
    }
    if (!variantId) {
      console.info("[Custom Song Builder] No page product detected — that's fine as long as every package is linked to a Shopify product/variant in the admin panel.");
    }

    // Handle magic link resume from email (Overrides local storage)
    var urlParams = new URLSearchParams(window.location.search);
    var resumeOrder = urlParams.get("resumeOrder");

    if (resumeOrder) {
      // Remove resumeOrder from URL so it doesn't persist on refresh
      var newUrl = window.location.protocol + "//" + window.location.host + window.location.pathname;
      window.history.replaceState({ path: newUrl }, '', newUrl);

      fetch(apiUrl("/api/orders/" + encodeURIComponent(resumeOrder)))
        .then(function (res) { return res.json(); })
        .then(function (data) {
          if (data.success && data.order) {
            var order = data.order;

            // Check if already purchased
            if (["paid", "completed", "refunded", "partially_refunded", "authorized"].indexOf(order.status) !== -1) {
              var topHeader = root.querySelector('.csb-card-top-header');
              var progressWrap = root.querySelector('[data-csb-progress-wrap]');
              var stepsContainer = root.querySelector('.csb-steps-container');
              var navWrap = root.querySelector('[data-csb-nav]');
              var purchasedView = root.querySelector('[data-csb-purchased-view]');

              if (topHeader) topHeader.hidden = true;
              if (progressWrap) progressWrap.hidden = true;
              if (stepsContainer) stepsContainer.hidden = true;
              if (navWrap) navWrap.hidden = true;
              if (purchasedView) purchasedView.hidden = false;

              showToast({ variant: "info", title: "Already Purchased", message: "You have already purchased this custom song." });
              return;
            }

            // Override state with fetched data
            state.occasion = order.occasion || "";
            state.recipients = order.recipients || [{ name: "", pronunciationMode: "Original", pronunciation: "" }];
            state.genre = order.genre || "";
            state.voice = order.voice || "";
            state.mood = order.mood || "";
            state.lyrics = order.lyrics || "";
            state.email = order.email || "";
            state.taskId = order.taskId || "";

            // Set music tracks
            if (order.musicTracks && order.musicTracks.length > 0) {
              musicTracks = order.musicTracks;
              isAudioReady = true;
            }

            // Start user at Step 8 to select their song
            state.currentStep = 8;

            // Re-render and save to local storage
            fetchOptions();
            render();
            renderLyricsVariations();
            renderTracks();
            setLyricsButtonState();
            setCheckoutButtonState();
          } else {
            console.error("[Custom Song Builder] Could not resume order:", data.error);
            fallbackInit();
          }
        })
        .catch(function (err) {
          console.error("[Custom Song Builder] Failed to fetch resumed order:", err);
          fallbackInit();
        });
    } else {
      fallbackInit();
    }

    function fallbackInit() {
      // Restore any progress saved before a reload / tab close.
      var savedProgress = loadProgress();
      if (savedProgress && savedProgress.state) {
        Object.keys(state).forEach(function (key) {
          if (Object.prototype.hasOwnProperty.call(savedProgress.state, key)) {
            state[key] = savedProgress.state[key];
          }
        });
        lyricsVariations = savedProgress.lyricsVariations || [];
        selectedLyricsIndex = (typeof savedProgress.selectedLyricsIndex === "number") ? savedProgress.selectedLyricsIndex : null;
        musicTracks = savedProgress.musicTracks || [];
        isAudioReady = (typeof savedProgress.isAudioReady === "boolean") ? savedProgress.isAudioReady : true;
      }

      fetchOptions();
      render();
      renderLyricsVariations();
      renderTracks();
      setLyricsButtonState();
      setCheckoutButtonState();
      resumeInFlightGeneration(savedProgress);
    }
  }

  function initAll() {
    document.querySelectorAll(".csb-wrapper").forEach(function (root) {
      if (root.dataset.csbInitialized) return;
      root.dataset.csbInitialized = "true";
      initSection(root);
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initAll);
  } else {
    initAll();
  }

  // Re-init when sections are added/removed in the theme editor
  document.addEventListener("shopify:section:load", function (e) {
    var root = e.target.querySelector ? e.target.querySelector(".csb-wrapper") : null;
    if (root && !root.dataset.csbInitialized) {
      root.dataset.csbInitialized = "true";
      initSection(root);
    }
  });
})();