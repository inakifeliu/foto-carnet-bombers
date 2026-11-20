// La llibreria DOM de TypeScript no inclou `showSaveFilePicker` (File System Access API).
interface ISaveFilePickerAcceptType {
  description?: string;
  accept: Record<string, string[]>;
}

interface ISaveFilePickerOptions {
  suggestedName?: string;
  startIn?: 'desktop' | 'documents' | 'downloads' | 'music' | 'pictures' | 'videos';
  excludeAcceptAllOption?: boolean;
  types?: ISaveFilePickerAcceptType[];
}

interface Window {
  showSaveFilePicker?: (options?: ISaveFilePickerOptions) => Promise<FileSystemFileHandle>;
}
