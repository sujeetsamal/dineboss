"use client";

import { useCallback } from "react";

export function useOrderNotification() {
  const playSound = useCallback(() => {
    try {
      const audio = new Audio("/notification.mp3");
      audio.volume = 0.7;
      audio.play().catch(() => {
        console.log("Audio autoplay blocked or file not found");
      });
    } catch (error) {
      console.log("Could not play notification sound:", error);
    }
  }, []);

  return { playSound };
}
