import styles from './MainLayout.module.css';
import { TopNav } from './TopNav';
import { StatusBar } from './StatusBar';

export function MainLayout() {
  return (
    <div className={styles.container}>
      <TopNav />
      <div className={styles.main}>
        <div className={styles.chartArea}>
          <div className={styles.chartZoneK}>
            <div className={styles.placeholder}>K-Line Chart</div>
          </div>
          <div className={styles.chartZoneVolume}>
            <div className={styles.placeholder}>Volume</div>
          </div>
          <div className={styles.chartZoneIndicator}>
            <div className={styles.placeholder}>MACD</div>
          </div>
        </div>
        <div className={styles.infoPanel}>
          <div className={styles.placeholder}>Info Panel</div>
        </div>
      </div>
      <StatusBar />
    </div>
  );
}
