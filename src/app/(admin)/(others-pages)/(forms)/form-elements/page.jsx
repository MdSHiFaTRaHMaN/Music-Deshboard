"use client";
import React, { useState, useEffect } from "react";
import PageBreadcrumb from "@/components/common/PageBreadCrumb";
import Button from "@/components/ui/button/Button";
import Input from "@/components/form/input/InputField";
import { useToast } from "@/components/ui/toast/Toast";

export default function FormElements() {
  const showToast = useToast();
  const [options, setOptions] = useState({
    occasions: [],
    genres: [],
    voices: [],
    moods: [],
    languages: [],
    packages: [],
  });
  
  const [initialOptions, setInitialOptions] = useState(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [shopifyProducts, setShopifyProducts] = useState([]);
  const [fetchingProducts, setFetchingProducts] = useState(false);

  // For adding new simple texts
  const [newInputs, setNewInputs] = useState({
    occasions: "",
    genres: "",
    voices: "",
    moods: "",
    languages: "",
  });

  const [draggedSimple, setDraggedSimple] = useState({ category: null, index: null });
  const [draggedPkg, setDraggedPkg] = useState(null);
  const [draggablePkgId, setDraggablePkgId] = useState(null);
  
  const handleSimpleDragStart = (category, index) => {
    setDraggedSimple({ category, index });
  };
  const handleSimpleDrop = (category, index) => {
    if (draggedSimple.category === category && draggedSimple.index !== null && draggedSimple.index !== index) {
      setOptions((prev) => {
        const arr = [...prev[category]];
        const draggedItem = arr[draggedSimple.index];
        arr.splice(draggedSimple.index, 1);
        arr.splice(index, 0, draggedItem);
        return { ...prev, [category]: arr };
      });
    }
    setDraggedSimple({ category: null, index: null });
  };

  // Calculate if options have changed
  const hasChanged = JSON.stringify(options) !== JSON.stringify(initialOptions);

  useEffect(() => {
    const fetchOptions = async () => {
      try {
        const res = await fetch("/api/form-options");
        const json = await res.json();
        if (json.success && json.data) {
          setOptions(json.data);
          setInitialOptions(json.data);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchOptions();
  }, []);

  useEffect(() => {
    const fetchProducts = async () => {
      setFetchingProducts(true);
      try {
        const res = await fetch("/api/shopify/products");
        const json = await res.json();
        if (json.success && json.products) {
          setShopifyProducts(json.products);
        }
      } catch (err) {
        console.error("Error fetching shopify products", err);
      } finally {
        setFetchingProducts(false);
      }
    };
    fetchProducts();
  }, []);

  const handleSave = async () => {
    if (!hasChanged) return;
    setSaving(true);
    try {
      const res = await fetch("/api/form-options", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(options),
      });
      const json = await res.json();
      if (json.success) {
        setInitialOptions(json.data);
        showToast({ variant: "success", title: "Saved!", message: "Options saved successfully." });
      } else {
        showToast({ variant: "error", title: "Failed", message: "Failed to save options. Please try again." });
      }
    } catch (err) {
      showToast({ variant: "error", title: "Error", message: "Could not connect to server." });
    } finally {
      setSaving(false);
    }
  };

  const handleAddSimple = (category) => {
    const val = newInputs[category].trim();
    if (!val) return;
    setOptions((prev) => ({
      ...prev,
      [category]: [...prev[category], val],
    }));
    setNewInputs((prev) => ({ ...prev, [category]: "" }));
  };

  const handleRemoveSimple = (category, index) => {
    setOptions((prev) => {
      const arr = [...prev[category]];
      arr.splice(index, 1);
      return { ...prev, [category]: arr };
    });
  };

  const handleAddPackage = () => {
    const newPkg = {
      id: "pkg_" + Date.now(),
      title: "New Package",
      price: "€0.00",
      tagline: "",
      features: ["Feature 1"],
      image: "https://placehold.co/400x400/f8f9fa/101828?text=New+Package",
      shopifyProductId: "",
      shopifyVariantId: "",
    };
    setOptions((prev) => ({
      ...prev,
      packages: [...prev.packages, newPkg],
    }));
  };

  const handleRemovePackage = (index) => {
    setOptions((prev) => {
      const arr = [...prev.packages];
      arr.splice(index, 1);
      return { ...prev, packages: arr };
    });
    showToast({ variant: "warning", title: "Package Removed", message: "Don't forget to save your changes." });
  };

  const handlePackageChange = (index, field, value) => {
    setOptions((prev) => {
      const arr = [...prev.packages];
      arr[index] = { ...arr[index], [field]: value };
      return { ...prev, packages: arr };
    });
  };

  const handlePackageFeatureChange = (pkgIndex, featureIndex, value) => {
    setOptions((prev) => {
      const arr = [...prev.packages];
      const features = [...arr[pkgIndex].features];
      features[featureIndex] = value;
      arr[pkgIndex] = { ...arr[pkgIndex], features };
      return { ...prev, packages: arr };
    });
  };

  const handleAddPackageFeature = (pkgIndex) => {
    setOptions((prev) => {
      const arr = [...prev.packages];
      arr[pkgIndex] = { ...arr[pkgIndex], features: [...arr[pkgIndex].features, "New Feature"] };
      return { ...prev, packages: arr };
    });
  };

  const handleRemovePackageFeature = (pkgIndex, featureIndex) => {
    setOptions((prev) => {
      const arr = [...prev.packages];
      const features = [...arr[pkgIndex].features];
      features.splice(featureIndex, 1);
      arr[pkgIndex] = { ...arr[pkgIndex], features };
      return { ...prev, packages: arr };
    });
  };

  if (loading) return <div className="p-10 text-center">Loading options...</div>;

  const renderSimpleManager = (title, category) => (
    <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03]">
      <h3 className="mb-4 text-lg font-semibold text-gray-800 dark:text-white/90">{title}</h3>
      <div className="mb-4 flex flex-wrap gap-2">
        {options[category].map((item, idx) => (
          <div 
            key={idx} 
            draggable
            onDragStart={() => handleSimpleDragStart(category, idx)}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => { e.preventDefault(); handleSimpleDrop(category, idx); }}
            className="flex items-center gap-1 rounded-full bg-brand-50 px-3 py-1 text-sm text-brand-500 dark:bg-brand-500/10 dark:text-brand-400 cursor-move border border-transparent hover:border-brand-500 transition-colors"
          >
            <span>{item}</span>
            <button
              onClick={() => handleRemoveSimple(category, idx)}
              className="ml-1 rounded-full p-0.5 text-brand-400 hover:bg-brand-100 hover:text-brand-600 dark:hover:bg-brand-500/20"
            >
              <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>
        ))}
      </div>
      <div className="flex gap-2">
        <Input
          type="text"
          value={newInputs[category]}
          onChange={(e) => setNewInputs((prev) => ({ ...prev, [category]: e.target.value }))}
          placeholder={`Add new ${title.toLowerCase()}`}
        />
        <Button size="sm" onClick={() => handleAddSimple(category)}>Add</Button>
      </div>
    </div>
  );

  return (
    <div>
      <PageBreadcrumb pageTitle="Generate Form Options" />
      
      <div className="mb-6 flex justify-between items-center">
        <p className="text-gray-500 dark:text-gray-400">
          Manage the selectable options and packages for the Generate Music page.
        </p>
        <div className="flex gap-2">
          {hasChanged && (
            <Button variant="outline" onClick={() => setOptions(initialOptions)}>
              Discard Changes
            </Button>
          )}
          <Button onClick={handleSave} disabled={saving || !hasChanged}>
            {saving ? "Saving..." : "Save Changes"}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2 mb-6">
        {renderSimpleManager("Occasions", "occasions")}
        {renderSimpleManager("Genres", "genres")}
        {renderSimpleManager("Voices", "voices")}
        {renderSimpleManager("Moods", "moods")}
        {renderSimpleManager("Languages", "languages")}
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03]">
        <div className="mb-4 flex justify-between items-center">
          <h3 className="text-lg font-semibold text-gray-800 dark:text-white/90">Packages</h3>
          <Button size="sm" variant="outline" onClick={handleAddPackage}>+ Add Package</Button>
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
          {options.packages.map((pkg, pIdx) => (
            <div 
              key={pIdx} 
              draggable={draggablePkgId === pIdx}
              onDragStart={() => setDraggedPkg(pIdx)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                if (draggedPkg !== null && draggedPkg !== pIdx) {
                  setOptions((prev) => {
                    const arr = [...prev.packages];
                    const draggedItem = arr[draggedPkg];
                    arr.splice(draggedPkg, 1);
                    arr.splice(pIdx, 0, draggedItem);
                    return { ...prev, packages: arr };
                  });
                }
                setDraggedPkg(null);
              }}
              className="rounded-xl border border-gray-200 p-4 dark:border-gray-700 hover:border-brand-500 transition-colors bg-white dark:bg-gray-800"
            >
              <div className="mb-3 flex justify-between items-center">
                <span 
                  className="text-gray-400 cursor-move select-none" 
                  title="Drag to reorder"
                  onMouseEnter={() => setDraggablePkgId(pIdx)}
                  onMouseLeave={() => setDraggablePkgId(null)}
                >
                  ⣿ Reorder
                </span>
                <button onClick={() => handleRemovePackage(pIdx)} className="text-red-500 hover:text-red-700 text-sm font-semibold">
                  Remove Package
                </button>
              </div>
              
              <div className="space-y-3">
                <div>
                  <label className="text-xs text-gray-500">ID (Used internally)</label>
                  <Input type="text" value={pkg.id} onChange={(e) => handlePackageChange(pIdx, "id", e.target.value)} />
                </div>
                <div>
                  <label className="text-xs text-gray-500">Title</label>
                  <Input type="text" value={pkg.title} onChange={(e) => handlePackageChange(pIdx, "title", e.target.value)} />
                </div>
                <div>
                  <label className="text-xs text-gray-500">Price</label>
                  <div className="relative flex items-center">
                    <span className="absolute left-3 text-gray-500 text-sm select-none pointer-events-none">€</span>
                    <Input
                      type="text"
                      className="pl-7"
                      value={pkg.price.replace(/^€/, "")}
                      onChange={(e) => handlePackageChange(pIdx, "price", "€" + e.target.value.replace(/^€/, ""))}
                    />
                  </div>
                </div>
                <div>
                  <label className="text-xs text-gray-500">Compare At Price (Optional)</label>
                  <div className="relative flex items-center">
                    <span className="absolute left-3 text-gray-500 text-sm select-none pointer-events-none">€</span>
                    <Input
                      type="text"
                      className="pl-7"
                      placeholder="49.95"
                      value={(pkg.compareAtPrice || "").replace(/^€/, "")}
                      onChange={(e) => handlePackageChange(pIdx, "compareAtPrice", e.target.value ? "€" + e.target.value.replace(/^€/, "") : "")}
                    />
                  </div>
                </div>
                <div>
                  <label className="text-xs text-gray-500">Tagline (Optional)</label>
                  <Input type="text" value={pkg.tagline || ""} onChange={(e) => handlePackageChange(pIdx, "tagline", e.target.value)} />
                </div>


                <div className="rounded-lg border border-dashed border-gray-300 p-3 dark:border-gray-600">
                  <div className="flex justify-between items-center mb-2">
                    <p className="text-xs font-semibold text-gray-600 dark:text-gray-300">Shopify Linking (optional)</p>
                    {fetchingProducts && <span className="text-xs text-brand-500">Loading products...</span>}
                  </div>
                  <p className="mb-3 text-xs text-gray-400">
                    If set, choosing this package on the storefront adds this exact product/variant to the cart as its own line item, with its own price — instead of just a text label on the base song product.
                  </p>
                  
                  <div className="mb-4">
                    <label className="text-xs text-gray-500 block mb-1">Select Shopify Product</label>
                    <select 
                      className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-800 outline-none focus:border-brand-500 dark:border-gray-800 dark:bg-white/5 dark:text-white/90"
                      onChange={(e) => {
                        const selectedVal = e.target.value;
                        if (!selectedVal) {
                          handlePackageChange(pIdx, "shopifyProductId", "");
                          handlePackageChange(pIdx, "shopifyVariantId", "");
                          return;
                        }
                        const prod = shopifyProducts.find(p => p.id === selectedVal);
                        if (prod) {
                          handlePackageChange(pIdx, "shopifyProductId", prod.productId);
                          handlePackageChange(pIdx, "shopifyVariantId", prod.variantId);
                          handlePackageChange(pIdx, "title", prod.displayTitle);
                          if (prod.price) handlePackageChange(pIdx, "price", `€${prod.price}`);
                          handlePackageChange(pIdx, "image", prod.image || "");
                        }
                      }}
                      value={shopifyProducts.find(p => p.productId === pkg.shopifyProductId && p.variantId === pkg.shopifyVariantId)?.id || ""}
                    >
                      <option value="">-- None --</option>
                      {shopifyProducts.map(prod => (
                        <option key={prod.id} value={prod.id}>
                          {prod.displayTitle}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Visual indication of selected product */}
                  {pkg.shopifyProductId && (
                    <div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-gray-100 dark:border-gray-700">
                      {pkg.image && (
                        <img src={pkg.image} alt={pkg.title} className="w-12 h-12 rounded object-cover border border-gray-200 dark:border-gray-600" />
                      )}
                      <div>
                        <p className="text-sm font-medium text-gray-800 dark:text-gray-200">{pkg.title}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">Linked to Shopify Variant: {pkg.shopifyVariantId}</p>
                      </div>
                    </div>
                  )}
                </div>
                
                <div className="pt-2">
                  <label className="text-xs text-gray-500 mb-1 block">Features</label>
                  {pkg.features.map((feat, fIdx) => (
                    <div key={fIdx} className="flex gap-2 mb-2">
                      <Input type="text" value={feat} onChange={(e) => handlePackageFeatureChange(pIdx, fIdx, e.target.value)} />
                      <button onClick={() => handleRemovePackageFeature(pIdx, fIdx)} className="text-red-500 hover:text-red-700 px-2">X</button>
                    </div>
                  ))}
                  <button onClick={() => handleAddPackageFeature(pIdx)} className="text-xs text-brand-500 font-semibold mt-1">+ Add Feature</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
      
      <div className="mt-6 flex justify-end gap-2">
        {hasChanged && (
          <Button variant="outline" onClick={() => setOptions(initialOptions)}>
            Discard Changes
          </Button>
        )}
        <Button onClick={handleSave} disabled={saving || !hasChanged}>
          {saving ? "Saving..." : "Save All Changes"}
        </Button>
      </div>
    </div>
  );
}