import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async headers(){return [{source:'/:path*',headers:[{key:'X-Content-Type-Options',value:'nosniff'},{key:'Referrer-Policy',value:'same-origin'},{key:'Permissions-Policy',value:'camera=(self), microphone=(self), display-capture=(self), geolocation=()'}]},{source:'/api/:path*',headers:[{key:'Cache-Control',value:'private, no-store'}]},{source:'/mes-donnees',headers:[{key:'Cache-Control',value:'private, no-store'}]}];},
};

export default nextConfig;
