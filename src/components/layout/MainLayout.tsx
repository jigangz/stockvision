import styles from './MainLayout.module.css';
import { TopNav } from './TopNav';
import { StatusBar } from './StatusBar';
import { ChartContainer } from '@/components/chart/ChartContainer';
import { InfoPanel } from './InfoPanel';
import { ApiHealthToast } from '@/components/ui/ApiHealthToast';
import { UpdateChecker } from '@/components/ui/UpdateChecker';

export function MainLayout() {
  return (
    <div className={styles.container}>
      <TopNav />
      <div className={styles.main}>
        <div className={styles.chartArea}>
          <ChartContainer />
        </div>
        <div className={styles.infoPanel}>
          <InfoPanel />
        </div>
      </div>
      <StatusBar />
      <ApiHealthToast />
      <UpdateChecker />
    </div>
  );
}
