import { http, createConfig } from "wagmi";
import { sepolia } from "wagmi/chains";
import { injected } from "wagmi/connectors";

const sepoliaRpc = process.env.NEXT_PUBLIC_RPC_URL;

export const config = createConfig({
  chains: [sepolia],
  connectors: [injected()],
  transports: {
    [sepolia.id]: http(sepoliaRpc || undefined),
  },
  ssr: true,
});
