import {
  CLAU_ERROR_CAMERA,
  aturaFlux,
  classificaErrorCamera,
  llistaCameres,
  resolucioInsuficient,
  restriccionsCamera
} from './camera';
import { t } from '../i18n';

const err = (name: string): Error => Object.assign(new Error(name), { name });

describe('classificaErrorCamera', () => {
  it('permís denegat', () => {
    expect(classificaErrorCamera(err('NotAllowedError'))).toBe('permis');
    expect(classificaErrorCamera(err('PermissionDeniedError'))).toBe('permis');
    expect(classificaErrorCamera(err('SecurityError'))).toBe('permis');
  });
  it('cap càmera', () => {
    expect(classificaErrorCamera(err('NotFoundError'))).toBe('cap');
    expect(classificaErrorCamera(err('OverconstrainedError'))).toBe('cap');
    expect(classificaErrorCamera(err('DevicesNotFoundError'))).toBe('cap');
  });
  it('càmera ocupada', () => {
    expect(classificaErrorCamera(err('NotReadableError'))).toBe('ocupada');
    expect(classificaErrorCamera(err('TrackStartError'))).toBe('ocupada');
  });
  it('genèric per a la resta, també valors que no són errors', () => {
    expect(classificaErrorCamera(err('TypeError'))).toBe('generic');
    expect(classificaErrorCamera(undefined)).toBe('generic');
    expect(classificaErrorCamera(null)).toBe('generic');
    expect(classificaErrorCamera('boom')).toBe('generic');
    expect(classificaErrorCamera({ name: 42 })).toBe('generic');
    expect(classificaErrorCamera({ name: 'NotAllowedError' })).toBe('permis');
  });
  it('cada tipus té un missatge en català diferent i el d’ocupada esmenta Teams', () => {
    (['permis', 'cap', 'ocupada', 'generic'] as const).forEach((tipus) => {
      expect(t(CLAU_ERROR_CAMERA[tipus]).length).toBeGreaterThan(10);
    });
    expect(t(CLAU_ERROR_CAMERA.ocupada)).toContain('Teams');
    expect(new Set(Object.values(CLAU_ERROR_CAMERA)).size).toBe(4);
  });
});

describe('restriccionsCamera', () => {
  it('per defecte: ideal 1920×1080 i facingMode user (RF-01)', () => {
    expect(restriccionsCamera()).toEqual({
      video: { width: { ideal: 1920 }, height: { ideal: 1080 }, facingMode: 'user' },
      audio: false
    });
  });
  it('amb deviceId: aquella càmera concreta, sense facingMode', () => {
    expect(restriccionsCamera('abc')).toEqual({
      video: { width: { ideal: 1920 }, height: { ideal: 1080 }, deviceId: { exact: 'abc' } },
      audio: false
    });
  });
});

describe('resolucioInsuficient', () => {
  it('< 1280×720 avisa', () => {
    expect(resolucioInsuficient(640, 480)).toBe(true);
    expect(resolucioInsuficient(1280, 719)).toBe(true);
    expect(resolucioInsuficient(1279, 720)).toBe(true);
  });
  it('≥ 1280×720 no avisa', () => {
    expect(resolucioInsuficient(1280, 720)).toBe(false);
    expect(resolucioInsuficient(1920, 1080)).toBe(false);
    expect(resolucioInsuficient(720, 1280)).toBe(false);
  });
});

describe('llistaCameres', () => {
  it('només les entrades videoinput, amb etiqueta o un nom per defecte', async () => {
    const md = {
      enumerateDevices: async (): Promise<MediaDeviceInfo[]> =>
        [
          { kind: 'audioinput', deviceId: 'm', label: 'Micro' },
          { kind: 'videoinput', deviceId: 'a', label: 'Integrada' },
          { kind: 'videoinput', deviceId: 'b', label: '' }
        ] as MediaDeviceInfo[]
    };
    expect(await llistaCameres(md, (n) => `Càmera ${n}`)).toEqual([
      { deviceId: 'a', etiqueta: 'Integrada' },
      { deviceId: 'b', etiqueta: 'Càmera 2' }
    ]);
  });
});

describe('aturaFlux', () => {
  it('atura totes les pistes i tolera undefined', () => {
    const stop1 = jest.fn();
    const stop2 = jest.fn();
    aturaFlux({ getTracks: () => [{ stop: stop1 }, { stop: stop2 }] } as unknown as MediaStream);
    expect(stop1).toHaveBeenCalledTimes(1);
    expect(stop2).toHaveBeenCalledTimes(1);
    expect(() => aturaFlux(undefined)).not.toThrow();
  });
});
