import { Accio, estatInicial, IEstat, ORDRE_PANTALLES, reductor } from './estat';

function aplica(estat: IEstat, ...accions: Accio[]): IEstat {
  return accions.reduce(reductor, estat);
}

describe('reductor', () => {
  it("l'estat inicial és P0 si és compatible i NoCompatible si no", () => {
    expect(estatInicial(true).pantalla).toBe('P0Benvinguda');
    expect(estatInicial(false).pantalla).toBe('NoCompatible');
  });

  it('avança per P0..P7 en ordre (amb matrícula)', () => {
    let e = estatInicial(true);
    const visitades = [e.pantalla];
    for (let i = 0; i < ORDRE_PANTALLES.length - 1; i++) {
      if (e.pantalla === 'P2Matricula') {
        e = reductor(e, { tipus: 'DESA_MATRICULA', matricula: '12345' });
      }
      e = reductor(e, { tipus: 'ENDAVANT' });
      visitades.push(e.pantalla);
    }
    expect(visitades).toEqual(ORDRE_PANTALLES);
  });

  it('no avança més enllà de P7', () => {
    const e = { ...estatInicial(true), pantalla: 'P7Final' as const };
    expect(reductor(e, { tipus: 'ENDAVANT' })).toBe(e);
  });

  it('no surt de P2 sense matrícula', () => {
    const e = { ...estatInicial(true), pantalla: 'P2Matricula' as const };
    expect(reductor(e, { tipus: 'ENDAVANT' }).pantalla).toBe('P2Matricula');
    expect(aplica(e, { tipus: 'DESA_MATRICULA', matricula: '1234' }, { tipus: 'ENDAVANT' }).pantalla).toBe('P3Captura');
  });

  it('retrocedeix, però no des de P0 ni des de P7', () => {
    const p3 = { ...estatInicial(true), pantalla: 'P3Captura' as const };
    expect(reductor(p3, { tipus: 'ENRERE' }).pantalla).toBe('P2Matricula');
    const p0 = estatInicial(true);
    expect(reductor(p0, { tipus: 'ENRERE' })).toBe(p0);
    const p7 = { ...estatInicial(true), pantalla: 'P7Final' as const };
    expect(reductor(p7, { tipus: 'ENRERE' })).toBe(p7);
  });

  it('NoCompatible és enganxós: ni endavant ni enrere', () => {
    const e = estatInicial(false);
    expect(reductor(e, { tipus: 'ENDAVANT' })).toBe(e);
    expect(reductor(e, { tipus: 'ENRERE' })).toBe(e);
  });

  it('desa la matrícula i la foto triada', () => {
    const e = aplica(
      estatInicial(true),
      { tipus: 'DESA_MATRICULA', matricula: '9999' },
      { tipus: 'TRIA_FOTO', index: 2 }
    );
    expect(e.matricula).toBe('9999');
    expect(e.fotoTriada).toBe(2);
  });

  it('REINICIA torna a P0 i esborra les dades', () => {
    const e = aplica(
      { ...estatInicial(true), pantalla: 'P6Forms' },
      { tipus: 'DESA_MATRICULA', matricula: '12345' },
      { tipus: 'TRIA_FOTO', index: 1 },
      { tipus: 'REINICIA' }
    );
    expect(e).toEqual(estatInicial(true));
  });

  it('REINICIA manté NoCompatible quan no és compatible', () => {
    expect(reductor(estatInicial(false), { tipus: 'REINICIA' }).pantalla).toBe('NoCompatible');
  });

  it("és pur: no muta l'estat d'entrada", () => {
    const e = estatInicial(true);
    const copia = { ...e };
    reductor(e, { tipus: 'ENDAVANT' });
    expect(e).toEqual(copia);
  });
});
