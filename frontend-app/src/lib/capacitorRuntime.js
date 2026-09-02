import { Capacitor } from '@capacitor/core';
import { SplashScreen } from '@capacitor/splash-screen';
import { StatusBar, Style } from '@capacitor/status-bar';

export async function configureCapacitorRuntime() {
  if (!Capacitor.isNativePlatform()) return;

  try {
    await StatusBar.setStyle({ style: Style.Light });
    await StatusBar.setBackgroundColor({ color: '#FAF7F0' });
  } catch (err) {
    console.warn('[capacitor] status bar setup failed', err);
  }

  try {
    await SplashScreen.hide();
  } catch (err) {
    console.warn('[capacitor] splash hide failed', err);
  }
}
