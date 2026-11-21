import * as React from 'react';
import { createRoot } from 'react-dom/client';
import { TextRic } from './TextRic';

// React 18.3 exporta `act`, però els tipus instal·lats encara no.
const act = (React as unknown as { act: (cb: () => void) => void }).act;

describe('TextRic', () => {
  it('converteix <b> en <strong> sense innerHTML', () => {
    const div = document.createElement('div');
    const root = createRoot(div);
    (globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;
    act(() => {
      root.render(<TextRic text={'Hola <b>món</b> i <b>tu</b>.'} />);
    });
    expect(div.innerHTML).toBe('Hola <strong>món</strong> i <strong>tu</strong>.');
    act(() => root.unmount());
  });
});
