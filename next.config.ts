import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Native modules: bundling these would break their binary loading. Both are
  // used only by the segmentation route, which runs on the Node runtime.
  serverExternalPackages: ['onnxruntime-node', 'sharp'],
};

export default nextConfig;
