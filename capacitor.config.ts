import type { CapacitorConfig } from '@capacitor/cli';

// PulseChat Mobile App Configuration v2
const config: CapacitorConfig = {
  appId: 'com.ajibolagbenga.pulsechat',
  appName: 'PulseChat',
  webDir: 'dist/client',
  server: {
    androidScheme: 'https',
    iosScheme: 'https',
    url: 'https://ajibola-gbenga-joseph.onrender.com/auth',
    cleartext: false
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      launchAutoHide: true,
      backgroundColor: '#000000',
      androidSplashResourceName: 'splash_screen',
      androidScaleType: 'CENTER',
      showSpinner: false,
      splashFullScreen: true,
      splashImmersive: true
    },
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert']
    },
    StatusBar: {
      style: 'dark',
      backgroundColor: '#000000'
    },
    Camera: {
      quality: 90,
      allowEditing: false,
      resultType: 'uri'
    }
  }
};

export default config;
