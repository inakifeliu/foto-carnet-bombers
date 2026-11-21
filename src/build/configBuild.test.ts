import { spawnSync } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

const ARREL = process.cwd();

function compilaAmb(contingut: string): { status: number | null; sortida: string } {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fcb-config-'));
  const fitxer = path.join(dir, 'config.json');
  fs.writeFileSync(fitxer, contingut, 'utf8');
  try {
    const r = spawnSync(process.execPath, [path.join(ARREL, 'scripts/construeix.mjs')], {
      cwd: ARREL,
      env: { ...process.env, FCB_CONFIG: fitxer },
      encoding: 'utf8'
    });
    return { status: r.status, sortida: `${r.stdout}\n${r.stderr}` };
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

describe('validació de la configuració en compilar (construeix.mjs)', () => {
  // Cada compilació invàlida s'atura abans d'empaquetar, per això són ràpides.
  it('un camp amb el tipus equivocat fa fallar la compilació', () => {
    const r = compilaAmb('{"maxFotos":"tres"}');
    expect(r.status).toBe(1);
    expect(r.sortida).toContain('config/config.json no és vàlid');
    expect(r.sortida).toContain('maxFotos');
  });

  it('una clau desconeguda fa fallar la compilació', () => {
    const r = compilaAmb('{"nova":1}');
    expect(r.status).toBe(1);
    expect(r.sortida).toContain('nova');
  });

  it('una regex invàlida o una resolució no permesa fan fallar la compilació', () => {
    expect(compilaAmb('{"matriculaRegex":"(["}').status).toBe(1);
    expect(compilaAmb('{"sortida":{"ppp":450}}').status).toBe(1);
  });

  it('un JSON trencat fa fallar la compilació', () => {
    const r = compilaAmb('{ trencat');
    expect(r.status).toBe(1);
    expect(r.sortida).toContain('no és JSON vàlid');
  });
});
