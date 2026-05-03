import type { CapacitorConfig } from '@capacitor/cli';

// PulseChat Mobile App Configuration
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
      launchShowDuration: 0,
      launchAutoHide: false,
      backgroundColor: '#0a0a0a',
      showSpinner: false,
      androidSpinnerStyle: 'small',
      iosSpinnerStyle: 'small',
      splashFullScreen: true,
      splashImmersive: true,
      layoutName: 'splash_screen',
      useDialog: true
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
