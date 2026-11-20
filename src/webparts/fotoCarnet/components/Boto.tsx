import * as React from 'react';
import styles from '../styles/brand.module.scss';

export interface IBotoProps {
  variant?: 'primari' | 'secundari';
  onClick?: () => void;
  disabled?: boolean;
  type?: 'button' | 'submit';
  children?: React.ReactNode;
}

export const Boto: React.FC<IBotoProps> = ({ variant = 'primari', onClick, disabled, type = 'button', children }) => (
  <button
    type={type}
    className={variant === 'primari' ? styles.botoPrimari : styles.botoSecundari}
    onClick={onClick}
    disabled={disabled}
  >
    {children}
  </button>
);
