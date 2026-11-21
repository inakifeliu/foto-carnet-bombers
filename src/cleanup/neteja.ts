/**
 * Neteja de memòria (RF-16). Tots els recursos sensibles (pistes de càmera, object URLs,
 * canvas) es registren aquí perquè es puguin alliberar d'un sol cop en reiniciar o en
 * tancar la pestanya (`pagehide`). No s'usa mai localStorage/sessionStorage/IndexedDB.
 */
export interface IPistaMitjans {
  stop: () => void;
}

export interface IFluxMitjans {
  getTracks: () => IPistaMitjans[];
}

export interface IDimensionable {
  width: number;
  height: number;
}

/** Executa un pas de neteja ignorant-ne els errors (no s'ha de perdre cap altre alliberament). */
function segur(pas: () => void): void {
  try {
    pas();
  } catch {
    // Silenciós a propòsit: no hi ha res més a fer i no s'ha d'aturar la neteja.
  }
}

export class RegistreRecursos {
  private readonly fluxos: IFluxMitjans[] = [];
  private readonly urls: string[] = [];
  private readonly canvas: IDimensionable[] = [];
  private readonly tasques: (() => void)[] = [];

  public constructor(private readonly revoca: (url: string) => void = (u): void => URL.revokeObjectURL(u)) {}

  public registraFlux(flux: IFluxMitjans): void {
    this.fluxos.push(flux);
  }

  public registraUrl(url: string): void {
    this.urls.push(url);
  }

  public registraCanvas(canvas: IDimensionable): void {
    this.canvas.push(canvas);
  }

  /** Registra una tasca d'alliberament addicional (p. ex. les URL blob dels recursos incrustats). */
  public registraTasca(tasca: () => void): void {
    this.tasques.push(tasca);
  }

  /**
   * Allibera tot el registrat i el buida. Segur de cridar diverses vegades. Cada pas va dins el seu
   * try/catch: un error en un recurs (p. ex. una pista que llança en aturar-se) no atura la resta.
   */
  public neteja(): void {
    this.fluxos.splice(0).forEach((flux) => {
      segur(() => flux.getTracks().forEach((pista) => segur(() => pista.stop())));
    });
    this.urls.splice(0).forEach((url) => segur(() => this.revoca(url)));
    this.canvas.splice(0).forEach((c) =>
      segur(() => {
        c.width = 0;
        c.height = 0;
      })
    );
    this.tasques.splice(0).forEach((tasca) => segur(tasca));
  }

  public get pendents(): number {
    return this.fluxos.length + this.urls.length + this.canvas.length + this.tasques.length;
  }
}

/** Registre global de l'aplicació. */
export const registre = new RegistreRecursos();

export function netejaTot(): void {
  registre.neteja();
}
