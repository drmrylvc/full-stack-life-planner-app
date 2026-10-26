import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: 'com.ezylife2026.myapp', 
  appName: "ezlife26",
  webDir: "public",
  server: {
  url: "https://full-stack-life-planner-app.onrender.com", 
  allowNavigation: ["full-stack-life-planner-app.onrender.com"]
},
  ios: {
    contentInset: "never",
  },
  plugins: {
    SplashScreen: {
      launchAutoHide: true,
      launchShowDuration: 700,
      backgroundColor: "#16132c",
      showSpinner: false,
    },
  },
};

export default config;

