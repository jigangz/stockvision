import { lazy, Suspense } from 'react';
import styles from './MainLayout.module.css';
import { TopNav } from './TopNav';
import { StatusBar } from './StatusBar';
import { ChartContainer } from '@/components/chart/ChartContainer';
import { InfoPanel } from './InfoPanel';
import { WatchlistSidebar } from '@/components/chart/WatchlistSidebar';
import { StockInfoPanel } from '@/components/chart/StockInfoPanel';
import { ApiHealthToast } from '@/components/ui/ApiHealthToast';
import { UpdateChecker } from '@/components/ui/UpdateChecker';
import { KeyboardWizard } from '@/components/chart/KeyboardWizard';
import { useChartStore } from '@/stores/chartStore';

const MarketTable = lazy(() => import('@/components/market/MarketTable'));

export function MainLayout() {
  const activeView = useChartStore((s) => s.activeView);

  return (
    <div className={styles.container}>
      <TopNav />
      <div className={styles.main}>
        {activeView === 'chart' ? (
          <>
            <WatchlistSidebar />
            <div className={styles.chartArea}>
              <ChartContainer />
            </div>
            <div className={styles.infoPanel}>
              <StockInfoPanel />
              <InfoPanel />
            </div>
          </>
        ) : (
          <div className={styles.marketArea}>
            <Suspense fallback={<div className={styles.loading}>Loading...</div>}>
              <MarketTable />
            </Suspense>
          </div>
        )}
      </div>
      <StatusBar />
      <ApiHealthToast />
      <UpdateChecker />
      <KeyboardWizard anyDialogOpen={false} />
    </div>
  );
}
