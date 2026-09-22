import type { CapacitorConfig } from '@capacitor/cli';

/**
 * SkillEarn Assam native wrapper.
 *
 * The app is a server-rendered TanStack Start site with server functions, so it
 * cannot be shipped as a static offline bundle. The native shell therefore
 * loads the deployed site directly, which keeps login, bookings, KYC, payments
 * and the admin panel working against the real backend.
 */
const config: CapacitorConfig = {
  appId: 'com.skillearn.assam',
  appName: 'SkillEarn Assam',
  webDir: 'native-web',
  server: {
    url: 'https://earn-assam-spark.lovable.app',
    cleartext: false,
  },
  android: {
    allowMixedContent: false,
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 1200,
      launchAutoHide: true,
      backgroundColor: '#070B14',
    },
  },
};

export default config;
