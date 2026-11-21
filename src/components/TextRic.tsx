import * as React from 'react';

/**
 * Renderitza text amb marques <b>…</b> (de ca.json) com a elements <strong>,
 * sense innerHTML: el text sempre es renderitza com a text.
 */
export const TextRic: React.FC<{ text: string }> = ({ text }) => {
  const parts = text.split(/<b>(.*?)<\/b>/);
  return (
    <>
      {parts.map((part, i) =>
        i % 2 === 1 ? <strong key={i}>{part}</strong> : <React.Fragment key={i}>{part}</React.Fragment>
      )}
    </>
  );
};
