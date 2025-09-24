import React from "react"
import { motion } from "framer-motion"

export default function ConicGradientAnimation({
    width,
    height,
    borderColor = "#008170",
    animationDuration = 6,
    blurRadius = 2,
    borderRadius = 0,
    backgroundColor = "rgba(255, 255, 255, 0.1)",
    overlayBorderColor = "#008170",
    overlayMargin = 1,
    text = "Rotating Border",
    textColor = "#000000",
    fontSize = 16,
    fontWeight = 400,
    fontFamily = "Inter",
    letterSpacing = 0,
    variant = "primary", // Add variant prop for customization
    children,
}) {
    const responsiveWidth = typeof width === 'string' ? width : `${width}px`;
    const responsiveHeight = typeof height === 'string' ? height : `${height}px`;

    // Custom gradient configurations for each variant
    const getVariantGradient = () => {
        const gradients = {
            primary: {
                gradient: `conic-gradient(from 0deg, 
                    transparent 0deg, 
                    transparent 30deg,
                    rgba(0, 129, 112, 0.3) 80deg,
                    rgba(64, 200, 160, 0.5) 120deg,
                    rgba(0, 185, 150, 0.4) 160deg,
                    rgba(32, 180, 140, 0.25) 220deg,
                    transparent 280deg,
                    transparent 360deg)`,
                filter: `blur(${blurRadius}px) brightness(0.85) saturate(1.0)`,
                opacity: 0.65,
                duration: animationDuration * 1.3,
            },
            secondary: {
                gradient: `conic-gradient(from 0deg, 
                    transparent 0deg, 
                    transparent 45deg,
                    rgba(0, 91, 65, 0.25) 90deg,
                    rgba(32, 180, 140, 0.4) 135deg,
                    rgba(0, 129, 112, 0.35) 180deg,
                    rgba(16, 120, 95, 0.2) 225deg,
                    transparent 300deg,
                    transparent 360deg)`,
                filter: `blur(${blurRadius * 1.2}px) brightness(0.8) saturate(0.9)`,
                opacity: 0.6,
                duration: animationDuration * 1.5,
            },
            accent: {
                gradient: `conic-gradient(from 0deg, 
                    transparent 0deg, 
                    transparent 35deg,
                    rgba(72, 187, 120, 0.3) 85deg,
                    rgba(104, 211, 145, 0.45) 125deg,
                    rgba(88, 196, 132, 0.4) 165deg,
                    rgba(56, 178, 108, 0.25) 205deg,
                    transparent 270deg,
                    transparent 360deg)`,
                filter: `blur(${blurRadius * 0.9}px) brightness(0.9) saturate(1.1)`,
                opacity: 0.7,
                duration: animationDuration * 1.1,
            },
            ghost: {
                gradient: `conic-gradient(from 0deg, 
                    transparent 0deg, 
                    transparent 60deg,
                    rgba(0, 129, 112, 0.15) 110deg,
                    rgba(64, 200, 160, 0.25) 140deg,
                    rgba(32, 180, 140, 0.2) 180deg,
                    rgba(0, 129, 112, 0.1) 220deg,
                    transparent 320deg,
                    transparent 360deg)`,
                filter: `blur(${blurRadius * 1.5}px) brightness(0.75) saturate(0.8)`,
                opacity: 0.45,
                duration: animationDuration * 2,
            }
        };
        return gradients[variant] || gradients.primary;
    };

    const gradientConfig = getVariantGradient();

    // Custom glassmorphic surface for each variant
    const getVariantSurface = () => {
        const surfaces = {
            primary: {
                background: `linear-gradient(135deg, 
                    rgba(255, 255, 255, 0.12) 0%, 
                    rgba(0, 129, 112, 0.04) 50%, 
                    rgba(255, 255, 255, 0.08) 100%)`,
                border: `1px solid rgba(0, 129, 112, 0.2)`,
                shadow: `
                    0 4px 20px rgba(0, 129, 112, 0.1),
                    0 2px 8px rgba(0, 0, 0, 0.05),
                    inset 0 1px 0 rgba(255, 255, 255, 0.15)
                `,
            },
            secondary: {
                background: `linear-gradient(135deg, 
                    rgba(255, 255, 255, 0.1) 0%, 
                    rgba(0, 91, 65, 0.03) 50%, 
                    rgba(255, 255, 255, 0.07) 100%)`,
                border: `1px solid rgba(0, 91, 65, 0.18)`,
                shadow: `
                    0 4px 18px rgba(0, 91, 65, 0.08),
                    0 2px 6px rgba(0, 0, 0, 0.04),
                    inset 0 1px 0 rgba(255, 255, 255, 0.12)
                `,
            },
            accent: {
                background: `linear-gradient(135deg, 
                    rgba(255, 255, 255, 0.14) 0%, 
                    rgba(72, 187, 120, 0.05) 50%, 
                    rgba(255, 255, 255, 0.1) 100%)`,
                border: `1px solid rgba(72, 187, 120, 0.22)`,
                shadow: `
                    0 4px 22px rgba(72, 187, 120, 0.12),
                    0 2px 10px rgba(0, 0, 0, 0.06),
                    inset 0 1px 0 rgba(255, 255, 255, 0.18)
                `,
            },
            ghost: {
                background: `linear-gradient(135deg, 
                    rgba(255, 255, 255, 0.06) 0%, 
                    rgba(0, 129, 112, 0.02) 50%, 
                    rgba(255, 255, 255, 0.04) 100%)`,
                border: `1px solid rgba(0, 129, 112, 0.12)`,
                shadow: `
                    0 4px 15px rgba(0, 129, 112, 0.06),
                    0 2px 5px rgba(0, 0, 0, 0.03),
                    inset 0 1px 0 rgba(255, 255, 255, 0.08)
                `,
            }
        };
        return surfaces[variant] || surfaces.primary;
    };

    const surfaceConfig = getVariantSurface();

    return (
        <div
            style={{
                width: responsiveWidth,
                height: responsiveHeight,
                position: "relative",
                overflow: "hidden",
                borderRadius: `${borderRadius}px`,
                minWidth: "12px",
                minHeight: "12px",
            }}
        >
            {/* Customized rotating border for each variant */}
            <motion.div
                style={{
                    position: "absolute",
                    top: "-200%",
                    left: "-200%",
                    right: "-200%",
                    bottom: "-200%",
                    height: "500%",
                    width: "500%",
                    background: gradientConfig.gradient,
                    borderRadius: `${borderRadius}px`,
                    filter: gradientConfig.filter,
                    opacity: gradientConfig.opacity,
                }}
                initial={{ rotate: 0 }}
                animate={{ rotate: 360 }}
                transition={{
                    duration: gradientConfig.duration,
                    ease: "linear",
                    repeat: Infinity,
                }}
            />

            {/* Variant-specific glassmorphic button surface */}
            <div
                style={{
                    position: "absolute",
                    top: `${overlayMargin}px`,
                    left: `${overlayMargin}px`,
                    right: `${overlayMargin}px`,
                    bottom: `${overlayMargin}px`,
                    backgroundColor: `rgba(255, 255, 255, 0.08)`,
                    backdropFilter: "blur(12px) saturate(120%)",
                    WebkitBackdropFilter: "blur(12px) saturate(120%)",
                    border: surfaceConfig.border,
                    borderRadius: `${Math.max(0, borderRadius - overlayMargin)}px`,
                    boxShadow: surfaceConfig.shadow,
                    background: surfaceConfig.background,
                }}
            />

            {/* Content layer */}
            <div
                style={{
                    position: "relative",
                    zIndex: 3,
                    width: "100%",
                    height: "100%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    padding: "8px 16px",
                }}
            >
                <div
                    style={{
                        color: textColor,
                        fontSize: `${fontSize}px`,
                        fontWeight: fontWeight,
                        fontFamily: fontFamily,
                        letterSpacing: `${letterSpacing}px`,
                        textAlign: "center",
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        maxWidth: "100%",
                        userSelect: "none",
                    }}
                >
                    {children ? children : text}
                </div>
            </div>
        </div>
    )
}