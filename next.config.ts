import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  turbopack: {
    // Tetapkan root ke direktori proyek ini agar Turbopack tidak mencari
    // package-lock.json di luar repo dan tidak menghasilkan warning.
    root: path.resolve(__dirname),
  },
};

export default nextConfig;
