export interface SettingsRecord {
  readonly enabled: boolean;
  readonly name: string;
}

export const defaultSettings: SettingsRecord = {
  enabled: true,
  name: 'controlled',
};
