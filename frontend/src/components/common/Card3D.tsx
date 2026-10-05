import React, { useRef, useCallback, useEffect } from 'react';

interface Card3DProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  className?: string;
  maxTilt?: number;
  perspective?: number;
  scale?: number;
  glare?: boolean;
  glareMaxOpacity?: number;
  onClick?: (e: React.MouseEvent<HTMLDivElement>) => void;
}

export const Card3D: React.FC<Card3DProps> = ({
  children,
  className = '',
  maxTilt = 12,
  perspective = 1000,
  scale = 1.02,
  glare = true,
  glareMaxOpacity = 0.12,
  onClick,
  style,
  ...rest
}) => {
  const cardRef = useRef<HTMLDivElement>(null);
  const glareRef = useRef<HTMLDivElement>(null);
  const rafId = useRef<number>(0);

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const card = cardRef.current;
      if (!card) return;

      const rect = card.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      const xRatio = (x / rect.width) - 0.5;
      const yRatio = (y / rect.height) - 0.5;

      const rotateY = (xRatio * maxTilt).toFixed(2);
      const rotateX = (-yRatio * maxTilt).toFixed(2);

      if (rafId.current) cancelAnimationFrame(rafId.current);
      rafId.current = requestAnimationFrame(() => {
        card.style.transform = `perspective(${perspective}px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale3d(${scale}, ${scale}, ${scale})`;
        card.style.transition = 'transform 0.05s ease-out';

        if (glare && glareRef.current) {
          const gx = ((x / rect.width) * 100).toFixed(1);
          const gy = ((y / rect.height) * 100).toFixed(1);
          glareRef.current.style.opacity = `${glareMaxOpacity}`;
          glareRef.current.style.background = `radial-gradient(circle 320px at ${gx}% ${gy}%, rgba(255, 255, 255, 0.18), rgba(96, 165, 250, 0.08) 35%, transparent 70%)`;
        }
      });
    },
    [maxTilt, perspective, scale, glare, glareMaxOpacity]
  );

  const handleMouseEnter = useCallback(() => {
    const card = cardRef.current;
    if (card) {
      card.style.willChange = 'transform';
    }
    if (glare && glareRef.current) {
      glareRef.current.style.opacity = `${glareMaxOpacity * 0.5}`;
    }
  }, [glare, glareMaxOpacity]);

  const handleMouseLeave = useCallback(() => {
    if (rafId.current) cancelAnimationFrame(rafId.current);
    const card = cardRef.current;
    if (card) {
      card.style.transform = `perspective(${perspective}px) rotateX(0deg) rotateY(0deg) scale3d(1, 1, 1)`;
      card.style.transition = 'transform 0.4s cubic-bezier(0.23, 1, 0.32, 1)';
      setTimeout(() => {
        if (card) card.style.willChange = 'auto';
      }, 400);
    }
    if (glare && glareRef.current) {
      glareRef.current.style.opacity = '0';
    }
  }, [perspective, glare]);

  useEffect(() => {
    return () => {
      if (rafId.current) cancelAnimationFrame(rafId.current);
    };
  }, []);

  return (
    <div
      ref={cardRef}
      onMouseMove={handleMouseMove}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onClick={onClick}
      style={{
        transform: `perspective(${perspective}px) rotateX(0deg) rotateY(0deg) scale3d(1, 1, 1)`,
        transformStyle: 'preserve-3d',
        ...style,
      }}
      className={`card-3d-root relative ${className}`}
      {...rest}
    >
      {/* 3D Child Content Layer */}
      <div className="w-full h-full relative preserve-3d z-10 pointer-events-auto">
        {children}
      </div>

      {/* Dynamic Specular 3D Glare Light Reflection */}
      {glare && (
        <div
          ref={glareRef}
          className="pointer-events-none absolute inset-0 rounded-[inherit] overflow-hidden transition-opacity duration-200 z-0"
          style={{
            opacity: 0,
            background: 'radial-gradient(circle 320px at 50% 50%, rgba(255, 255, 255, 0.18), rgba(96, 165, 250, 0.08) 35%, transparent 70%)',
          }}
        />
      )}
    </div>
  );
};
