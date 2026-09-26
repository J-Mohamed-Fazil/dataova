import React, { useRef, useState, useCallback } from 'react';

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
  const [transformStyle, setTransformStyle] = useState<React.CSSProperties>({
    transform: `perspective(${perspective}px) rotateX(0deg) rotateY(0deg) scale3d(1, 1, 1)`,
    transition: 'transform 0.5s cubic-bezier(0.23, 1, 0.32, 1)',
  });
  const [glarePosition, setGlarePosition] = useState<{ x: number; y: number; opacity: number }>({
    x: 50,
    y: 50,
    opacity: 0,
  });

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!cardRef.current) return;
      const rect = cardRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      const xRatio = (x / rect.width) - 0.5;
      const yRatio = (y / rect.height) - 0.5;

      const rotateY = xRatio * maxTilt;
      const rotateX = -yRatio * maxTilt;

      setTransformStyle({
        transform: `perspective(${perspective}px) rotateX(${rotateX.toFixed(2)}deg) rotateY(${rotateY.toFixed(2)}deg) scale3d(${scale}, ${scale}, ${scale})`,
        transition: 'transform 0.08s ease-out',
      });

      if (glare) {
        setGlarePosition({
          x: (x / rect.width) * 100,
          y: (y / rect.height) * 100,
          opacity: glareMaxOpacity,
        });
      }
    },
    [maxTilt, perspective, scale, glare, glareMaxOpacity]
  );

  const handleMouseEnter = useCallback(() => {
    if (glare) {
      setGlarePosition((prev) => ({ ...prev, opacity: glareMaxOpacity * 0.5 }));
    }
  }, [glare, glareMaxOpacity]);

  const handleMouseLeave = useCallback(() => {
    setTransformStyle({
      transform: `perspective(${perspective}px) rotateX(0deg) rotateY(0deg) scale3d(1, 1, 1)`,
      transition: 'transform 0.6s cubic-bezier(0.23, 1, 0.32, 1)',
    });
    if (glare) {
      setGlarePosition((prev) => ({ ...prev, opacity: 0 }));
    }
  }, [perspective, glare]);

  return (
    <div
      ref={cardRef}
      onMouseMove={handleMouseMove}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onClick={onClick}
      style={{
        ...transformStyle,
        transformStyle: 'preserve-3d',
        ...style,
      }}
      className={`card-3d-root relative ${className}`}
      {...rest}
    >
      {/* 3D Child Content Layer */}
      <div className="w-full h-full relative preserve-3d z-10">
        {children}
      </div>

      {/* Dynamic Specular 3D Glare Light Reflection */}
      {glare && (
        <div
          className="pointer-events-none absolute inset-0 rounded-[inherit] overflow-hidden transition-opacity duration-300 z-0"
          style={{
            opacity: glarePosition.opacity,
            background: `radial-gradient(circle 320px at ${glarePosition.x}% ${glarePosition.y}%, rgba(255, 255, 255, 0.18), rgba(96, 165, 250, 0.08) 35%, transparent 70%)`,
          }}
        />
      )}
    </div>
  );
};
