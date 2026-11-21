import * as React from 'react';
import styles from '../styles/brand.module.css';

export interface IBotoProps {
  variant?: 'primari' | 'secundari';
  onClick?: () => void;
  disabled?: boolean;
  type?: 'button' | 'submit';
  /** Referència al <button> (p. ex. per retornar-hi el focus). */
  refBoto?: React.Ref<HTMLButtonElement>;
  children?: React.ReactNode;
}

export const Boto: React.FC<IBotoProps> = ({
  variant = 'primari',
  onClick,
  disabled,
  type = 'button',
  refBoto,
  children
}) => (
  <button
    ref={refBoto}
    type={type}
    className={variant === 'primari' ? styles.botoPrimari : styles.botoSecundari}
    onClick={onClick}
    disabled={disabled}
  >
    {children}
  </button>
);
