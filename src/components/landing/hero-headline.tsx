"use client";

import BlurText from "@/components/landing/react-bits/BlurText";

/** The brand promise, revealed word by word (instant for users who prefer reduced motion). */
export function HeroHeadline() {
  return (
    <BlurText
      as="h1"
      text="Cada centavo no seu lugar."
      trigger="load"
      animateBy="words"
      direction="top"
      delay={120}
      stepDuration={0.45}
      className="justify-center text-4xl leading-[1.1] font-semibold tracking-tight text-white sm:text-5xl lg:justify-start lg:text-6xl"
    />
  );
}
