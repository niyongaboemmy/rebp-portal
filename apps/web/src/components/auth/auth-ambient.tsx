import { OrbitArt } from "@/components/motion/orbit-art";

/** The auth showcase: the shared orbit art, sized to the screen height, fading while you type. */
export function AuthAmbient() {
  return (
    <OrbitArt
      fadeOnFocus
      className="max-w-[min(28rem,calc(100svh-18rem))] [@media(max-height:760px)]:max-w-[min(28rem,calc(100svh-10rem))]"
    />
  );
}
