import React, { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';

const FooterArt: React.FC = () => {
  const [isVisible, setIsVisible] = useState(false);
  const footerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect(); // Only animate once
        }
      },
      {
        threshold: 0.1, // Trigger when 10% of the footer is visible
        rootMargin: '50px', // Start animation slightly before fully visible
      }
    );

    if (footerRef.current) {
      observer.observe(footerRef.current);
    }

    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={footerRef}
      className="w-full relative overflow-hidden bg-transparent"
      style={{
        height: 'clamp(350px, 25vw, 450px)', // Responsive height: 350px min, 450px max
      }}
    >
      {/* Scene Image (art-2.png) - Highway + Cars + Smog + Mountain + Cristo */}
      <motion.img
        src="/art-2.png"
        alt=""
        aria-hidden="true"
        className="absolute bottom-0 right-0 pointer-events-none"
        style={{
          width: 'clamp(100%, 36%, 36%)', // Responsive width: 100% min, 36% max (20% more reduction)
          maxWidth: '36%', // Desktop: 36%
          opacity: 'clamp(0.6, 0.85, 0.95)', // Mobile: 0.6, Desktop: 0.85-0.95
        }}
        initial={{ opacity: 0, y: 20 }}
        animate={isVisible ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
        transition={{
          duration: 1.0,
          ease: 'easeOut',
          delay: 0.2, // Delay after bird animation
        }}
      />

      {/* Bird Image (art-1.png) - Vermilion Bird Standing on House */}
      <motion.img
        src="/art-1.png"
        alt=""
        aria-hidden="true"
        className="absolute bottom-0 left-0 pointer-events-none z-10"
        style={{
          width: 'clamp(158px, 17.3vw, 288px)', // Responsive width: 158px min, 288px max (40% bigger total)
          marginBottom: 0,
          paddingBottom: 0,
        }}
        initial={{ opacity: 0, x: -20 }}
        animate={isVisible ? { opacity: 1, x: 0 } : { opacity: 0, x: -20 }}
        transition={{
          duration: 0.8,
          ease: 'easeOut',
        }}
      />

      {/* Footer Message */}
      <motion.div
        className="absolute bottom-4 left-[3%] text-left pointer-events-none z-20"
        initial={{ opacity: 0, y: 10 }}
        animate={isVisible ? { opacity: 1, y: 0 } : { opacity: 0, y: 10 }}
        transition={{
          duration: 0.8,
          ease: 'easeOut',
          delay: 0.4,
        }}
      >
        <p className="text-vino text-lg font-medium whitespace-nowrap">
          PiscoÑawi IA - Desarrollado Por Jose Pedro Ortuño - 2026
        </p>
      </motion.div>
    </div>
  );
};

export default FooterArt;