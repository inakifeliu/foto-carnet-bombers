import * as React from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { Version } from '@microsoft/sp-core-library';
import { BaseClientSideWebPart } from '@microsoft/sp-webpart-base';

import ProvaViabilitat from './components/ProvaViabilitat';

export interface IProvaViabilitatWebPartProps {}

export default class ProvaViabilitatWebPart extends BaseClientSideWebPart<IProvaViabilitatWebPartProps> {
  private _root: Root | undefined;

  public render(): void {
    if (!this._root) {
      this._root = createRoot(this.domElement);
    }
    this._root.render(React.createElement(ProvaViabilitat));
  }

  protected onDispose(): void {
    this._root?.unmount();
    this._root = undefined;
  }

  protected get dataVersion(): Version {
    return Version.parse('1.0');
  }
}
