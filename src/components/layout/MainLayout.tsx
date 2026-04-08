import styles from './MainLayout.module.css';
import { TopNav } from './TopNav';
import { StatusBar } from './StatusBar';
import { ChartContainer } from '@/components/chart/ChartContainer';

export function MainLayout() {
  return (
    <div className={styles.container}>
      <TopNav />
      <div className={styles.main}>
        <div className={styles.chartArea}>
          <ChartContainer />
        </div>
        <div className={styles.infoPanel}>
          <div className={styles.placeholder}>Info Panel</div>
        </div>
      </div>
      <StatusBar />
    </div>
  );
}
