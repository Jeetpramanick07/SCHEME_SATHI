import React from "react";
import { useHousehold } from "../../context/HouseholdContext";
import { useTranslation } from "../../context/I18nContext";
import { WifiOff, RefreshCw } from "lucide-react";
import { offlineStorage } from "../../lib/offline-storage";

export const OfflineBanner: React.FC = () => {
  const { isOffline, isSyncing } = useHousehold();
  const { t } = useTranslation();

  if (!isOffline && !isSyncing) return null;

  const handleManualSync = async () => {
    await offlineStorage.flushQueue();
  };

  return (
    <div className="w-full bg-amber-500 text-amber-950 px-4 py-2 text-xs md:text-sm font-semibold flex items-center justify-between shadow-inner">
      <div className="flex items-center gap-2 max-w-4xl mx-auto w-full justify-between">
        <div className="flex items-center gap-2">
          {isSyncing ? (
            <RefreshCw className="w-4 h-4 animate-spin text-amber-900" />
          ) : (
            <WifiOff className="w-4 h-4 text-amber-900" />
          )}
          <span>{isSyncing ? t("offline.syncing") : t("offline.banner")}</span>
        </div>
        {!isSyncing && (
          <button
            onClick={handleManualSync}
            className="px-2.5 py-1 bg-amber-900 text-white rounded-lg text-xs font-bold hover:bg-amber-950 transition-colors"
          >
            Sync Now
          </button>
        )}
      </div>
    </div>
  );
};
