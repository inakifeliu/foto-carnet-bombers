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

export class RegistreRecursos {
  private readonly fluxos: IFluxMitjans[] = [];
  private readonly urls: string[] = [];
  private readonly canvas: IDimensionable[] = [];

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

  /** Allibera tot el registrat i el buida. Segur de cridar diverses vegades. */
  public neteja(): void {
    this.fluxos.splice(0).forEach((flux) => {
      flux.getTracks().forEach((pista) => pista.stop());
    });
    this.urls.splice(0).forEach((url) => this.revoca(url));
    this.canvas.splice(0).forEach((c) => {
      c.width = 0;
      c.height = 0;
    });
  }

  public get pendents(): number {
    return this.fluxos.length + this.urls.length + this.canvas.length;
  }
}

/** Registre global del web part. */
export const registre = new RegistreRecursos();

export function netejaTot(): void {
  registre.neteja();
}
