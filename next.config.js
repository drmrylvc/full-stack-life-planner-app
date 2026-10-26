/** @type {import('next').NextConfig} */
const nextConfig = {
typescript: {
    ignoreBuildErrors: true,
  },
  // Terminalin ısrarla istediği o evrensel izin tanımı (Yeni IP adresimiz eklendi)
  allowedDevOrigins: ["10.0.2.2", "192.168.68.100", "192.168.68.103", "repeater-musty-tartly.ngrok-free.dev", "192.168.68.103:3000", "localhost:3000"],

  // Server Actions mimarisinin emülatörden gelen istekleri kabul etmesi için ek güvenlik izni
  experimental: {
    serverActions: {
      allowedOrigins: ["10.0.2.2", "192.168.68.100", "192.168.68.103", "repeater-musty-tartly.ngrok-free.dev", "192.168.68.103:3000", "localhost:3000"]
    }
  }
};


module.exports = nextConfig;
