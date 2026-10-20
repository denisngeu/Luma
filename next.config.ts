import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output:"standalone",
  allowedDevOrigins: ['192.168.0.13', '192.168.0.13:5173', 'localhost:5173', '10.0.2.2:5173', '10.0.2.2'],
  async headers(){return [{source:'/:path*',headers:[{key:'X-Content-Type-Options',value:'nosniff'},{key:'Referrer-Policy',value:'same-origin'},{key:'Permissions-Policy',value:'camera=(self), microphone=(self), display-capture=(self), geolocation=()'}]},{source:'/api/:path*',headers:[{key:'Cache-Control',value:'private, no-store'}]},{source:'/fonts/:font([a-z0-9-]+\\.woff2)',headers:[{key:'Cache-Control',value:'public, max-age=31536000, immutable'}]},{source:'/mes-donnees',headers:[{key:'Cache-Control',value:'private, no-store'}]}];},
};

export default nextConfig;
