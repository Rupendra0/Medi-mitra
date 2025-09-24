import React from 'react';
import { motion } from 'framer-motion';
import ConicGradientAnimation from './ConicGradientAnimation';

const AnimatedButton = ({ 
  children, 
  onClick, 
  href, 
  variant = 'primary', 
  size = 'medium',
  className = '',
  disabled = false,
  ...props 
}) => {
  const getVariantStyles = () => {
    const variants = {
      primary: {
        borderColor: 'rgba(0, 129, 112, 0.7)',
        textColor: '#FFFFFF',
        backgroundColor: 'rgba(0, 129, 112, 0.06)',
        overlayBorderColor: 'rgba(0, 129, 112, 0.5)',
        animationDuration: 5,
        hoverBorderColor: 'rgba(64, 200, 160, 0.8)',
      },
      secondary: {
        borderColor: 'rgba(0, 91, 65, 0.7)',
        textColor: '#E8F5E8', 
        backgroundColor: 'rgba(0, 91, 65, 0.06)',
        overlayBorderColor: 'rgba(0, 91, 65, 0.5)',
        animationDuration: 6,
        hoverBorderColor: 'rgba(32, 180, 140, 0.8)',
      },
      accent: {
        borderColor: 'rgba(72, 187, 120, 0.6)',
        textColor: '#F0FDF4',
        backgroundColor: 'rgba(72, 187, 120, 0.05)',
        overlayBorderColor: 'rgba(72, 187, 120, 0.4)',
        animationDuration: 6,
        hoverBorderColor: 'rgba(104, 211, 145, 0.8)',
      },
      ghost: {
        borderColor: 'rgba(0, 129, 112, 0.5)',
        textColor: 'rgba(0, 129, 112, 0.9)',
        backgroundColor: 'rgba(0, 129, 112, 0.03)',
        overlayBorderColor: 'rgba(0, 129, 112, 0.4)',
        animationDuration: 4,
        hoverBorderColor: 'rgba(64, 200, 160, 0.7)',
      }
    };
    return variants[variant] || variants.primary;
  };

  const getSizeStyles = () => {
    const sizes = {
      small: {
        width: 120,
        height: 40,
        fontSize: 14,
        fontWeight: 500,
        borderRadius: 8,
      },
      medium: {
        width: 160,
        height: 48,
        fontSize: 16,
        fontWeight: 600,
        borderRadius: 12,
      },
      large: {
        width: 200,
        height: 56,
        fontSize: 18,
        fontWeight: 700,
        borderRadius: 16,
      },
      full: {
        width: '100%',
        height: 48,
        fontSize: 16,
        fontWeight: 600,
        borderRadius: 12,
      }
    };
    return sizes[size] || sizes.medium;
  };

  const variantStyles = getVariantStyles();
  const sizeStyles = getSizeStyles();
  const [isHovered, setIsHovered] = React.useState(false);

  const buttonContent = (
    <motion.div
      style={{
        width: sizeStyles.width,
        height: sizeStyles.height,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.6 : 1,
        position: 'relative',
      }}
      whileHover={!disabled ? { 
        scale: 1.02,
        transition: { duration: 0.2 }
      } : {}}
      whileTap={!disabled ? { 
        scale: 0.98,
        transition: { duration: 0.1 }
      } : {}}
      onHoverStart={() => setIsHovered(true)}
      onHoverEnd={() => setIsHovered(false)}
      className={className}
      {...props}
    >
      <ConicGradientAnimation
        width={sizeStyles.width}
        height={sizeStyles.height}
        borderColor={isHovered ? variantStyles.hoverBorderColor : variantStyles.borderColor}
        backgroundColor={variantStyles.backgroundColor}
        overlayBorderColor={isHovered ? variantStyles.hoverBorderColor : variantStyles.overlayBorderColor}
        textColor={variantStyles.textColor}
        fontSize={sizeStyles.fontSize}
        fontWeight={sizeStyles.fontWeight}
        borderRadius={sizeStyles.borderRadius}
        animationDuration={variantStyles.animationDuration}
        blurRadius={1}
        overlayMargin={2}
        letterSpacing={0.5}
        variant={variant} // Pass variant for custom styling
      >
        <motion.div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            textShadow: '0 1px 2px rgba(0,0,0,0.5)',
          }}
          animate={{
            textShadow: isHovered 
              ? `0 0 12px ${variantStyles.hoverBorderColor}60, 0 2px 4px rgba(0,0,0,0.2)` 
              : '0 1px 3px rgba(0,0,0,0.3)'
          }}
          transition={{ duration: 0.3 }}
        >
          {children}
        </motion.div>
      </ConicGradientAnimation>
      
      {/* Simple floating particles effect on hover */}
      {isHovered && (
        <motion.div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            pointerEvents: 'none',
            overflow: 'hidden',
            borderRadius: sizeStyles.borderRadius,
          }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          {[...Array(3)].map((_, i) => (
            <motion.div
              key={i}
              style={{
                position: 'absolute',
                width: '4px',
                height: '4px',
                backgroundColor: variantStyles.hoverBorderColor,
                borderRadius: '50%',
                boxShadow: `0 0 10px ${variantStyles.hoverBorderColor}`,
              }}
              initial={{
                x: Math.random() * sizeStyles.width,
                y: sizeStyles.height,
                opacity: 0,
              }}
              animate={{
                y: -20,
                opacity: [0, 1, 0],
              }}
              transition={{
                duration: 1.5,
                delay: i * 0.2,
                repeat: Infinity,
                ease: 'easeOut',
              }}
            />
          ))}
        </motion.div>
      )}
    </motion.div>
  );

  if (href) {
    return (
      <motion.a
        href={href}
        onClick={onClick}
        style={{ 
          textDecoration: 'none',
          display: 'inline-block',
        }}
        whileHover={{ textDecoration: 'none' }}
      >
        {buttonContent}
      </motion.a>
    );
  }

  return (
    <motion.button
      onClick={disabled ? undefined : onClick}
      style={{
        border: 'none',
        background: 'transparent',
        padding: 0,
        cursor: disabled ? 'not-allowed' : 'pointer',
      }}
      disabled={disabled}
    >
      {buttonContent}
    </motion.button>
  );
};

export default AnimatedButton;