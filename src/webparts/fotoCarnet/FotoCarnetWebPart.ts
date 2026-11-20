import * as React from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { Version } from '@microsoft/sp-core-library';
import {
  type IPropertyPaneConfiguration,
  PropertyPaneDropdown,
  PropertyPaneTextField
} from '@microsoft/sp-property-pane';
import { BaseClientSideWebPart } from '@microsoft/sp-webpart-base';

import { App } from './app/App';
import { type IAvis, IPropietatsConfig, resolConfig, validaRegex } from './config/configuracio';
import { t } from './i18n';

export interface IFotoCarnetWebPartProps extends IPropietatsConfig {
  urlPlantilla?: string;
  matriculaRegex?: string;
  ppp?: number;
  configAvancada?: string;
}

function textAvis(avis: IAvis): string {
  return t(`propietats.avis.${avis.codi}` as const, { camp: avis.camp ?? '' });
}

export default class FotoCarnetWebPart extends BaseClientSideWebPart<IFotoCarnetWebPartProps> {
  private _root: Root | undefined;

  public render(): void {
    // Configuració efectiva = config.default.json <- valors del panell de propietats.
    const { config } = resolConfig(this.properties);
    if (!this._root) {
      this._root = createRoot(this.domElement);
    }
    this._root.render(React.createElement(App, { config }));
  }

  protected onDispose(): void {
    this._root?.unmount();
    this._root = undefined;
  }

  protected get dataVersion(): Version {
    return Version.parse('1.0');
  }

  protected getPropertyPaneConfiguration(): IPropertyPaneConfiguration {
    const efectiva = resolConfig(this.properties).config;
    return {
      pages: [
        {
          header: { description: t('propietats.descripcio') },
          groups: [
            {
              groupName: t('propietats.grup'),
              groupFields: [
                PropertyPaneTextField('urlPlantilla', {
                  label: t('propietats.urlPlantilla'),
                  placeholder: efectiva.forms.urlPlantilla
                }),
                PropertyPaneTextField('matriculaRegex', {
                  label: t('propietats.matriculaRegex'),
                  placeholder: efectiva.matriculaRegex,
                  onGetErrorMessage: (valor: string): string =>
                    validaRegex(valor) ? '' : t('propietats.avis.regexInvalida')
                }),
                PropertyPaneDropdown('ppp', {
                  label: t('propietats.ppp'),
                  selectedKey: efectiva.sortida.ppp,
                  options: [
                    { key: 300, text: t('propietats.ppp300') },
                    { key: 600, text: t('propietats.ppp600') }
                  ]
                }),
                PropertyPaneTextField('configAvancada', {
                  label: t('propietats.avancada'),
                  multiline: true,
                  rows: 12,
                  resizable: true,
                  // Avisos no bloquejants: un valor invàlid s'ignora en temps d'execució.
                  onGetErrorMessage: (valor: string): string =>
                    resolConfig({ ...this.properties, configAvancada: valor })
                      .avisos.map(textAvis)
                      .join(' ')
                })
              ]
            }
          ]
        }
      ]
    };
  }
}
