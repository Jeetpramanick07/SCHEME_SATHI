import React, { useState, useEffect, useRef } from "react";
import { useTranslation } from "../../context/I18nContext";
import { apiClient } from "../../api/client";
import { AudioReadButton } from "../common/AudioReadButton";
import { Phone, MapPin, Search, Clock, Mail, ExternalLink } from "lucide-react";
import type { HelpCentre } from "../../api/types";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// Fix standard Leaflet default marker icons in bundlers
delete (L.Icon.Default.prototype as unknown as { _getIconUrl?: unknown })._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

export const HelpCentresView: React.FC = () => {
  const { t } = useTranslation();
  const [centres, setCentres] = useState<HelpCentre[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDistrict, setSelectedDistrict] = useState("Nagpur");
  const [searchQuery, setSearchQuery] = useState("");
  const [activeCentre, setActiveCentre] = useState<HelpCentre | null>(null);

  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersGroupRef = useRef<L.LayerGroup | null>(null);

  useEffect(() => {
    let isMounted = true;
    async function loadCentres() {
      try {
        setLoading(true);
        const data = await apiClient.getHelpCentres({
          district: selectedDistrict !== "all" ? selectedDistrict : undefined,
        });
        if (isMounted) {
          setCentres(data);
          if (data.length > 0) setActiveCentre(data[0]);
        }
      } catch (err) {
        console.error("Failed to load help centres", err);
      } finally {
        if (isMounted) setLoading(false);
      }
    }
    loadCentres();
    return () => {
      isMounted = false;
    };
  }, [selectedDistrict]);

  const filteredCentres = centres.filter((c) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      c.centre_name.toLowerCase().includes(q) ||
      c.centre_type.toLowerCase().includes(q) ||
      (c.taluka && c.taluka.toLowerCase().includes(q)) ||
      (c.complete_address && c.complete_address.toLowerCase().includes(q))
    );
  });

  const centresWithCoords = filteredCentres.filter(
    (c) =>
      typeof c.latitude === "number" &&
      typeof c.longitude === "number" &&
      !isNaN(c.latitude) &&
      !isNaN(c.longitude)
  );
  const hasCoordinates = centresWithCoords.length > 0;

  // Group centres by taluka for directory view when coords absent
  const talukaGroups = filteredCentres.reduce<Record<string, HelpCentre[]>>((acc, centre) => {
    const tName = centre.taluka || "Nagpur City / Urban";
    if (!acc[tName]) acc[tName] = [];
    acc[tName].push(centre);
    return acc;
  }, {});

  // Initialize and update Leaflet Map ONLY when valid coordinates exist
  useEffect(() => {
    if (!hasCoordinates || !mapContainerRef.current) {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
        markersGroupRef.current = null;
      }
      return;
    }

    if (!mapInstanceRef.current) {
      const firstPoint: [number, number] = [
        centresWithCoords[0].latitude!,
        centresWithCoords[0].longitude!,
      ];
      const map = L.map(mapContainerRef.current).setView(firstPoint, 11);
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 18,
      }).addTo(map);

      const markersGroup = L.layerGroup().addTo(map);
      mapInstanceRef.current = map;
      markersGroupRef.current = markersGroup;
    }

    const markersGroup = markersGroupRef.current;
    if (markersGroup) {
      markersGroup.clearLayers();
      const validPoints: [number, number][] = [];

      centresWithCoords.forEach((centre) => {
        const marker = L.marker([centre.latitude!, centre.longitude!]);
        marker.bindPopup(
          `<b>${centre.centre_name}</b><br/>${centre.centre_type}<br/>${centre.phone || ""}`
        );
        marker.on("click", () => setActiveCentre(centre));
        markersGroup.addLayer(marker);
        validPoints.push([centre.latitude!, centre.longitude!]);
      });

      if (validPoints.length > 0 && mapInstanceRef.current) {
        mapInstanceRef.current.fitBounds(L.latLngBounds(validPoints), { padding: [30, 30] });
      }
    }
  }, [hasCoordinates, centresWithCoords]);

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b pb-6 dark:border-slate-800">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-black text-slate-900 dark:text-white sm:text-3xl">
              {t("help_centres_title")}
            </h1>
            <AudioReadButton text={`${t("help_centres_title")}. ${t("help_centres_subtitle")}`} />
          </div>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            {t("help_centres_subtitle")}
          </p>
        </div>

        {/* District Filter */}
        <div className="flex items-center gap-2">
          <label className="text-xs font-bold uppercase text-slate-500">
            {t("district")}:
          </label>
          <select
            value={selectedDistrict}
            onChange={(e) => setSelectedDistrict(e.target.value)}
            className="min-h-[44px] rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-sm font-semibold text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
          >
            <option value="Nagpur">Nagpur</option>
            <option value="Gadchiroli">Gadchiroli</option>
            <option value="all">{t("all_districts")}</option>
          </select>
        </div>
      </div>

      {/* Search Input */}
      <div className="mt-6">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t("search_help_centre_placeholder")}
            className="min-h-[48px] w-full rounded-xl border border-slate-300 pl-10 pr-4 text-sm text-slate-900 placeholder-slate-400 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
          />
        </div>
      </div>

      {/* Map and List Grid */}
      <div className="mt-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Centres List */}
        <div className="lg:col-span-6 space-y-4 max-h-[600px] overflow-y-auto pr-2">
          {loading && (
            <div className="py-12 text-center text-sm text-slate-500">
              {t("loading_centres")}...
            </div>
          )}

          {!loading && filteredCentres.length === 0 && (
            <div className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500 dark:border-slate-800">
              {t("no_help_centres_found")}
            </div>
          )}

          {filteredCentres.map((centre) => {
            const isSelected = activeCentre?.help_centre_id === centre.help_centre_id;
            return (
              <div
                key={centre.help_centre_id}
                onClick={() => {
                  setActiveCentre(centre);
                  if (centre.latitude && centre.longitude && mapInstanceRef.current) {
                    mapInstanceRef.current.setView([centre.latitude, centre.longitude], 13);
                  }
                }}
                className={`rounded-xl border p-4 cursor-pointer transition ${
                  isSelected
                    ? "border-emerald-500 bg-emerald-50/60 shadow-md dark:border-emerald-700 dark:bg-emerald-950/20"
                    : "border-slate-200 bg-white hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900"
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-bold text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                      {centre.centre_type}
                    </span>
                    <h3 className="mt-1 text-base font-bold text-slate-900 dark:text-white">
                      {centre.centre_name}
                    </h3>
                  </div>
                </div>

                <p className="mt-1.5 text-xs text-slate-600 dark:text-slate-400">
                  {centre.complete_address || `${centre.taluka || ""}, ${centre.district}`}
                </p>

                {centre.working_hours && (
                  <p className="mt-1 flex items-center gap-1.5 text-xs text-slate-500">
                    <Clock className="h-3.5 w-3.5" />
                    {centre.working_hours}
                  </p>
                )}

                {/* Direct Dial Call Button */}
                <div className="mt-3 flex items-center gap-3 border-t border-slate-100 pt-3 dark:border-slate-800">
                  {centre.phone ? (
                    <a
                      href={`tel:${centre.phone}`}
                      onClick={(e) => e.stopPropagation()}
                      className="inline-flex min-h-[44px] items-center gap-1.5 rounded-lg bg-emerald-600 px-3.5 py-1.5 text-xs font-bold text-white shadow hover:bg-emerald-700 active:scale-95 transition"
                    >
                      <Phone className="h-3.5 w-3.5" />
                      <span>{t("call")}: {centre.phone}</span>
                    </a>
                  ) : (
                    <span className="text-xs text-slate-400">{t("no_phone_listed")}</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Map Container (only when coordinates exist) or Taluka List */}
        {hasCoordinates ? (
          <div className="lg:col-span-6 h-[400px] lg:h-[600px] rounded-2xl overflow-hidden border border-slate-200 shadow-sm dark:border-slate-800">
            <div ref={mapContainerRef} className="h-full w-full z-10" />
          </div>
        ) : (
          <div className="lg:col-span-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900 space-y-4">
            <div className="flex items-center justify-between border-b pb-3 dark:border-slate-800">
              <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <MapPin className="h-5 w-5 text-emerald-600" />
                <span>तालुका यादी / Taluka Directory</span>
              </h2>
              <span className="text-xs bg-slate-100 dark:bg-slate-800 px-2.5 py-1 rounded-full font-bold text-slate-600 dark:text-slate-300">
                {Object.keys(talukaGroups).length} Talukas
              </span>
            </div>

            <p className="text-xs text-slate-500">
              No geographical coordinates found for map rendering. Below is the directory of centres grouped by taluka.
            </p>

            <div className="space-y-4 max-h-[500px] overflow-y-auto pr-1">
              {Object.entries(talukaGroups).map(([talukaName, centreList]) => (
                <div
                  key={talukaName}
                  className="rounded-xl border border-slate-200 bg-slate-50 p-3.5 space-y-2 dark:border-slate-800 dark:bg-slate-800/40"
                >
                  <div className="flex items-center justify-between">
                    <h3 className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-emerald-500" />
                      <span>{talukaName}</span>
                    </h3>
                    <span className="text-[11px] font-bold text-slate-500">
                      {centreList.length} Centre{centreList.length > 1 ? "s" : ""}
                    </span>
                  </div>

                  <div className="space-y-1.5 text-xs text-slate-600 dark:text-slate-300">
                    {centreList.map((c) => (
                      <div
                        key={c.help_centre_id}
                        className="p-2 rounded-lg bg-white border border-slate-200/80 dark:bg-slate-900 dark:border-slate-800 flex items-start justify-between gap-2"
                      >
                        <div>
                          <p className="font-bold text-slate-800 dark:text-slate-200">{c.centre_name}</p>
                          <p className="text-[11px] text-slate-500">
                            {c.centre_type} • {c.complete_address || c.district}
                          </p>
                        </div>
                        {c.phone && (
                          <a
                            href={`tel:${c.phone}`}
                            className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-1 rounded-md border border-emerald-200 flex-shrink-0"
                          >
                            <Phone className="h-3 w-3" />
                            <span>{c.phone}</span>
                          </a>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
